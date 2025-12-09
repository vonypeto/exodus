export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

export enum OpenAIModel {
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4 = 'gpt-4',
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
}

export enum AnthropicModel {
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-20241022',
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
}

export type LLMModel = OpenAIModel | AnthropicModel;

export const CostPerToken: Record<LLMModel, number> = {
  [OpenAIModel.GPT_4O]: 0.000005,
  [OpenAIModel.GPT_4O_MINI]: 0.00000015,
  [OpenAIModel.GPT_4_TURBO]: 0.00001,
  [OpenAIModel.GPT_4]: 0.00003,
  [OpenAIModel.GPT_3_5_TURBO]: 0.0000005,
  [AnthropicModel.CLAUDE_3_5_SONNET]: 0.000003,
  [AnthropicModel.CLAUDE_3_5_HAIKU]: 0.0000008,
  [AnthropicModel.CLAUDE_3_OPUS]: 0.000015,
  [AnthropicModel.CLAUDE_3_SONNET]: 0.000003,
  [AnthropicModel.CLAUDE_3_HAIKU]: 0.00000025,
};

// Helper to validate model belongs to provider
export const ModelToProvider: Record<LLMModel, LLMProvider> = {
  [OpenAIModel.GPT_4O]: LLMProvider.OPENAI,
  [OpenAIModel.GPT_4O_MINI]: LLMProvider.OPENAI,
  [OpenAIModel.GPT_4_TURBO]: LLMProvider.OPENAI,
  [OpenAIModel.GPT_4]: LLMProvider.OPENAI,
  [OpenAIModel.GPT_3_5_TURBO]: LLMProvider.OPENAI,
  [AnthropicModel.CLAUDE_3_5_SONNET]: LLMProvider.ANTHROPIC,
  [AnthropicModel.CLAUDE_3_5_HAIKU]: LLMProvider.ANTHROPIC,
  [AnthropicModel.CLAUDE_3_OPUS]: LLMProvider.ANTHROPIC,
  [AnthropicModel.CLAUDE_3_SONNET]: LLMProvider.ANTHROPIC,
  [AnthropicModel.CLAUDE_3_HAIKU]: LLMProvider.ANTHROPIC,
};
export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
}

export function isValidModelForProvider(
  model: string,
  provider: LLMProvider
): boolean {
  const modelEnum = model as LLMModel;
  return ModelToProvider[modelEnum] === provider;
}

export function getModelsForProvider(provider: LLMProvider): LLMModel[] {
  return Object.entries(ModelToProvider)
    .filter(([, p]) => p === provider)
    .map(([model]) => model as LLMModel);
}

// Strict types for transformation
export type Row = {
  brandName: string;
  promptText: string;
  model: string;
  mentioned: boolean;
  totalMentions: number;
};
export type ByPrompt = {
  promptText: string;
  mentioned: boolean;
  mentionCount: number;
  models: string[];
};
export type BrandMetric = {
  brandName: string;
  totalMentions: number;
  mentionCount: number;
  mentionRate: number;
  byPrompt: ByPrompt[];
};
export type PromptMetric = {
  promptText: string;
  totalResponses: number;
  successfulResponses: number;
  brandsMetioned: string[];
};
