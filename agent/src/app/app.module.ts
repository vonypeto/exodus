import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@exodus/config';
import { AppController } from './controllers/app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountController } from './controllers/account.controller';
import { AccountModule } from '../features/account-model/account.module';

import Redis from 'ioredis';
import Redlock from 'redlock';
import R from 'ramda';
import { Joser } from '@scaleforge/joser';
import { Tokens } from '../libs/tokens';
import { AsyncEventDispatcherModule } from '@exodus/async-event-module';
import { ObjectIdInterceptor } from './interceptor/deserializer';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AccountModule,
    AsyncEventDispatcherModule.forRootAsync({
      useFactory: (...args: unknown[]) => {
        const config = args[0] as ConfigService;
        return {
          id: 'genesis-app',
          kafka: {
            brokers: config.getString('KAFKA_BROKERS').split(','),
            transactionTimeout: 100,
          },
          redis: {
            host: (
              config.getString('DATA_REDIS_ENDPOINT', { optional: true }) ||
              '127.0.0.1:6379'
            ).split(':')[0],
            port: parseInt(
              (
                config.getString('DATA_REDIS_ENDPOINT', {
                  optional: true,
                }) || '127.0.0.1:6379'
              ).split(':')[1],
              10
            ),
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
            {
              name: 'LOW_SLOW',
              allocation: 1,
            },
          ],
          logger: new Logger('agent, async-event-dispatcher'),
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        uri: config.getString('AGENT_MONGODB_URI'),
        minPoolSize: Math.floor(
          (config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10) *
            0.4
        ),
        maxPoolSize:
          config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10,
        socketTimeoutMS: 60000,
        heartbeatFrequencyMS: 2000,
        serverSelectionTimeoutMS: 30000,
        autoIndex: config.getString('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ObjectIdInterceptor,
    AppService,
    {
      provide: Tokens.Redis,
      useFactory: async (config: ConfigService) => {
        const redis = new Redis(config.getString('REDIS_ENDPOINT'), {
          username: config.getString('REDIS_USERNAME', { optional: true }),
          password: config.getString('REDIS_PASSWORD', { optional: true }),
          enableReadyCheck: true,
          lazyConnect: true,
        });

        await redis.connect();

        return redis;
      },
      inject: [ConfigService],
    },
    {
      provide: Joser,
      useFactory: () => new Joser(),
    },
    {
      provide: Tokens.Redlock,
      useFactory: async (config: ConfigService) => {
        const clients = await Promise.all(
          R.map(async (endpoint) => {
            const client = new Redis(endpoint, {
              username: config.getString('REDIS_USERNAME', { optional: true }),
              password: config.getString('REDIS_PASSWORD', { optional: true }),
              lazyConnect: true,
            });

            await client.connect();

            return client;
          }, config.getString(`REDLOCK_REDIS_ENDPOINTS`).split(','))
        );

        const redlock = new Redlock(clients, {
          automaticExtensionThreshold: 250,
          retryCount: 10,
          driftFactor: 0.1,
          retryDelay: 200,
          retryJitter: 200,
        });

        return redlock;
      },
      inject: [ConfigService],
    },
  ],
  controllers: [AppController, AccountController],
})
export class AppModule {}
