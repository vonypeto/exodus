import { ObjectId } from '@genesis/object-id';
import { MongooseRepository, Repository } from '@genesis/repository';
import { Connection, Schema } from 'mongoose';

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export type Account = {
  id: ObjectId;
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

export type CreateAccountInput = Omit<
  Account,
  'id' | 'isActive' | 'metadata' | 'createdAt' | 'updatedAt' | 'status'
> & {
  status?: AccountStatus;
};

export type AccountRepository = Repository<Account>;

export function AccountRepositoryFactory(
  connection: Connection
): AccountRepository {
  return new MongooseRepository<Account>(
    connection,
    'Account',
    {
      _id: Buffer,
      email: { type: String, required: true },
      username: { type: String, required: true },
      password: { type: String, required: true },
      status: {
        type: String,
        enum: Object.values(AccountStatus),
        default: AccountStatus.ACTIVE,
      },
      firstName: String,
      lastName: String,
      phoneNumber: String,
      lastLoginAt: Date,
      isActive: { type: Boolean, default: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    [
      [{ email: 1 }, { unique: true }],
      [{ username: 1 }, { unique: true }],
      [{ status: 1 }],
      [{ createdAt: -1 }],
    ]
  );
}
