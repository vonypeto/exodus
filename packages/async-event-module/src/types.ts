import { Logger } from '@nestjs/common';
import { ObjectId } from '@exodus/object-id';

export type AsyncEventDispatcherModuleOptions = {
  id: string;
  /**
   * Redis connection options. This is required for the delayed or scheduled async events to function.
   */
  redis?:
    | {
        host: string;
        port?: number;
      }
    | {
        cluster: {
          nodes: { host: string; port: number }[];
        };
      };
  kafka: {
    brokers: string[];
    transactionTimeout?: number; // in milliseconds
  };
  bullmq?: {
    worker?: {
      concurrency?: number;
    };
  };
  categories?: { name: string; allocation: number }[];
  logger?: Logger;
};

export type AsyncEventModuleOptions = {
  context: string;
  kafka: {
    brokers: string[];
  };
  logger?: Logger;
  concurrency?: number;
  onAsyncEventReceived?: (event: AsyncEvent, context: string) => Promise<void>;
  onAsyncEventProcessed?: (event: AsyncEvent, context: string) => Promise<void>;
  redis?:
    | {
        host: string;
        port?: number;
      }
    | {
        cluster: {
          nodes: { host: string; port: number }[];
        };
      };
};

export type AsyncEvent<
  TType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>
> = {
  id: ObjectId;
  type: TType;
  payload: TPayload;
  opts?: { delay?: number; category?: 'LOW' | 'HIGH' };
  timestamp: Date;
};

export type AsyncEventOptions = {
  heartbeat: () => Promise<void>;
  timestamp: Date;
};

export type MemberAccountCreatedAsyncEvent = AsyncEvent<
  'MemberAccountCreated',
  {
    id: Buffer;
    email: string;
    username: string;
    password: string;
  }
>;

export type StartRunCreatedAsyncEvent = AsyncEvent<
  'StartRunCreated',
  {
    id: ObjectId;
    prompts: string[];
    brands: string[];
    models: string[];
    notes?: string;
  }
>;
