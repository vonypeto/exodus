import { Run } from '../../features/llm-agent-model/repositories/run.repository';

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
