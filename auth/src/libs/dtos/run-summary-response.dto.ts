import { Run } from '../../features/llm-agent-model/repositories/run.repository';

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
