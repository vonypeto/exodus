import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Run } from '../../features/llm-agent-model/repositories/run.repository';

export class ModelConfigDto {
  @IsString()
  model!: string;

  @IsString()
  provider!: string;
}

export class RunConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  concurrencyLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  retryAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  timeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerSecond?: number;

  @IsOptional()
  @IsBoolean()
  enableCircuitBreaker?: boolean;
}

export class CreateRunDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  prompts!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  brands!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ModelConfigDto)
  models!: ModelConfigDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RunConfigDto)
  config?: RunConfigDto;
}

export interface CreateRunRequest {
  prompts: string[];
  brands: string[];
  models: { model: string; provider: string }[];
  notes?: string;
  idempotencyKey?: string;
  config?: {
    concurrencyLimit?: number;
    retryAttempts?: number;
    timeout?: number;
    rateLimitPerSecond?: number;
    enableCircuitBreaker?: boolean;
  };
}

export interface CreateRunResponse {
  run: Run;
  message: string;
  isNew: boolean;
}

export interface RunSummaryResponse {
  run: Run;
  brandMetrics: Array<{
    brandName: string;
    totalMentions: number;
    mentionRate: number;
    avgPosition?: number;
    byPrompt: Array<{
      promptText: string;
      mentioned: boolean;
      mentionCount: number;
      models: string[];
    }>;
  }>;
  promptMetrics: Array<{
    promptText: string;
    totalResponses: number;
    successfulResponses: number;
    brandsMetioned: string[];
  }>;
}

export interface RunChatResponse {
  run: Run;
  conversations: Array<{
    prompt: string;
    promptId: string;
    responses: Array<{
      model: string;
      provider: string;
      text: string;
      latencyMs: number;
      tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
      status: string;
      errorMessage?: string;
      timestamp: Date;
      brandMentions?: Array<{
        brandName: string;
        mentioned: boolean;
        mentionCount: number;
        context?: string;
      }>;
    }>;
  }>;
}

export interface LLMResponse {
  text: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

export interface LLMProviderConfig {
  model: string;
  provider: string;
  timeout?: number;
  maxRetries?: number;
  useCircuitBreaker?: boolean;
}
