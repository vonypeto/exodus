import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { Tokens } from './libs/tokens';
import {
  Account,
  AccountRepository,
  AccountStatus,
  CreateAccountInput,
} from './repositories/account.repository';
import { ObjectId } from '@exodus/object-id';

@Injectable()
export class AccountService {
  constructor(
    @Inject(Tokens.AccountRepository)
    private accountRepository: AccountRepository
  ) {}

  async create(input: CreateAccountInput): Promise<boolean> {
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
    await this.accountRepository.create({
      ...input,
      status: input.status || AccountStatus.ACTIVE,
      isActive: true,
      id: ObjectId.generate(),
      metadata: {},
    });

    return true;
  }
  async findAll(params: {
    page: number;
    limit: number;
    id?: ObjectId | string;
  }): Promise<Account[] | Account> {
    const { page, limit, id } = params;
    const filter = id ? { id } : {};
    return this.accountRepository.find(filter, {
      skip: (page - 1) * limit,
      limit,
      arr: true,
    });
  }
  async findById(id: ObjectId | Buffer) {
    return this.accountRepository.find({ id: id });
  }
}
