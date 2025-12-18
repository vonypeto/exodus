import {
  LLMProvider,
  LLMModel,
} from '../../features/llm-agent-model/libs/types';

export interface LLMProviderConfig {
  model: LLMModel;
  provider: LLMProvider;
  timeout?: number;
  maxRetries?: number;
}
