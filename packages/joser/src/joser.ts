import { ObjectId } from '@exodus/object-id';
import { Joser, Serializer } from '@scaleforge/joser';
import Decimal from 'decimal.js';

export const joser = new Joser({
  serializers: [
    <Serializer<ObjectId, Array<number>>>{
      type: ObjectId,
      name: 'ObjectId',
      serialize: (value) => value.buffer.toJSON().data,
      deserialize: (value) => {
        if (typeof value === 'string') {
          return ObjectId.from(value);
        }

        return ObjectId.from(Buffer.from(value));
      },
    },
    <Serializer<Decimal, string>>{
      type: Decimal,
      name: 'Decimal',
      serialize: (value: Decimal) => value.toString(),
      deserialize: (value: string) => new Decimal(value),
    },
  ],
});
