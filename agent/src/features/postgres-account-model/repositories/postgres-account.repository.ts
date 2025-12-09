import { PostgresRepository } from '@genesis/postgresql-repository';
import { Pool } from 'pg';
import { Repository } from '@genesis/repository';

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export type PostgresAccount = {
  id: string;
  email: string;
  username: string;
  password: string;
  status: AccountStatus;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  lastLoginAt?: Date;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePostgresAccountInput = Omit<
  PostgresAccount,
  'id' | 'isActive' | 'metadata' | 'createdAt' | 'updatedAt' | 'status'
> & {
  status?: AccountStatus;
  metadata?: Record<string, unknown>;
};

export type PostgresAccountRepository = Repository<PostgresAccount>;

export const PostgresAccountSchema = {
  email: String,
  username: String,
  password: String,
  status: String,
  firstName: String,
  lastName: String,
  phoneNumber: String,
  lastLoginAt: Date,
  isActive: Boolean,
  metadata: Object, // Will map to JSONB
};

export const createPostgresAccountRepository = async (
  pool: Pool
): Promise<PostgresAccountRepository> => {
  console.log(pool);
  const repo = new PostgresRepository<PostgresAccount>(
    pool,
    'postgres_accounts',
    PostgresAccountSchema
  );
  await repo.initialize();
  return repo;
};
