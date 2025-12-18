import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { Tokens } from './libs/tokens';
import {
  Account,
  AccountRepository,
  CreateAccountInput,
} from './repositories/account.repository';
import { ObjectId } from '@exodus/object-id';
import { AccountStatus } from '@exodus/common';
import { AggregateFactory } from '@exodus/arque';
import {
  CommandType,
  type AccountAggregate as AccountAggregateType,
} from './aggregates/account.aggregate';

@Injectable()
export class AccountService {
  constructor(
    @Inject(Tokens.AccountAggregate)
    private AccountAggregate: AggregateFactory<AccountAggregateType>,
    @Inject(Tokens.AccountRepository)
    private accountRepository: AccountRepository
  ) {}

  async create(
    input: Partial<CreateAccountInput> & { id?: ObjectId }
  ): Promise<boolean> {
    console.log('Creating account', input);
    const existingEmail = await this.accountRepository.find(
      {
        email: input.email,
      },
      { arr: false }
    );
    console.log(existingEmail);
    console.log('Existing email check', existingEmail);
    if (existingEmail) {
      console.log('true');
      throw new ConflictException('Email already exists');
    }
    console.log('2');

    const existingUsername = await this.accountRepository.find(
      {
        username: input.username,
      },
      { arr: false }
    );

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }
    console.log('3');
    const created = await this.accountRepository.create({
      ...input,
      status: input.status || AccountStatus.ACTIVE,
      isActive: true,
      id: input.id ?? ObjectId.generate(),
      metadata: {},
    });
    console.log('Account created in MongoDB:', created);

    return true;
  }
  async findAll(params: {
    page: number;
    limit: number;
    filter?: Partial<Account>;
  }): Promise<Account[] | Account> {
    const { page, limit, filter } = params;
    const appliedFilter = filter ? filter : {};
    return this.accountRepository.find(appliedFilter, {
      skip: (page - 1) * limit,
      limit,
      arr: true,
    });
  }
  async findById(id: ObjectId | Buffer) {
    return this.accountRepository.find({ id: id });
  }

  public async loadAccount(id: ObjectId) {
    const aggregate = await this.AccountAggregate.load(id.buffer);

    if (aggregate.version === 0) return null;

    return { ...aggregate.state, id };
  }
  public async createMemberAccount(
    data: Pick<Account, 'id' | 'username' | 'password' | 'email'>
  ) {
    const aggregate = await this.AccountAggregate.load(data.id.buffer, {
      noReload: true,
    });

    await aggregate.process(
      {
        type: CommandType.MemberAccountCreated,
        args: [
          {
            ...data,
          },
        ],
      },
      null,
      {
        noReload: true,
      }
    );
  }
}
