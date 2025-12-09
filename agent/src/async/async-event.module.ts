import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@genesis/config';
import { AsyncEventModule } from '@genesis/async-event-module';
import { MemberAccountAsyncEventService } from './account-creatation.service';
import { LLMAgentService } from '../features/llm-agent-model/llm-agent.service';
import { LLMAgentModule } from '../features/llm-agent-model/llm-agent.module';
import path from 'path';
import fs from 'fs';
import { PostgresModule } from '@genesis/postgres';
import { AgentStartUpService } from './agent-startup.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
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
    PostgresModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        console.log(
          config.getString('POSTGRE_URI', {
            optional: true,
          })
        );
        const connectionString = config.getString('POSTGRE_URI', {
          optional: true,
        });
        const production =
          (config.getString('NODE_ENV', { optional: true }) ||
            'development') === 'production';

        const caPath = config.getString('POSTGRE_SSL_CA_PATH', {
          optional: true,
        });

        const ssl: false | { rejectUnauthorized: boolean; ca?: string } =
          production
            ? caPath
              ? {
                  rejectUnauthorized: true,
                  ca: fs.readFileSync(
                    path.resolve(process.cwd(), caPath),
                    'utf8'
                  ),
                }
              : ({ rejectUnauthorized: false } as any)
            : false;

        return { connectionString, ssl };
      },
      inject: [ConfigService],
    }),
    LLMAgentModule,
  ],
  providers: [MemberAccountAsyncEventService, AgentStartUpService],
})
export class AsyncModule {}
