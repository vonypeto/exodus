import { Module } from '@nestjs/common';
import { PostgresAccountService } from './postgres-account.service';
import { Tokens } from './libs/tokens';
import { createPostgresAccountRepository } from './repositories/postgres-account.repository';
import { Pool } from 'pg';

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: Tokens.PostgresAccountRepository,
      useFactory: async (pool: Pool) => {
        console.log('Initializing PostgresAccountRepository with pool:', pool);
        return createPostgresAccountRepository(pool);
      },
      inject: [],
    },
    PostgresAccountService,
  ],
  exports: [PostgresAccountService, Tokens.PostgresAccountRepository],
})
export class PostgresAccountModule {}
