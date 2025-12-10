import Redlock from 'redlock';
import { Joser } from '@scaleforge/joser';

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
};

/**
 * Creates an idempotent function.
 * @param redis redis client
 * @param redlock redlock client
 * @param joser joser instance
 * @param opts.cacheDuration cache duration in seconds
 * @param opts.retryCount retry count for redlock
 * @param opts.retryDelay retry delay for redlock
 * @returns idempotent function
 */
export function idempotency(
  redis: RedisLike,
  redlock: Redlock,
  joser: Joser,
  opts?: {
    cacheDuration?: number;
    retryCount?: number;
    retryDelay?: number;
  }
) {
  return <T>(key: string, handler: () => Promise<T>): Promise<T> =>
    redlock.using(
      [`lock.${key}`],
      5000,
      {
        retryCount: opts?.retryCount ?? 10,
        retryDelay: opts?.retryDelay ?? 200,
        automaticExtensionThreshold: 200,
        retryJitter: (opts?.retryDelay ?? 200) * 0.5,
      },
      async () => {
        console.log(key);
        const result = await redis.get(key);

        if (result) {
          return <T>joser.deserialize(JSON.parse(result));
        }

        const value = await handler();

        await redis.set(
          key,
          JSON.stringify(joser.serialize(<never>value)),
          'EX',
          opts?.cacheDuration ?? 1800
        );

        return value;
      }
    );
}
