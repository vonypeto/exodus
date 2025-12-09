import { Module } from '@nestjs/common';
import { PostgresAccountService } from './postgres-account.service';
import { PostgresAccountController } from '../../app/controllers/postgres-account.controller';
import { Tokens } from './libs/tokens';
import { createPostgresAccountRepository } from './repositories/postgres-account.repository';
import { Pool } from 'pg';
import { Tokens as PostgreToken } from '@genesis/postgres';

@Module({
  imports: [],
  controllers: [PostgresAccountController],
  providers: [
    {
      provide: Tokens.PostgresAccountRepository,
      useFactory: async (pool: Pool) => {
        console.log('Initializing PostgresAccountRepository with pool:', pool);
        return createPostgresAccountRepository(pool);
      },
      inject: [PostgreToken.PostgreConnection],
    },
    PostgresAccountService,
  ],
  exports: [PostgresAccountService, Tokens.PostgresAccountRepository],
})
export class PostgresAccountModule {}
