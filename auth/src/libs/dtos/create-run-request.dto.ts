import {
  LLMModel,
  LLMProvider,
} from '../../features/llm-agent-model/libs/types';

export type CreateRunRequest = {
  prompts: string[];
  brands: string[];
  models: { model: LLMModel; provider: LLMProvider }[];
  notes?: string;
  idempotencyKey?: string;
  config?: {
    concurrencyLimit?: number;
    retryAttempts?: number;
    timeout?: number;
  };
};
