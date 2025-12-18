import { ObjectId } from '@exodus/object-id';
import Decimal from 'decimal.js';
import { Binary, Decimal128 } from 'mongodb';

export const ArqueMongoStoreAdapterSerializers = [
  {
    type: ObjectId,
    name: 'ObjectId',
    serialize: (value: ObjectId) => value.buffer,
    deserialize: (value: Binary) => {
      return ObjectId.from(Buffer.from(<Uint8Array>value.buffer));
    },
  },
  {
    type: Decimal,
    name: 'Decimal',
    serialize: (value: Decimal) => new Decimal128(value.toString()),
    deserialize: (value: Decimal128) => new Decimal(value.toString()),
  },
];

export const ArquePostgresStoreAdapterSerializers = [
  {
    type: ObjectId,
    name: 'ObjectId',
    serialize: (value: ObjectId) => value.buffer,
    deserialize: (value: Binary) => {
      return ObjectId.from(Buffer.from(<Uint8Array>value.buffer));
    },
  },
  {
    type: Decimal,
    name: 'Decimal',
    serialize: (value: Decimal) => new Decimal128(value.toString()),
    deserialize: (value: Decimal128) => new Decimal(value.toString()),
  },
];

export const ArqueKafkaStreamAdapterSerializers = [
  {
    type: ObjectId,
    name: 'ObjectId',
    serialize: (value: ObjectId) => value.buffer.toString('base64'),
    deserialize: (value: string) => ObjectId.from(Buffer.from(value, 'base64')),
  },
  {
    type: Decimal,
    name: 'Decimal',
    serialize: (value: Decimal) => value.toString(),
    deserialize: (value: string) => new Decimal(value),
  },
];
