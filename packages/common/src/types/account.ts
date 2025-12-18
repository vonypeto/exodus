import { Event } from '@exodus/arque/core';
import { ObjectId } from '@exodus/object-id';
import { Node } from './common';
import { EventType } from './event';
// eslint-disable-next-line @nx/enforce-module-boundaries

export enum AccountType {
  Member = 'MEMBER',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  DELETED = 'DELETED',
}

export type Account = Node & {
  id: ObjectId;
  email: string;
  username: string;
  password: string;
  status: AccountStatus;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  type: AccountType;
  lastLoginAt?: Date;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type MemberAccount = Account & {
  username: number;
  type: AccountType.Member;
  password?: string;
  email?: string;
};

export type MemberAccountCreatedEvent = Event<
  EventType.MemberAccountCreated,
  Pick<Account, 'username' | 'password' | 'email'>
>;

export type MemberAccountDeletedEvent = Event<
  EventType.MemberAccountDeleted,
  Record<string, never>
>;

export type MemberAccountUpdatedEvent = Event<
  EventType.MemberAccountUpdated,
  Pick<Account, 'username' | 'password' | 'email'>
>;
