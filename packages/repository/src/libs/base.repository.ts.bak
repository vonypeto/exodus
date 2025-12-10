import mongoose, { Document, Model, FilterQuery, UpdateQuery } from 'mongoose';

export class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    const createdDocument = new this.model(data);
    return createdDocument.save();
  }

  async createMany(data: Partial<T>[]): Promise<T[]> {
    return this.model.insertMany(data) as unknown as Promise<T[]>;
  }

  async findAll(page: number = 1, limit: number = 10): Promise<T[]> {
    const skip = (page - 1) * limit;
    return this.model
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async findAllWithFilter(
    filter: FilterQuery<T>,
    page: number = 1,
    limit: number = 10
  ): Promise<T[]> {
    const skip = (page - 1) * limit;
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async countAll(): Promise<number> {
    return this.model.countDocuments().exec();
  }

  async countWithFilter(filter: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async findById(_id: mongoose.Types.ObjectId | string): Promise<T | null> {
    return this.model.findById(_id).exec() as Promise<T | null>;
  }

  async update(
    _id: mongoose.Types.ObjectId | string,
    data: Partial<T>
  ): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(_id, data, { new: true })
      .exec() as Promise<T | null>;
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(filter, update, { new: true }).exec();
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ modifiedCount: number }> {
    const result = await this.model.updateMany(filter, update).exec();
    return { modifiedCount: result.modifiedCount };
  }

  async delete(_id: mongoose.Types.ObjectId | string): Promise<T | null> {
    return this.model.findByIdAndDelete(_id).exec() as Promise<T | null>;
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOneAndDelete(filter).exec();
  }

  async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany(filter).exec();
    return { deletedCount: result.deletedCount };
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model.countDocuments(filter).limit(1).exec();
    return count > 0;
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.model.aggregate(pipeline).exec();
  }

  async transaction<R>(
    fn: (session: mongoose.ClientSession) => Promise<R>
  ): Promise<R> {
    const session = await this.model.db.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
