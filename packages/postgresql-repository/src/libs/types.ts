export type FilterQuery<T> = Partial<T> | Record<string, any>;
export type UpdateQuery<T> =
  | Partial<T>
  | { $set: Partial<T> }
  | Record<string, any>;

export interface UpdateOptions {
  upsert?: boolean;
  new?: boolean;
}

export interface UpdateManyOptions {
  upsert?: boolean;
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
  countAll(): Promise<number>;
  countWithFilter(filter: FilterQuery<T>): Promise<number>;
}
