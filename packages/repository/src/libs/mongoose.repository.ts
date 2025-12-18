import {
  Connection,
  Schema,
  Model,
  Document,
  UpdateQuery,
  Types,
} from 'mongoose';
import type { FilterQuery } from 'mongoose';
import { FindOptions, Repository } from './types';
import { ObjectId } from '@exodus/object-id';

export class MongooseRepository<T> implements Repository<T> {
  protected model: Model<any>;

  constructor(
    connection: Connection,
    modelName: string,
    schemaDefinition: Record<string, any>,
    indexes?: Array<[Record<string, any>, Record<string, any>?]>
  ) {
    const schema = new Schema(schemaDefinition, {
      timestamps: true,
      collection: modelName.toLowerCase() + 's',
    });

    if (indexes) {
      indexes.forEach(([fields, options]) => {
        schema.index(fields, options || {});
      });
    }

    this.model = connection.model(modelName, schema);
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const payload = this.prepareData(data);
      const doc = new this.model(payload);
      const saved = await doc.save();
      return this.mapDocument(saved);
    } catch (error) {
      throw new Error(
        `Failed to create document: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    try {
      const payloads = data.map((d) => this.prepareData(d));
      const docs = await this.model.insertMany(payloads);
      return docs.map((doc) => this.mapDocument(doc));
    } catch (error) {
      throw new Error(
        `Failed to create documents: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async find(
    filter: FilterQuery<T> | string | Buffer,
    options?: FindOptions
  ): Promise<T | T[]> {
    let docs;
    let query;
    if (typeof filter === 'string' || filter instanceof Buffer) {
      // treat as id
      const normalizedId = this.toObjectId(filter);
      query = this.model.find({ _id: normalizedId });
    } else {
      query = this.model.find(this.normalizeFilter(filter));
    }
    if (options) {
      if (options.skip !== undefined) {
        query = query.skip(options.skip);
      }
      if (options.limit !== undefined) {
        query = query.limit(options.limit);
      }
      if (options.sort !== undefined) {
        query = query.sort(options.sort);
      }
      if (options?.arr) {
        docs = await query.exec();
        return docs.map((doc) => this.mapDocument(doc));
      }
    }
    docs = await query.exec();
    if (!docs || (Array.isArray(docs) && docs.length === 0)) {
      return null;
    }
    if (docs.length === 1) {
      return this.mapDocument(docs[0]);
    }
    return docs.map((doc) => this.mapDocument(doc));
  }

  async update(
    filter: FilterQuery<T> | string | Buffer,
    update: UpdateQuery<T>,
    options?: { upsert?: boolean; new?: boolean; setDefaultsOnInsert?: boolean }
  ): Promise<T | T[]> {
    try {
      let docs;
      if (typeof filter === 'string' || filter instanceof Buffer) {
        const normalizedId = this.toObjectId(filter);
        const doc = await this.model
          .findByIdAndUpdate(normalizedId as any, update, {
            new: true,
            ...options,
          })
          .exec();
        docs = doc ? [doc] : [];
      } else {
        docs = await this.model.find(this.normalizeFilter(filter)).exec();
        if (docs.length === 1) {
          const updated = await this.model
            .findOneAndUpdate(this.normalizeFilter(filter), update, {
              new: true,
              ...options,
            })
            .exec();
          docs = updated ? [updated] : [];
        } else if (docs.length > 1) {
          await this.model
            .updateMany(this.normalizeFilter(filter), update, options)
            .exec();
          docs = await this.model.find(this.normalizeFilter(filter)).exec();
        }
      }
      if (docs.length === 1) {
        return this.mapDocument(docs[0]);
      }
      return docs.map((doc) => this.mapDocument(doc));
    } catch (error) {
      throw new Error(
        `Failed to update document(s): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async delete(filter: FilterQuery<T> | string | Buffer): Promise<T | T[]> {
    try {
      let docs;
      if (typeof filter === 'string' || filter instanceof Buffer) {
        const normalizedId = this.toObjectId(filter);
        const doc = await this.model
          .findByIdAndDelete(normalizedId as any)
          .exec();
        docs = doc ? [doc] : [];
      } else {
        docs = await this.model.find(this.normalizeFilter(filter)).exec();
        if (docs.length === 1) {
          const deleted = await this.model
            .findOneAndDelete(this.normalizeFilter(filter))
            .exec();
          docs = deleted ? [deleted] : [];
        } else if (docs.length > 1) {
          await this.model.deleteMany(this.normalizeFilter(filter)).exec();
          docs = [];
        }
      }
      if (docs.length === 1) {
        return this.mapDocument(docs[0]);
      }
      return docs.map((doc) => this.mapDocument(doc));
    } catch (error) {
      throw new Error(
        `Failed to delete document(s): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model
      .countDocuments(this.normalizeFilter(filter))
      .limit(1)
      .exec();
    return count > 0;
  }

  async count(filter?: FilterQuery<T>): Promise<number> {
    if (filter) {
      return this.model.countDocuments(this.normalizeFilter(filter)).exec();
    }
    return this.model.countDocuments().exec();
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.model.aggregate(pipeline).exec();
  }

  private normalizeFilter(filter: FilterQuery<T>): FilterQuery<T> {
    if (!filter || typeof filter !== 'object') return filter;
    const cloned: Record<string, unknown> = {
      ...(filter as Record<string, unknown>),
    };
    if ('id' in cloned) {
      const idVal = cloned['id'];
      delete cloned['id'];
      cloned['_id'] = this.normalizeIdOperator(idVal);
    }
    return cloned as FilterQuery<T>;
  }

  private normalizeIdOperator(value: unknown): unknown {
    if (value instanceof ObjectId) {
      return value.buffer;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.toObjectId(v));
    }
    if (value && typeof value === 'object') {
      const inObj = value as Record<string, unknown>;
      const outObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(inObj)) {
        if (key === '$in' || key === '$nin') {
          outObj[key] = Array.isArray(val)
            ? (val as unknown[]).map((v) => this.toObjectId(v))
            : val;
        } else if (key === '$eq' || key === '$ne') {
          outObj[key] = this.toObjectId(val);
        } else {
          outObj[key] = val;
        }
      }
      return outObj;
    }
    return this.toObjectId(value);
  }

  private toObjectId(value: unknown): unknown {
    if (value instanceof ObjectId) {
      // Already an oxodus ObjectId, return its buffer
      return value.buffer;
    }
    if (typeof value === 'string') {
      // Try to parse as oxodus ObjectId (base58 or hex)
      try {
        const parsed = ObjectId.from(value);
        return parsed.buffer;
      } catch (_) {
        // not a valid oxodus ObjectId, fall through
      }
    }
    if (value instanceof Buffer) {
      // If 12 bytes, treat as ObjectId buffer
      if (value.length === 12) {
        try {
          return ObjectId.from(value).buffer;
        } catch (_) {
          return value;
        }
      }
      return value;
    }
    return value;
  }

  protected mapDocument(doc: Document | null): T {
    if (!doc) {
      return null as unknown as T;
    }
    const obj = doc.toObject();

    // Recursively convert ObjectId to string for serialization
    const convertObjectIds = (value: any): any => {
      if (value instanceof ObjectId) {
        return value.toString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value && typeof value === 'object') {
        if (value instanceof Buffer && value.length === 12) {
          try {
            return ObjectId.from(value).toString();
          } catch (_) {
            return value;
          }
        }
        if (Array.isArray(value)) {
          return value.map(convertObjectIds);
        }
        const result: any = {};
        for (const key of Object.keys(value)) {
          result[key] = convertObjectIds(value[key]);
        }
        return result;
      }
      return value;
    };

    if (obj._id !== undefined) {
      const rawId = obj._id;
      try {
        obj.id = ObjectId.from(rawId.buffer ?? rawId).toString();
      } catch (_) {
        obj.id = rawId;
      }
      delete obj._id;
    }

    // Recursively convert all ObjectIds in the object
    return convertObjectIds(obj) as T;
  }

  private prepareData(data: Partial<T>): Partial<T> {
    // Only convert ObjectId instances and Buffers, NOT all strings
    const convertToObjectIds = (value: any): any => {
      if (value instanceof ObjectId) {
        // Handle ObjectId instances directly
        return value.buffer;
      }
      if (value instanceof Buffer) {
        // Already a Buffer, return as-is
        return value;
      }
      // Don't convert strings - they should remain as strings
      // Only the 'id' field gets special handling below
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // For plain objects, recursively process
        const result: any = {};
        for (const key of Object.keys(value)) {
          result[key] = convertToObjectIds(value[key]);
        }
        return result;
      }
      if (Array.isArray(value)) {
        return value.map(convertToObjectIds);
      }
      return value;
    };

    const payload: any = { ...(data as any) };
    if ('id' in payload && payload.id !== undefined) {
      const normalized = this.toObjectId(payload.id);
      delete payload.id;
      payload._id = normalized;
    }
    // Only convert ObjectId instances and Buffers, not regular strings
    return convertToObjectIds(payload) as Partial<T>;
  }
}
