import { Repository, FilterQuery, UpdateQuery } from './types';
import { Pool } from 'pg';
import { ObjectId as GenObjectId, ObjectId } from '@genesis/object-id';

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

  async findAll(page: number = 1, limit: number = 10): Promise<T[]> {
    const offset = (page - 1) * limit;
    const res = await this.pool.query(
      `SELECT * FROM "${this.tableName}" LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );
    return res.rows.map(this.mapRow);
  }

  async find(filter: FilterQuery<T>): Promise<T[]> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `SELECT * FROM "${this.tableName}" ${whereClause};`;
    const res = await this.pool.query(query, values);
    return res.rows.map(this.mapRow);
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
    id: string | Buffer,
    data: Partial<T>,
    options?: any
  ): Promise<T | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return this.findById(id);

    // Only store id as Buffer, all other ObjectId as string
    const safeData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
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
      return this.create({ ...safeData, id: idValue } as Partial<T>);
    }

    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: any
  ): Promise<T | null> {
    // Handling update operators like $set is complex.
    // We handle $set manually to support Mongoose-like syntax.
    const updateInput = update as any;
    let dataToUpdate = { ...updateInput };

    if (updateInput.$set) {
      dataToUpdate = { ...dataToUpdate, ...updateInput.$set };
      delete dataToUpdate.$set;
    }

    // First find matching
    const found = await this.findOne(filter);
    if (!found) {
      if (options?.upsert) {
        return this.create(dataToUpdate);
      }
      return null;
    }

    // Use Buffer for id if schema expects BYTEA
    const idType = this.schemaDefinition['id'];
    const isBytea = this.mapTypeToPostgres(idType) === 'BYTEA';
    let updateId = found.id;
    if (isBytea) {
      if (updateId instanceof ObjectId) updateId = updateId.buffer;
      else if (typeof updateId === 'string')
        updateId = ObjectId.from(updateId).buffer;
    }
    return this.update(
      isBytea
        ? updateId instanceof ObjectId
          ? updateId.buffer
          : typeof updateId === 'string'
          ? ObjectId.from(updateId).buffer
          : updateId
        : updateId instanceof ObjectId
        ? updateId.toString()
        : Buffer.isBuffer(updateId)
        ? ObjectId.from(updateId).toString()
        : typeof updateId === 'string'
        ? updateId
        : String(updateId),
      dataToUpdate,
      options
    );
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: any
  ): Promise<{ modifiedCount: number; upsertedCount: number }> {
    // Simplified implementation: find IDs, update loops. inefficient but safe for now.
    const items = await this.find(filter);
    let modifiedCount = 0;
    for (const item of items) {
      await this.update(this.toIdString(item.id!), update as any); // reusing logic
      modifiedCount++;
    }
    // Upsert logic for many is vague in mongo if 0 matches.
    return { modifiedCount, upsertedCount: 0 };
  }

  async delete(id: string | Buffer): Promise<T | null> {
    const res = await this.pool.query(
      `DELETE FROM "${this.tableName}" WHERE id = $1 RETURNING *;`,
      [id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    const found = await this.findOne(filter);
    if (found) {
      return this.delete(this.toIdString(found.id!));
    }
    return null;
  }

  async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    const { whereClause, values } = this.buildWhereClause(filter);
    const query = `DELETE FROM "${this.tableName}" ${whereClause};`;
    const res = await this.pool.query(query, values);
    return { deletedCount: res.rowCount || 0 };
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

  async aggregate(pipeline: any[]): Promise<any[]> {
    throw new Error(
      'Aggregation not fully supported in PostgresRepository yet'
    );
  }

  private mapRow(row: any): T {
    if (!row) return null as any;
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

    // Normalized filter is usually passed.
    for (const [key, value] of Object.entries(filter as Record<string, any>)) {
      if (key === '$or') {
        // value is array
        // not implemented
        continue;
      }

      // Special handling for id: use Buffer for BYTEA columns
      if (key === 'id') {
        // Determine if id column is BYTEA
        const idType = this.schemaDefinition['id'];
        const isBytea = this.mapTypeToPostgres(idType) === 'BYTEA';
        const toDbId = (v: any) => {
          if (isBytea) {
            if (v instanceof ObjectId) return v.buffer;
            if (Buffer.isBuffer(v)) return v;
            // Accept string: convert to ObjectId then buffer
            if (typeof v === 'string') return ObjectId.from(v).buffer;
            return v;
          } else {
            // Fallback to string
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
            // fallback equality if unrecognized operator
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
        // basic operators for non-id fields can be added here
        // fallback unsupported: skip
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
