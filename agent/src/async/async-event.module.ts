import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@exodus/config';
import { AsyncEventModule } from '@exodus/async-event-module';
import { MemberAccountAsyncEventService } from './account-creatation.service';
import path from 'path';
import fs from 'fs';
import { AccountModule } from '../features/account-model/account.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AccountModule,
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
    AsyncEventModule.forRootAsync({
      imports: [ConfigModule],

      useFactory: (...args: unknown[]) => {
        const config = args[0] as ConfigService;
        return {
          context: 'agent',
          kafka: {
            brokers: (
              config.getString('KAFKA_BROKERS', { optional: true }) ||
              'localhost:9092'
            )
              .split(',')
              .map((b) => b.trim())
              .filter(Boolean),
          },
          concurrency:
            config.getNumber('ASYNC_EVENT_CONCURRENCY', { optional: true }) ??
            5,
        };
      },
      inject: [ConfigService],
    }),
    // PostgresModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (config: ConfigService) => {
    //     console.log(
    //       config.getString('POSTGRE_URI', {
    //         optional: true,
    //       })
    //     );
    //     const connectionString = config.getString('POSTGRE_URI', {
    //       optional: true,
    //     });
    //     const production =
    //       (config.getString('NODE_ENV', { optional: true }) ||
    //         'development') === 'production';

    //     const caPath = config.getString('POSTGRE_SSL_CA_PATH', {
    //       optional: true,
    //     });

    //     const ssl: false | { rejectUnauthorized: boolean; ca?: string } =
    //       production
    //         ? caPath
    //           ? {
    //               rejectUnauthorized: true,
    //               ca: fs.readFileSync(
    //                 path.resolve(process.cwd(), caPath),
    //                 'utf8'
    //               ),
    //             }
    //           : ({ rejectUnauthorized: false } as any)
    //         : false;

    //     return { connectionString, ssl };
    //   },
    //   inject: [ConfigService],
    // }),
    // LLMAgentModule,
  ],
  providers: [MemberAccountAsyncEventService],
})
export class AsyncModule {}
