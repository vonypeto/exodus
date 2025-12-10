import { describe, test, expect } from '@jest/globals';
import { MongooseRepository } from './libs/mongoose.repository';
import { ObjectId as GenObjectId } from '@genesis/object-id';
import { Types } from 'mongoose';

describe('MongooseRepository ObjectId support', () => {
  test('toObjectId handles @genesis/object-id and base58 strings', () => {
    const repo = Object.create(MongooseRepository.prototype);

    const gen = GenObjectId.generate();
    const asBuffer = repo['toObjectId'](gen);
    expect(Buffer.isBuffer(asBuffer)).toBe(true);
    expect((asBuffer as Buffer).length).toBe(16);

    const asBufferFromStr = repo['toObjectId'](gen.toString());
    expect(Buffer.isBuffer(asBufferFromStr)).toBe(true);
    expect((asBufferFromStr as Buffer).length).toBe(16);

    const hex = new Types.ObjectId().toHexString();
    const mongoId = repo['toObjectId'](hex);
    expect(mongoId).toBeInstanceOf(Types.ObjectId);
  });

  test('mapDocument maps _id Buffer -> base58 id', () => {
    const repo = Object.create(MongooseRepository.prototype);

    const gen = GenObjectId.generate();
    const doc = {
      toObject: () => ({ _id: gen.buffer, foo: 'bar' }),
    }; // mimic Mongoose Document

    const mapped = repo['mapDocument'](doc);
    expect(mapped.id).toEqual(gen.toString());
    expect(mapped._id).toBeUndefined();
    expect(mapped.foo).toBe('bar');
  });

  test('mapDocument maps _id ObjectId -> hex id', () => {
    const repo = Object.create(MongooseRepository.prototype);

    const mongoId = new Types.ObjectId();
    const doc = {
      toObject: () => ({ _id: mongoId, foo: 'baz' }),
    };

    const mapped = repo['mapDocument'](doc);
    expect(mapped.id).toEqual(mongoId.toHexString());
    expect(mapped._id).toBeUndefined();
    expect(mapped.foo).toBe('baz');
  });
});
