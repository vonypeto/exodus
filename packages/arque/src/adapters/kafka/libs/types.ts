import { Event as GlobalEvent } from '../../../core';

export type Event = Pick<GlobalEvent, 'id' | 'type' | 'aggregate' | 'meta' | 'timestamp'> & { body: Buffer | Record<string, unknown> | null };