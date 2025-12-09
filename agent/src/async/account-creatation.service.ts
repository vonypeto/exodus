import { Injectable, Logger } from '@nestjs/common';
import {
  AsyncEventHandler,
  MemberAccountCreatedAsyncEvent,
} from '@genesis/async-event-module';

@Injectable()
export class MemberAccountAsyncEventService {
  private readonly logger = new Logger(MemberAccountAsyncEventService.name);

  @AsyncEventHandler('MemberAccountCreated')
  async handleMemberAccountCreatedAsyncEvent(
    event: MemberAccountCreatedAsyncEvent
  ) {
    console.log('MemberAccountCreated', { event });
    this.logger.log('MemberAccountCreated', { event });
  }
}
