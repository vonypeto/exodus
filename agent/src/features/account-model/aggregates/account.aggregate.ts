import {
  Aggregate,
  AggregateFactory,
  Command,
  CommandHandler,
  EventHandler,
  StoreAdapter,
  StreamAdapter,
} from '@exodus/arque/core';
import { Account } from '../repositories/account.repository';
import { ObjectId } from '@exodus/object-id';
import {
  AccountStatus,
  AccountType,
  EventType,
  MemberAccountCreatedEvent,
  MemberAccountUpdatedEvent,
} from '@exodus/common';

export enum CommandType {
  MemberAccountCreated = 1,
  MemberAccountUpdated = 2,
}

export type CreateMemberAccountCommand = Command<
  CommandType.MemberAccountCreated,
  [Pick<Account, 'email' | 'password' | 'username'>]
>;

export type UpdateMemberAccountCommand = Command<
  CommandType.MemberAccountUpdated,
  [Pick<Account, 'email' | 'password' | 'username' | 'type'>]
>;

export type AccountAggregateState = Pick<
  Account,
  'email' | 'password' | 'username' | 'status' | 'type'
> & {
  platform?: ObjectId;
};

export type AccountAggregateCommandHandler =
  | CommandHandler<
      CreateMemberAccountCommand,
      MemberAccountCreatedEvent,
      AccountAggregateState
    >
  | CommandHandler<
      UpdateMemberAccountCommand,
      MemberAccountUpdatedEvent,
      AccountAggregateState
    >;

export type AccountAggregateEventHandler =
  | EventHandler<MemberAccountCreatedEvent, AccountAggregateState>
  | EventHandler<MemberAccountUpdatedEvent, AccountAggregateState>;
//   | EventHandler<MemberAccountDeletedEvent, AccountAggregateState>

export type AccountAggregate = Aggregate<
  AccountAggregateState,
  AccountAggregateCommandHandler,
  AccountAggregateEventHandler
>;

export function AccountAggregateFactory(
  store: StoreAdapter,
  stream: StreamAdapter
) {
  return new AggregateFactory<AccountAggregate>(
    store,
    stream,
    [
      {
        type: CommandType.MemberAccountCreated,
        handle(ctx, _, body) {
          console.log('Handling MemberAccountCreated command', { ctx, body });
          if (ctx.aggregate.version > 0) {
            throw new Error(`'MemberAccount' already exists`);
          }

          return {
            type: EventType.MemberAccountCreated,
            body,
          };
        },
      },
      {
        type: CommandType.MemberAccountUpdated,
        handle(ctx, _, body) {
          if (ctx.aggregate.version === 0) {
            throw new Error(`cannot update a non-existing 'Account'`);
          }

          if (ctx.state.type !== AccountType.Member) {
            throw new Error(`account is not a 'MemberAccount'`);
          }

          if (ctx.state.status === AccountStatus.DELETED) {
            throw new Error(`cannot update an already deleted 'Account'`);
          }

          return {
            type: EventType.MemberAccountUpdated,
            body,
          };
        },
      },
    ],
    [
      {
        type: EventType.MemberAccountCreated,
        handle({ state }, event) {
          return {
            ...state,
            ...event.body,
            status: AccountStatus.ACTIVE,
            type: AccountType.Member,
          };
        },
      },
      {
        type: EventType.MemberAccountUpdated,
        handle({ state }, event) {
          return {
            ...state,
            ...event.body,
          };
        },
      },
    ],
    {
      snapshotInterval: 10,
    }
  );
}
