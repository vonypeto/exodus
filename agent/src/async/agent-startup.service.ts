import { Injectable, Logger } from '@nestjs/common';
import {
  AsyncEventHandler,
  StartRunCreatedAsyncEvent,
} from '@genesis/async-event-module';
import { LLMAgentService } from '../features/llm-agent-model/llm-agent.service';

@Injectable()
export class AgentStartUpService {
  private readonly logger = new Logger(AgentStartUpService.name);
  constructor(private readonly agent: LLMAgentService) {}
  @AsyncEventHandler('StartRunCreated')
  async handleMemberAccountCreatedAsyncEvent(event: StartRunCreatedAsyncEvent) {
    this.logger.log('StartRunCreated', { event });
    console.dir(event.payload.id, { depth: null });
    await this.agent.startRun(event.payload);
  }
}
