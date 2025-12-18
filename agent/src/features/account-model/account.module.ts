import { Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { AccountService } from './account.service';
import { Tokens as AccountToken } from './libs/tokens';
import { AccountRepositoryFactory } from './repositories/account.repository';
import { AccountAggregateFactory } from './aggregates/account.aggregate';
import { Tokens as ArqueModuleTokens } from '@exodus/nestjs-arque-module';
import { Tokens } from './libs/tokens';
@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: AccountToken.AccountRepository,
      useFactory: AccountRepositoryFactory,
      inject: [getConnectionToken()],
    },
    {
      provide: Tokens.AccountAggregate,
      useFactory: AccountAggregateFactory,
      inject: [ArqueModuleTokens.StoreAdapter, ArqueModuleTokens.StreamAdapter],
    },
    AccountService,
  ],
  exports: [AccountService, AccountToken.AccountRepository],
})
export class AccountModule {}
