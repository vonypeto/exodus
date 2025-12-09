import { Pool } from 'pg';
import { PostgresRepository } from '@genesis/postgresql-repository';
import { Repository } from '@genesis/repository';
import { ObjectId } from '@genesis/object-id';

export type Prompt = { id: ObjectId; text: string; runId: ObjectId };

export const PromptsSchema = { id: Buffer, text: String, runId: Buffer };

export type PromptsRepository = Repository<Prompt>;

export async function createPromptsRepository(
  pool: Pool
): Promise<Repository<Prompt>> {
  const repo = new PostgresRepository<Prompt>(pool, 'prompts', PromptsSchema);
  await repo.initialize();
  return repo;
}
