import { Run } from '../../features/llm-agent-model/repositories/run.repository';

export interface CreateRunResponse {
  run: Run | null;
  message: string;
  isNew: boolean;
}
