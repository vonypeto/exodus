import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Tokens } from './libs/tokens';
import {
  Account,
  AccountRepository,
  AccountStatus,
  CreateAccountInput,
} from './repositories/account.repository';
import { ObjectId } from '@genesis/object-id';

@Injectable()
export class AccountService {
  constructor(
    @Inject(Tokens.AccountRepository)
    private accountRepository: AccountRepository
  ) {}

  async create(input: CreateAccountInput): Promise<Account> {
    const existingEmail = await this.accountRepository.findOne({
      email: input.email,
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingUsername = await this.accountRepository.findOne({
      username: input.username,
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }
    const datas = ObjectId.generate();
    console.log(datas.toString());
    const data = await this.accountRepository.create({
      ...input,
      status: input.status || AccountStatus.ACTIVE,
      isActive: true,
      id: datas,
      metadata: {},
    });
    console.log(await this.accountRepository.findOne({ id: datas }));
    return data;
  }
  async findAll(page = 1, limit = 10): Promise<Account[]> {
    return this.accountRepository.findAll(page, limit);
  }
  async findById(id: ObjectId | Buffer) {
    return this.accountRepository.findOne({ id: id });
  }
}
