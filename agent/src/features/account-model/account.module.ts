import { Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { AccountService } from './account.service';
import { AccountController } from '../../app/controllers/account.controller';
import { Tokens as AccountToken } from './libs/tokens';
import { Tokens } from '../../libs/tokens';
import { AccountRepositoryFactory } from './repositories/account.repository';
import { ConfigService } from '@genesis/config';
import Redis from 'ioredis';
import Redlock from 'redlock';
import R from 'ramda';
import { Joser } from '@scaleforge/joser';

@Module({
  imports: [],
  controllers: [AccountController],
  providers: [
    {
      provide: AccountToken.AccountRepository,
      useFactory: AccountRepositoryFactory,
      inject: [getConnectionToken()],
    },
    {
      provide: Tokens.Redis,
      useFactory: async (config: ConfigService) => {
        const redis = new Redis(config.getString('REDIS_ENDPOINT'), {
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
    AccountService,
  ],
  exports: [AccountService, AccountToken.AccountRepository],
})
export class AccountModule {}
