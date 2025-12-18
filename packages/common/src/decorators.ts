export function CatchError<A extends unknown[]>(
  handler?: (error: Error, ...args: A) => void | Promise<void>,
) {
  return function (_: unknown, __: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      try {
        const result = original.apply(this, args);

        if (result['then']) {
          await result;
        }

        return result;
      } catch (error) {
        if (handler) {
          await handler.apply(this, [error, ...args]);
        }
      }
    };

    return descriptor;
  };
}
