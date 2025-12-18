import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { Tokens } from './libs/tokens';
import {
    PostgresAccount,
    PostgresAccountRepository,
    AccountStatus,
    CreatePostgresAccountInput,
} from './repositories/postgres-account.repository';

@Injectable()
export class PostgresAccountService {
    constructor(
        @Inject(Tokens.PostgresAccountRepository)
        private accountRepository: PostgresAccountRepository
    ) { }

    async create(input: CreatePostgresAccountInput): Promise<PostgresAccount> {
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

        return this.accountRepository.create({
            ...input,
            status: input.status || AccountStatus.ACTIVE,
            isActive: true,
            metadata: input.metadata || {},
        });
    }

    async findAll(page = 1, limit = 10): Promise<PostgresAccount[]> {
        return this.accountRepository.findAll(page, limit);
    }
}
