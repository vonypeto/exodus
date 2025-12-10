import { Injectable, Logger } from '@nestjs/common';
import { AsyncEventHandler } from '@exodus/async-event-module';
import { AccountService } from '../features/account-model/account.service';
import { MemberAccountCreatedAsyncEvent } from '@exodus/async-event-module/types';

@Injectable()
export class MemberAccountAsyncEventService {
  private readonly logger = new Logger(MemberAccountAsyncEventService.name);
  constructor(private readonly account: AccountService) {}

  @AsyncEventHandler('MemberAccountCreated')
  async handleMemberAccountCreatedAsyncEvent(
    event: MemberAccountCreatedAsyncEvent
  ) {
    this.logger.log('MemberAccountCreated', { event });

    // Deduplication debug: log event id and payload

    // Uncommented: actually create account to test deduplication
    await this.account.create({
      ...event.payload,
    });
  }
}
