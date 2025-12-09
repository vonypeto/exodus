import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@genesis/config';
import { PostgresModule } from '@genesis/postgres';
import { LLMAgentService } from './llm-agent.service';
import { Pool } from 'pg';
import { Tokens } from './libs/tokens';
import { createPromptsRepository } from './repositories/prompt.repository';
import { createRunsRepository } from './repositories/run.repository';
import { createBrandsRepository } from './repositories/brand.repository';
import { createResponsesRepository } from './repositories/response.repository';
import { createMentionsRepository } from './repositories/mention.repository';
import { Tokens as PostgreToken } from '@genesis/postgres';
import { LLMProviderService } from './llm-provider.service';
import { RedisService } from '@genesis/redis';
import { RateLimiterService } from '@genesis/rate-limiter';
import { CircuitBreakerService } from '@genesis/circuit-breaker';

@Module({
  exports: [LLMProviderService, LLMAgentService],
  imports: [ConfigModule.forRoot(), PostgresModule],
  providers: [
    LLMAgentService,
    LLMProviderService,
    CircuitBreakerService,
    RedisService,
    RateLimiterService,
    {
      provide: Tokens.RunsRepository,
      useFactory: async (pool: Pool) => createRunsRepository(pool),
      inject: [PostgreToken.PostgreConnection],
    },
    {
      provide: Tokens.PromptsRepository,
      useFactory: async (pool: Pool) => createPromptsRepository(pool),
      inject: [PostgreToken.PostgreConnection],
    },
    {
      provide: Tokens.BrandsRepository,
      useFactory: async (pool: Pool) => createBrandsRepository(pool),
      inject: [PostgreToken.PostgreConnection],
    },
    {
      provide: Tokens.ResponsesRepository,
      useFactory: async (pool: Pool) => createResponsesRepository(pool),
      inject: [PostgreToken.PostgreConnection],
    },
    {
      provide: Tokens.MentionsRepository,
      useFactory: async (pool: Pool) => createMentionsRepository(pool),
      inject: [PostgreToken.PostgreConnection],
    },
  ],
})
export class LLMAgentModule implements OnModuleInit {
  constructor(
    private readonly redisService: RedisService,
    private readonly rateLimiterService: RateLimiterService
  ) {}

  onModuleInit() {
    const redisClient = this.redisService.getClient();
    this.rateLimiterService.initialize(redisClient);
    this.rateLimiterService.createProviderLimiters();
  }
}
