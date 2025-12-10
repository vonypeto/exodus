export type FilterQuery<T> = Partial<T> | Record<string, any>;
export type UpdateQuery<T> = Partial<T> | { $set: Partial<T> } | Record<string, any>;

export interface UpdateOptions {
  upsert?: boolean;
  new?: boolean;
}

export interface UpdateManyOptions {
  upsert?: boolean;
}

export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  createMany(data: Partial<T>[]): Promise<T[]>;
  findAll(page?: number, limit?: number): Promise<T[]>;

  find(filter: FilterQuery<T>): Promise<T[]>;
  findOne(filter: FilterQuery<T>): Promise<T>;
  findById(id: string | Buffer): Promise<T>;
  
  update(
    id: string | Buffer,
    data: Partial<T>,
    options?: UpdateOptions
  ): Promise<T | null>;
  
  updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: UpdateOptions
  ): Promise<T | null>;
  
  updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: UpdateManyOptions
  ): Promise<{ modifiedCount: number; upsertedCount: number }>;
  
  delete(id: string | Buffer): Promise<T | null>;
  deleteOne(filter: FilterQuery<T>): Promise<T | null>;
  deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }>;
  
  exists(filter: FilterQuery<T>): Promise<boolean>;
  countAll(): Promise<number>;
  countWithFilter(filter: FilterQuery<T>): Promise<number>;
  aggregate(pipeline: any[]): Promise<any[]>;
}
