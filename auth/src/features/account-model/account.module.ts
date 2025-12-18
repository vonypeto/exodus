import { Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { AccountService } from './account.service';
import { Tokens as AccountToken } from './libs/tokens';
import { AccountRepositoryFactory } from './repositories/account.repository';

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: AccountToken.AccountRepository,
      useFactory: AccountRepositoryFactory,
      inject: [getConnectionToken()],
    },
    AccountService,
  ],
  exports: [AccountService, AccountToken.AccountRepository],
})
export class AccountModule {}
