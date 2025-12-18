// Maps Mongo-like filter operators to SQL expressions

import {
  Repository,
  FilterQuery,
  UpdateQuery,
  UpdateOptions,
  FindOptions,
} from './types';
import { Pool } from 'pg';
import { ObjectId as GenObjectId, ObjectId } from '@exodus/object-id';

const FILTERMAP: Record<string, (key: string, idx: number) => string> = {
  $gt: (key, idx) => `"${key}" > $${idx}`,
  $gte: (key, idx) => `"${key}" >= $${idx}`,
  $lt: (key, idx) => `"${key}" < $${idx}`,
  $lte: (key, idx) => `"${key}" <= $${idx}`,
  $in: (key, idx) => `"${key}" = ANY($${idx})`,
  $nin: (key, idx) => `NOT ("${key}" = ANY($${idx}))`,
  $ne: (key, idx) => `"${key}" <> $${idx}`,
  $eq: (key, idx) => `"${key}" = $${idx}`,
  $regex: (key, idx) => `"${key}" ILIKE $${idx}`,
};

export class PostgresRepository<T extends { id?: string | Buffer | ObjectId }>
  implements Repository<T>
{
  constructor(
    private readonly pool: Pool,
    private readonly tableName: string,
    private readonly schemaDefinition: Record<string, any>
  ) {}

  async initialize(): Promise<void> {
    await this.syncSchema();
  }

  private async syncSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Check if table exists
      const tableExistsRes = await client.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = $1
         );`,
        [this.tableName]
      );

      if (!tableExistsRes.rows[0].exists) {
        // Create table

        const hasId = Object.keys(this.schemaDefinition).includes('id');
        let idColumn = '"id" BYTEA PRIMARY KEY';
        if (hasId) {
          // Use the type from schemaDefinition for id
          const idType = this.schemaDefinition['id'];
          idColumn = `"id" ${this.mapTypeToPostgres(idType)} PRIMARY KEY`;
        }
        const columns = Object.entries(this.schemaDefinition)
          .filter(([key]) => key !== 'id') // filter out id if present
          .map(([key, type]) => {
            const pgType = this.mapTypeToPostgres(type);
            return `"${key}" ${pgType}`;
          })
          .join(', ');

        const createSql = `CREATE TABLE "${this.tableName}" (
          ${idColumn},
          ${columns}
          ${columns ? ',' : ''} "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW()
        );`;

        await client.query(createSql);
      } else {
        // Alter table - add missing columns
        const columnsRes = await client.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1;`,
          [this.tableName]
        );
        const existingColumns = new Set(
          columnsRes.rows.map((r) => r.column_name)
        );

        for (const [key, type] of Object.entries(this.schemaDefinition)) {
          if (!existingColumns.has(key)) {
            const pgType = this.mapTypeToPostgres(type);
            await client.query(
              `ALTER TABLE "${this.tableName}" ADD COLUMN "${key}" ${pgType};`
            );
          }
        }
      }
    } finally {
      client.release();
    }
  }

  private mapTypeToPostgres(type: any): string {
    if (type === String || (type.type && type.type === String)) return 'TEXT';
    if (type === Number || (type.type && type.type === Number))
      return 'NUMERIC';
    if (type === Boolean || (type.type && type.type === Boolean))
      return 'BOOLEAN';
    if (type === Date || (type.type && type.type === Date)) return 'TIMESTAMP';

    if (
      type === Buffer ||
      (typeof Buffer !== 'undefined' && type && type.name === 'Buffer')
    )
      return 'BYTEA';
    if (type && (type.name === 'ObjectId' || type === ObjectId)) return 'BYTEA';
    return 'JSONB'; // Fallback for complex objects/arrays
  }

  async create(data: Partial<T>): Promise<T> {
    const id = data.id || ObjectId.generate();
    const now = new Date();
    const dataWithoutId = { ...data };
    if ('id' in dataWithoutId) delete dataWithoutId.id;
    // Only store id as Buffer, all other ObjectId as string
    const safeData = Object.fromEntries(
      Object.entries(dataWithoutId).map(([k, v]) => [
        k,
        v instanceof ObjectId ? v.toString() : v,
      ])
    );
    const idValue = id instanceof ObjectId ? id.buffer : id;
    const keys = ['id', ...Object.keys(safeData), 'created_at', 'updated_at'];
    const values = [idValue, ...Object.values(safeData), now, now];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.map((k) => `"${k}"`).join(', ');

    const query = `INSERT INTO "${this.tableName}" (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING RETURNING *;`;
    console.log('Insert Query:', query, 'Values:', values);
    const res = await this.pool.query(query, values);
    // If nothing was inserted (duplicate), try to fetch the existing row
    if (res.rows.length === 0) {
      const existing = await this.findById(idValue);
      if (existing) return existing;
      throw new Error('Failed to insert or find existing row');
    }
    return this.mapRow(res.rows[0]);
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    const results: T[] = [];
    for (const item of data) {
      results.push(await this.create(item));
    }
    return results;
  }

  async find(
    filter: FilterQuery<T> | string | Buffer,
    options?: FindOptions
  ): Promise<T | T[]> {
    let whereClause = '';
    let values: any[] = [];
    let singleId = false;
    if (typeof filter === 'string' || Buffer.isBuffer(filter)) {
      // treat as id
      whereClause = 'WHERE id = $1';
      values = [filter];
      singleId = true;
    } else {
      const built = this.buildWhereClause(filter as FilterQuery<T>);
      whereClause = built.whereClause;
      values = built.values;
    }
    let query = `SELECT * FROM "${this.tableName}" ${whereClause}`;
    if (options) {
      if (options.sort) {
        const sortFields = Object.entries(options.sort)
          .map(([k, v]) => `"${k}" ${v === -1 ? 'DESC' : 'ASC'}`)
          .join(', ');
        if (sortFields) query += ` ORDER BY ${sortFields}`;
      }
      if (options.limit !== undefined) {
        query += ` LIMIT ${options.limit}`;
      }
      if (options.skip !== undefined) {
        query += ` OFFSET ${options.skip}`;
      }
    }
    query += ';';
    const res = await this.pool.query(query, values);
    if (singleId) {
      if (!res.rows[0]) return null;
      return this.mapRow(res.rows[0]);
    }
    if (options && options.arr) {
      return res.rows.map((row) => this.mapRow(row));
    }
    if (res.rows.length === 1) return this.mapRow(res.rows[0]);
    return res.rows.map((row) => this.mapRow(row));
  }

  async findOne(filter: FilterQuery<T>): Promise<T> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `SELECT * FROM "${this.tableName}" ${whereClause} LIMIT 1;`;
    const res = await this.pool.query(query, values);
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string | Buffer | ObjectId): Promise<T> {
    // id as Buffer for BYTEA, else string
    const idValue = id instanceof ObjectId ? id.buffer : id;
    const res = await this.pool.query(
      `SELECT * FROM "${this.tableName}" WHERE id = $1;`,
      [idValue]
    );
    return this.mapRow(res.rows[0]);
  }

  async update(
    filter: FilterQuery<T> | string | Buffer,
    update: UpdateQuery<T>,
    options?: UpdateOptions
  ): Promise<T | T[]> {
    let ids: (string | Buffer)[] = [];
    if (typeof filter === 'string' || Buffer.isBuffer(filter)) {
      ids = [filter];
    } else {
      const found = await this.find(filter, { arr: true });
      ids = (found as T[]).map((item) => (item as any).id);
    }
    const updateInput = update as any;
    let dataToUpdate = { ...updateInput };
    if (updateInput.$set) {
      dataToUpdate = { ...dataToUpdate, ...updateInput.$set };
      delete dataToUpdate.$set;
    }
    const results: T[] = [];
    for (const id of ids) {
      const keys = Object.keys(dataToUpdate);
      if (keys.length === 0) {
        const found = await this.find(id);
        if (found) results.push(found as T);
        continue;
      }
      const safeData = Object.fromEntries(
        Object.entries(dataToUpdate).map(([k, v]) => [
          k,
          v instanceof ObjectId ? v.toString() : v,
        ])
      );
      const idValue = id instanceof ObjectId ? id.buffer : id;
      const setClause = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const values = [idValue, ...Object.values(safeData)];
      const query = `UPDATE "${this.tableName}" SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *;`;
      const res = await this.pool.query(query, values);
      if (res.rowCount === 0 && options?.upsert) {
        const created = await this.create({
          ...safeData,
          id: idValue,
        } as Partial<T>);
        results.push(created);
      } else if (res.rows[0]) {
        results.push(this.mapRow(res.rows[0]));
      }
    }
    if (results.length === 1) return results[0];
    return results;
  }

  async delete(filter: FilterQuery<T> | string | Buffer): Promise<T | T[]> {
    let ids: (string | Buffer)[] = [];
    if (typeof filter === 'string' || Buffer.isBuffer(filter)) {
      ids = [filter];
    } else {
      const found = await this.find(filter, { arr: true });
      ids = (found as T[]).map((item) => (item as any).id);
    }
    const results: T[] = [];
    for (const id of ids) {
      const res = await this.pool.query(
        `DELETE FROM "${this.tableName}" WHERE id = $1 RETURNING *;`,
        [id]
      );
      if (res.rows[0]) results.push(this.mapRow(res.rows[0]));
    }
    if (results.length === 1) return results[0];
    return results;
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const res = await this.findOne(filter);
    return !!res;
  }

  async countAll(): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*) FROM "${this.tableName}";`
    );
    return parseInt(res.rows[0].count, 10);
  }

  async countWithFilter(filter: FilterQuery<T>): Promise<number> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `SELECT COUNT(*) FROM "${this.tableName}" ${whereClause};`;
    const res = await this.pool.query(query, values);
    return parseInt(res.rows[0].count, 10);
  }

  private mapRow(row: any): T {
    if (!row) return null as any;
    // Convert id Buffer to string if needed
    if (row.id && Buffer.isBuffer(row.id)) {
      try {
        row.id = GenObjectId.from(row.id).toString();
      } catch {
        row.id = row.id.toString('hex');
      }
    }
    return row as T;
  }

  private buildWhereClause(filter: FilterQuery<T>): {
    whereClause: string;
    values: any[];
  } {
    if (!filter || Object.keys(filter as object).length === 0) {
      return { whereClause: '', values: [] };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Support $or at the top level
    if ('$or' in filter && Array.isArray((filter as any).$or)) {
      const orClauses: string[] = [];
      const orValues: any[] = [];
      for (const sub of (filter as any).$or) {
        const subResult = this.buildWhereClause(sub);
        if (subResult.whereClause) {
          orClauses.push(subResult.whereClause.replace(/^WHERE /, ''));
          orValues.push(...subResult.values);
        }
      }
      if (orClauses.length) {
        conditions.push('(' + orClauses.join(' OR ') + ')');
        values.push(...orValues);
      }
    }

    for (const [key, value] of Object.entries(filter as Record<string, any>)) {
      if (key === '$or') continue;

      // Special handling for id: use Buffer for BYTEA columns
      if (key === 'id') {
        const idType = this.schemaDefinition['id'];
        const isBytea = this.mapTypeToPostgres(idType) === 'BYTEA';
        const toDbId = (v: any) => {
          if (isBytea) {
            if (v instanceof ObjectId) return v.buffer;
            if (Buffer.isBuffer(v)) return v;
            if (typeof v === 'string') return ObjectId.from(v).buffer;
            return v;
          } else {
            if (v instanceof ObjectId) return v.toString();
            if (Buffer.isBuffer(v)) return ObjectId.from(v).toString();
            return typeof v === 'string' ? v : String(v);
          }
        };
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const opObj = value as any;
          if (opObj.$in && Array.isArray(opObj.$in)) {
            const list = opObj.$in.map((v: any) => toDbId(v));
            conditions.push(`"id" = ANY($${idx++})`);
            values.push(list);
          } else if (opObj.$eq !== undefined) {
            conditions.push(`"id" = $${idx++}`);
            values.push(toDbId(opObj.$eq));
          } else if (opObj.$ne !== undefined) {
            conditions.push(`"id" <> $${idx++}`);
            values.push(toDbId(opObj.$ne));
          } else {
            conditions.push(`"id" = $${idx++}`);
            values.push(toDbId(opObj));
          }
        } else {
          conditions.push(`"id" = $${idx++}`);
          values.push(toDbId(value));
        }
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        for (const [op, v] of Object.entries(value)) {
          if (FILTERMAP[op]) {
            if (op === '$regex') {
              conditions.push(FILTERMAP[op](key, idx));
              values.push(`%${v}%`);
            } else {
              conditions.push(FILTERMAP[op](key, idx));
              values.push(v);
            }
            idx++;
          }
          // fallback unsupported: skip
        }
      } else {
        // equality
        conditions.push(`"${key}" = $${idx++}`);
        values.push(value);
      }
    }

    if (conditions.length === 0) return { whereClause: '', values: [] };

    return {
      whereClause: 'WHERE ' + conditions.join(' AND '),
      values,
    };
  }

  private toIdString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (value instanceof GenObjectId) {
      return value.toString();
    }
    if (Buffer.isBuffer(value)) {
      try {
        return GenObjectId.from(value).toString();
      } catch {
        return value.toString('hex');
      }
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }
}
