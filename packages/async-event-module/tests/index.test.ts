import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DeferredPromise } from '@open-draft/deferred-promise';
import { Logger } from '@opexa/logger';
import { ObjectId } from '@opexa/object-id';
import { delay } from '@opexa/util';
import { Kafka, logLevel } from 'kafkajs';
import {
  AsyncEvent,
  AsyncEventDispatcherModule,
  AsyncEventHandler,
  AsyncEventModule,
} from '../src';
import { AsyncEventDispatcherService } from '../src/async-event-dispatcher.service';

async function setupFixture() {
  const context = faker.word.noun();

  const kafka = new Kafka({
    brokers: ['localhost:19092'],
    logLevel: logLevel.ERROR,
  });

  const admin = kafka.admin();

  await admin.createTopics({
    topics: [{ topic: `async-event-${context}`, numPartitions: 4 }],
  });

  await admin.disconnect();

  const event = {
    id: ObjectId.generate(),
    type: `${faker.word.adjective()}${faker.word.noun()}${faker.word.verb()}`,
    payload: {
      message: faker.lorem.sentence(),
    },
    timestamp: new Date(),
  };

  const promise = new DeferredPromise<AsyncEvent>();

  @Injectable()
  class TestAsyncEventService {
    private count = 0;
    constructor(private readonly logger: Logger) {}

    @AsyncEventHandler(event.type, { deduplication: { ttl: 120_000 } })
    async handleAsyncEvent(_event: typeof event) {
      this.logger.info(`handle async event`, { event: _event });
      await promise.resolve(_event);
    }
  }

  const modules = await Promise.all([
    Test.createTestingModule({
      imports: [
        AsyncEventDispatcherModule.forRootAsync({
          useFactory: async () => ({
            id: faker.string.alphanumeric(12),
            redis: process.env.CI
              ? {
                  host: 'localhost',
                  port: 16379,
                }
              : {
                  cluster: {
                    nodes: [{ host: 'localhost', port: 16379 }],
                  },
                },
            kafka: {
              brokers: ['localhost:19092'],
              transactionTimeout: 15_000,
            },
            categories: [
              {
                name: 'HIGH',
                allocation: 3,
              },
              {
                name: 'LOW',
                allocation: 1,
              },
            ],
          }),
        }),
      ],
    }).compile(),
    Test.createTestingModule({
      imports: [
        AsyncEventModule.forRootAsync({
          useFactory: async () => ({
            kafka: {
              brokers: ['localhost:19092'],
            },
            context,
            redis: process.env.CI
              ? {
                  host: 'localhost',
                  port: 16379,
                }
              : {
                  cluster: {
                    nodes: [
                      {
                        host: 'localhost',
                        port: 16379,
                      },
                    ],
                  },
                },
          }),
        }),
      ],
      providers: [
        TestAsyncEventService,
        {
          provide: Logger,
          useFactory: async () => new Logger(['Test'], 'info'),
        },
      ],
    }).compile(),
  ]);

  await Promise.all(modules.map((module) => module.init()));

  const dispatcher = modules.at(0).get(AsyncEventDispatcherService);

  return {
    context,
    event,
    promise,
    dispatcher,
    teardown: async () => {
      await Promise.all(modules.map((module) => module.close()));
    },
  };
}

describe('AsyncEventModule', () => {
  test.concurrent(
    'dispatch',
    async () => {
      const { context, event, promise, dispatcher, teardown } =
        await setupFixture();

      await dispatcher.dispatch(context, event, { category: 'LOW' });

      await expect(promise).resolves.toEqual(event);

      await teardown();
    },
    30_000,
  );

  test.concurrent(
    'delayed dispatch',
    async () => {
      const { context, event, promise, dispatcher, teardown } =
        await setupFixture();

      await dispatcher.dispatch(context, event, {
        category: 'LOW',
        delay: 2_000,
      });

      await expect(promise).resolves.toEqual(event);

      await teardown();

      const delay = Date.now() - (await promise).timestamp.getTime();
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThan(3000);
    },
    30_000,
  );

  test.concurrent(
    'deduplication',
    async () => {
      const { context, event, promise, dispatcher, teardown } =
        await setupFixture();

      await dispatcher.dispatch(context, event, {
        category: 'LOW',
      });

      await dispatcher.dispatch(context, event, {
        category: 'LOW',
      });

      await promise;

      await delay(500);

      await teardown();
    },
    30_000,
  );
});
