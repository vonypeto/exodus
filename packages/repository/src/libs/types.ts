import { FilterQuery, UpdateQuery } from 'mongoose';

export interface UpdateOptions {
  upsert?: boolean;
  new?: boolean;
  setDefaultsOnInsert?: boolean;
}

export interface FindOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  arr?: boolean;
}

export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  createMany(data: Partial<T>[]): Promise<T[]>;
  find(
    filter: FilterQuery<T> | string | Buffer,
    options?: FindOptions
  ): Promise<T | T[]>;
  update(
    filter: FilterQuery<T> | string | Buffer,
    update: UpdateQuery<T>,
    options?: UpdateOptions
  ): Promise<T | T[]>;
  delete(filter: FilterQuery<T> | string | Buffer): Promise<T | T[]>;
  exists(filter: FilterQuery<T>): Promise<boolean>;
  count(filter?: FilterQuery<T>): Promise<number>;
  aggregate(pipeline: any[]): Promise<any[]>;
}
