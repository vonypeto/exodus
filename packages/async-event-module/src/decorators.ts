/* eslint-disable @typescript-eslint/no-wrapper-object-types */
import { SetMetadata } from '@nestjs/common';
import R from 'ramda';

export function AsyncEventHandler(
  event: string,
  opts?: {
    deduplication?: {
      ttl?: number;
    } | null;
  },
) {
  return function (
    target: Object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    SetMetadata('AsyncEventHandler', [
      event,
      R.mergeLeft(opts ?? {}, {
        deduplication: null,
      }),
    ])(target, propertyKey, descriptor);
  };
}
