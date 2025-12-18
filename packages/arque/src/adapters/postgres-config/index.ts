import { ConfigAdapter } from '../../core';
import { Pool, PoolConfig } from 'pg';
import { LRUCache } from 'lru-cache';

export type PostgresConfigAdapterOptions = PoolConfig & {
    uri?: string;
    maxPoolSize?: number;
    cacheMax?: number;
    cacheTTL?: number;
};

export class PostgresConfigAdapter implements ConfigAdapter {
    private readonly pool: Pool;
    private readonly cache: LRUCache<number, string[]>;
    private readonly opts: PostgresConfigAdapterOptions;
    
    private _init: Promise<void>;

    constructor(opts?: PostgresConfigAdapterOptions) {
        this.opts = {
            cacheMax: 2500,
            cacheTTL: 1000 * 60 * 60,
            ...opts,
        };

        const poolConfig: PoolConfig = {
            ...this.opts,
            connectionString: this.opts.connectionString || this.opts.uri,
            max: this.opts.max || this.opts.maxPoolSize,
        };

        this.pool = new Pool(poolConfig);
        this.cache = new LRUCache({
            max: this.opts.cacheMax,
            ttl: this.opts.cacheTTL,
        });
    }

    async init(): Promise<void> {
        if (!this._init) {
            this._init = (async () => {
                const client = await this.pool.connect();
                try {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS streams (
                            id TEXT PRIMARY KEY,
                            events INTEGER[],
                            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                        );
                        CREATE INDEX IF NOT EXISTS idx_streams_events ON streams USING GIN(events);
                    `);
                } finally {
                    client.release();
                }
            })();
        }
        await this._init;
    }

    async saveStream(params: { id: string; events: number[] }): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(`
                INSERT INTO streams (id, events, timestamp)
                VALUES ($1, $2, NOW())
                ON CONFLICT (id) DO UPDATE SET events = $2, timestamp = NOW()
            `, [params.id, params.events]);
        } finally {
            client.release();
        }
    }

    async findStreams(event: number): Promise<string[]> {
        let streams = this.cache.get(event);
        if (streams) return streams;

        const client = await this.pool.connect();
        try {
            const res = await client.query(`
                SELECT id FROM streams WHERE $1 = ANY(events)
            `, [event]);
            
            streams = res.rows.map(r => r.id);
            this.cache.set(event, streams);
            return streams;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
