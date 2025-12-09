import Redis from 'ioredis';
import Redlock from 'redlock';
import { Joser } from '@scaleforge/joser';
import { idempotency } from '@genesis/idempotency';

export function Idempotency(key: (...args: unknown[]) => string) {
  return function (_: unknown, __: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;

    descriptor.value = async function (
      this: {
        redis: Redis;
        redlock: Redlock;
        joser: Joser;
      },
      ...args: unknown[]
    ) {
      return idempotency(
        this.redis,
        this.redlock,
        this.joser
      )(key(...args), async () => {
        const value = await original.apply(this, args);

        return value;
      });
    };
  };
}
