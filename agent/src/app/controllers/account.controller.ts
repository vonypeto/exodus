import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Inject } from '@nestjs/common';
import { AccountService } from '../../features/account-model/account.service';
import { Account } from '../../features/account-model/repositories/account.repository';
import { AsyncEventDispatcherService } from '@exodus/async-event-module';
import R from 'ramda';
import { Buffer } from 'buffer';
import { Types, Schema } from 'mongoose';
import { delay } from 'rxjs';
import { Idempotency } from '../interceptor/idempotency';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { Joser } from '@scaleforge/joser';
import { Tokens } from '../../libs/tokens';
import { AppRequest } from '../../libs/types';
import { ObjectId } from '@exodus/object-id';
import { Console } from 'console';
import { CreateAccountDto } from '../dto/create-account.dto';

@Controller('accounts')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly dispatcher: AsyncEventDispatcherService,
    @Inject(Tokens.Redis) private readonly redis: Redis,
    @Inject(Tokens.Redlock) private readonly redlock: Redlock,
    private readonly joser: Joser
  ) {}

  @Post()
  @Idempotency((input: CreateAccountDto) => <string>input['email'])
  async create(@Body() input: CreateAccountDto): Promise<boolean> {
    await this.accountService.create(input);
    return true;
  }

  @Post('async')
  @Idempotency((input: CreateAccountDto) => <string>input['email'])
  async createAsync(@Body() input: CreateAccountDto): Promise<boolean> {
    await this.dispatcher.dispatch(
      ['agent'],
      {
        id: ObjectId.generate(),
        type: 'MemberAccountCreated',
        payload: {
          ...R.pick(['email', 'username', 'password'], input),
        },
        timestamp: new Date(),
      },
      {
        category: 'HIGH',
        delay: 5000,
      }
    );

    return true;
  }

  @Post('projection')
  // @Idempotency((input: CreateAccountDto) => <string>input['email'])
  async createProjection(@Body() input: CreateAccountDto): Promise<boolean> {
    await this.accountService.createMemberAccount({
      ...input,
      id: ObjectId.generate(),
    });
    console.log('Created via projection');
    return true;
  }

  @Get()
  async findAll(
    @Query() query: { page?: string; limit?: string; id?: string }
  ): Promise<Account[] | Account> {
    return this.accountService.findAll({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: parseInt(query.limit, 10) ? parseInt(query.limit, 10) : 10,
      filter: { id: ObjectId.from(query.id) },
    });
  }
}
