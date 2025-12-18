import { Event, StoreAdapter, Snapshot, AggregateVersionConflictError, EventId, AggregateIsFinalError } from '../../core';
import { Pool, PoolConfig, PoolClient } from 'pg';
import { backOff } from 'exponential-backoff';
import { Joser, Serializer } from '@scaleforge/joser';
import debug from 'debug';
import * as assert from 'assert';
import Queue from 'p-queue';
import { match, P } from 'ts-pattern';
import { createTables } from './libs/schema';

export type PostgresStoreAdapterOptions = PoolConfig & {
    uri?: string;
    maxPoolSize?: number;
    serializers?: Serializer<unknown, unknown>[];
    retryStartingDelay?: number;
    retryMaxDelay?: number;
    retryMaxAttempts?: number;
};

export class PostgresStoreAdapter implements StoreAdapter {
    private readonly logger = {
        info: debug('arque:info:PostgresStoreAdapter'),
        error: debug('arque:error:PostgresStoreAdapter'),
        warn: debug('arque:warn:PostgresStoreAdapter'),
        verbose: debug('arque:verbose:PostgresStoreAdapter'),
        debug: debug('arque:debug:PostgresStoreAdapter'),
    };

    private readonly joser: Joser;
    private readonly pool: Pool;
    private readonly opts: PostgresStoreAdapterOptions;

    private readonly saveSnapshotQueue = new Queue({
        autoStart: true,
        concurrency: 1,
    });

    private _init: Promise<void> | undefined;

    constructor(opts?: PostgresStoreAdapterOptions) {
        this.opts = {
            retryStartingDelay: 100,
            retryMaxDelay: 1600,
            retryMaxAttempts: 20,
            ...opts,
        };

        const poolConfig: PoolConfig = {
            ...this.opts,
            connectionString: this.opts.connectionString || this.opts.uri,
            max: this.opts.max || this.opts.maxPoolSize,
        };

        this.pool = new Pool(poolConfig);

        this.joser = new Joser({
            serializers: [
                {
                    type: Buffer,
                    serialize: (value: Buffer) => value,
                    deserialize: (value: { type: 'Buffer'; data: number[] } | Buffer) => {
                        if (Buffer.isBuffer(value)) return value;
                        return Buffer.from(value.data);
                    },
                },
                {
                    type: Date,
                    serialize: (value: Date) => value.toISOString(),
                    deserialize: (value: string | Date) => new Date(value),
                },
                ...(this.opts.serializers || []),
            ],
        });
    }

    private serialize(value: unknown): any {
        return match(value)
            .with(P.union(P.nullish, P.number, P.string, P.boolean, P.instanceOf(Buffer)), (val) => val)
            .otherwise((val) => this.joser.serialize(val as Record<string, unknown>));
    }

    private deserialize(value: unknown) {
        return match(value)
            .with(P.union(P.nullish, P.number, P.string, P.boolean, P.instanceOf(Buffer)), (val) => val)
            .otherwise((val) => this.joser.deserialize(val as any));
    }

    async init(): Promise<void> {
        if (!this._init) {
            this._init = (async () => {
                const client = await this.pool.connect();
                try {
                    await client.query(createTables);
                } finally {
                    client.release();
                }
            })();
        }
        await this._init;
    }

    async saveEvents(params: {
        aggregate: { id: Buffer; version: number; };
        timestamp: Date;
        events: Pick<Event, 'id' | 'type' | 'body' | 'meta'>[];
        meta?: Event['meta'];
    }): Promise<void> {
        assert.ok(params.aggregate.version > 0, 'aggregate version must be greater than 0');

        await backOff(async () => {
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');

                // Check for final aggregate (OPTIMIZATION: could be done in one query usually, but following logic)
                const aggRes = await client.query('SELECT final FROM aggregates WHERE id = $1', [params.aggregate.id]);
                if (aggRes.rows[0]?.final) {
                     throw new AggregateIsFinalError(params.aggregate.id);
                }

                if (params.aggregate.version === 1) {
                    try {
                        await client.query(
                            'INSERT INTO aggregates (id, version, timestamp) VALUES ($1, $2, $3)',
                            [params.aggregate.id, params.events.length, params.timestamp]
                        );
                    } catch (err: any) {
                        if (err.code === '23505') { // Unique violation
                            throw new AggregateVersionConflictError(params.aggregate.id, params.aggregate.version);
                        }
                        throw err;
                    }
                } else {
                    const updateRes = await client.query(
                        'UPDATE aggregates SET version = $1, timestamp = $2 WHERE id = $3 AND version = $4 AND final IS NOT TRUE',
                        [
                            params.aggregate.version + params.events.length - 1,
                            params.timestamp,
                            params.aggregate.id,
                            params.aggregate.version - 1
                        ]
                    );
                    if (updateRes.rowCount === 0) {
                        throw new AggregateVersionConflictError(params.aggregate.id, params.aggregate.version);
                    }
                }

                for (let index = 0; index < params.events.length; index++) {
                    const event = params.events[index];
                    await client.query(
                        `INSERT INTO events (id, type, aggregate_id, aggregate_version, body, meta, timestamp)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            event.id.buffer,
                            event.type,
                            params.aggregate.id,
                            params.aggregate.version + index,
                            JSON.stringify(this.serialize(event.body)),
                            JSON.stringify(this.serialize({ ...event.meta, ...params.meta })),
                            params.timestamp
                        ]
                    );
                }

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }, {
            startingDelay: this.opts.retryStartingDelay,
            maxDelay: this.opts.retryMaxDelay,
            numOfAttempts: this.opts.retryMaxAttempts,
            retry: (err) => {
                 // Retry on certain Postgres errors (e.g., deadlock, serialization failure)
                 const retryCodes = ['40001', '40P01'];
                 const shouldRetry = retryCodes.includes((err as any).code);
                 if (shouldRetry) {
                     this.logger.warn('retry #saveEvents: code=%s', (err as any).code);
                 } else {
                     this.logger.error('error #saveEvents: message=%s', err.message);
                 }
                 return shouldRetry;
            }
        });
    }

    async listEvents<TEvent = Event>(params: { aggregate?: { id: Buffer; version?: number; }; type?: number; }): Promise<AsyncIterableIterator<TEvent>> {
        const client = await this.pool.connect();
        const _this = this;

        // Note: Using a cursor or simply fetching all for now if not massive. 
        // For AsyncIterableIterator, using a simple query and yielding row by row from memory or cursor is better.
        // Assuming reasonably sized batches for now, mimicking Mongo adapter which uses cursor.
        // pg-query-stream could be used for true streaming, but for simplicity we'll fetch and yield.
        // Actually, let's use a simpler approach: fetch all (risk of memory) or use a cursor library.
        // Given I need to return an AsyncIterableIterator, I can implement a generator that paginates.

        // Simpler implementation: fetch all matches (beware of large datasets), but let's try to be smart.
        // Or better, let's just query and yield.

        let query = 'SELECT * FROM events';
        const values: any[] = [];
        const conditions: string[] = [];

        if (params.aggregate) {
            conditions.push(`aggregate_id = $${values.length + 1}`);
            values.push(params.aggregate.id);

            if (params.aggregate.version) {
                 conditions.push(`aggregate_version > $${values.length + 1}`);
                 values.push(params.aggregate.version);
            }
        }

        if (typeof params.type === 'number') {
            conditions.push(`type = $${values.length + 1}`);
            values.push(params.type);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY aggregate_id ASC, aggregate_version ASC'; 
        // Note: Sort order matches Mongo adapter default roughly? 
        // Mongo: sort({ 'aggregate.id': 1, 'aggregate.version': 1 })
        
        // We'll release client after query in simple mode. 
        // Real implementation should probably use pg-cursor for true streaming.
        
        const res = await client.query(query, values);
        client.release();

        async function* generator() {
            for (const row of res.rows) {
                yield {
                    id: EventId.from(row.id),
                    type: row.type,
                    aggregate: {
                        id: row.aggregate_id,
                        version: row.aggregate_version,
                    },
                    body: _this.deserialize(row.body),
                    meta: _this.deserialize(row.meta),
                    timestamp: row.timestamp,
                } as unknown as TEvent;
            }
        }

        return generator();
    }

    async saveSnapshot(params: Snapshot): Promise<void> {
        await this.saveSnapshotQueue.add(async () => {
             const client = await this.pool.connect();
             try {
                await client.query(
                    `INSERT INTO snapshots (aggregate_id, aggregate_version, state, timestamp)
                     VALUES ($1, $2, $3, $4)`,
                    [
                        params.aggregate.id,
                        params.aggregate.version,
                        JSON.stringify(this.serialize(params.state)),
                        params.timestamp
                    ]
                );
             } finally {
                client.release();
             }
        });
    }

    async findLatestSnapshot<TState = unknown>(params: { aggregate: { id: Buffer; version: number; }; }): Promise<Snapshot<TState> | null> {
         const client = await this.pool.connect();
         try {
             const res = await client.query(
                 `SELECT * FROM snapshots 
                  WHERE aggregate_id = $1 AND aggregate_version > $2
                  ORDER BY aggregate_version DESC
                  LIMIT 1`,
                 [params.aggregate.id, params.aggregate.version]
             );

             if (res.rowCount === 0) return null;

             const row = res.rows[0];
             return {
                 aggregate: {
                     id: row.aggregate_id,
                     version: row.aggregate_version,
                 },
                 state: this.deserialize(row.state) as TState,
                 timestamp: row.timestamp,
             };
         } finally {
             client.release();
         }
    }

    async saveProjectionCheckpoint(params: { projection: string; aggregate: { id: Buffer; version: number; }; }): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(
                `INSERT INTO projection_checkpoints (projection, aggregate_id, aggregate_version, timestamp)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (projection, aggregate_id) 
                 DO UPDATE SET aggregate_version = $3, timestamp = NOW()`,
                [params.projection, params.aggregate.id, params.aggregate.version]
            );
        } finally {
            client.release();
        }
    }

    async checkProjectionCheckpoint(params: { projection: string; aggregate: { id: Buffer; version: number; }; }): Promise<boolean> {
        const client = await this.pool.connect();
        try {
            const res = await client.query(
                `SELECT 1 FROM projection_checkpoints 
                 WHERE projection = $1 AND aggregate_id = $2 AND aggregate_version >= $3
                 LIMIT 1`,
                [params.projection, params.aggregate.id, params.aggregate.version]
            );
            return res.rowCount === 0;
        } finally {
            client.release();
        }
    }

    async finalizeAggregate(params: { id: Buffer; }): Promise<void> {
        await backOff(async () => {
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                
                await client.query('UPDATE aggregates SET final = TRUE WHERE id = $1', [params.id]);
                await client.query('UPDATE events SET final = TRUE WHERE aggregate_id = $1', [params.id]);

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }, {
             retry: (err) => ['40001', '40P01'].includes((err as any).code),
             ...this.opts
        });
    }

    async close(): Promise<void> {
        await this.saveSnapshotQueue.onIdle();
        await this.pool.end();
    }
}
