import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@genesis/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CircuitBreakerService } from '@genesis/circuit-breaker';
import { LLMResponse, LLMProviderConfig } from '../../libs/dtos';
import { LLMProvider } from './libs/types';

@Injectable()
export class LLMProviderService {
  private readonly logger = new Logger(LLMProviderService.name);

  private openai?: OpenAI;
  private anthropic?: Anthropic;

  constructor(
    private readonly config: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService
  ) {
    this.initProviders();
  }

  /** Initialize and register LLM providers + circuit breakers */
  private initProviders() {
    const openaiKey = this.config.getString('OPENAI_API_KEY', {
      optional: true,
    });
    const anthropicKey = this.config.getString('ANTHROPIC_API_KEY', {
      optional: true,
    });

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.registerBreaker(LLMProvider.OPENAI);
    }

    if (anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.registerBreaker(LLMProvider.ANTHROPIC);
    }
  }

  private registerBreaker(provider: LLMProvider) {
    this.circuitBreaker.registerCircuit(provider, {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60_000,
    });
  }

  /** Helper: wraps any promise with AbortController timeout */
  private async withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    ms: number
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);

    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(id);
    }
  }

  /** Main LLM dispatcher */
  async callLLM(
    prompt: string,
    config: LLMProviderConfig,
    role?: string
  ): Promise<LLMResponse> {
    const start = Date.now();

    const exec = async () => {
      switch (config.provider) {
        case LLMProvider.OPENAI:
          return await this.callOpenAI(prompt, config, start);
        case LLMProvider.ANTHROPIC:
          return await this.callAnthropic(prompt, config, start);
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }
    };

    try {
      return await this.circuitBreaker.execute(config.provider, exec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `LLM call failed: ${msg}`,
        err instanceof Error ? err.stack : undefined
      );
      throw new Error(`LLM call failed: ${msg}`);
    }
  }

  /** OpenAI call */
  private async callOpenAI(
    prompt: string,
    config: LLMProviderConfig,
    start: number,
    role?: string
  ): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI provider is not configured.');
    }

    const timeout = config.timeout ?? 30_000;

    const completion = await this.withTimeout(
      (signal) =>
        this.openai!.chat.completions.create(
          {
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1000,
          },
          { timeout, signal }
        ),
      timeout
    );

    const latencyMs = Date.now() - start;

    return {
      text: completion.choices[0]?.message?.content ?? '',
      latencyMs,
      tokenUsage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
      metadata: {
        model: completion.model,
        finishReason: completion.choices[0]?.finish_reason,
        id: completion.id,
      },
    };
  }

  /** Anthropic call */
  private async callAnthropic(
    prompt: string,
    config: LLMProviderConfig,
    start: number
  ): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic provider is not configured.');
    }

    const timeout = config.timeout ?? 30_000;

    const message = await this.withTimeout(
      (signal) =>
        this.anthropic!.messages.create(
          {
            model: config.model,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          },
          { timeout, signal }
        ),
      timeout
    );

    const latencyMs = Date.now() - start;
    const first = message.content[0];

    return {
      text: first?.type === 'text' ? first.text : '',
      latencyMs,
      tokenUsage: {
        promptTokens: message.usage?.input_tokens,
        completionTokens: message.usage?.output_tokens,
        totalTokens:
          (message.usage?.input_tokens ?? 0) +
          (message.usage?.output_tokens ?? 0),
      },
      metadata: {
        model: message.model,
        stopReason: message.stop_reason,
        id: message.id,
      },
    };
  }

  getSupportedProviders(): string[] {
    return [
      ...(this.openai ? [LLMProvider.OPENAI] : []),
      ...(this.anthropic ? [LLMProvider.ANTHROPIC] : []),
    ];
  }

  getDefaultModels(): Record<string, string[]> {
    return {
      [LLMProvider.OPENAI]: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      [LLMProvider.ANTHROPIC]: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
      ],
    };
  }
}
