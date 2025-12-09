import { Pool } from 'pg';
import { PostgresRepository } from '@genesis/postgresql-repository';
import { Repository } from '@genesis/repository';
import { ObjectId } from '@genesis/object-id';

export type Response = {
  id: ObjectId;
  runId: ObjectId;
  promptId: ObjectId;
  model: string;
  latencyMs: number;
  rawText: string;
  createdAt: Date;
  meta: Record<string, any>;
};

export const ResponsesSchema = {
  id: Buffer,
  runId: Buffer,
  promptId: Buffer,
  model: String,
  latencyMs: Number,
  rawText: String,
  meta: Object,
};
export type ResponsesRepository = Repository<Response>;

export async function createResponsesRepository(
  pool: Pool
): Promise<Repository<Response>> {
  const repo = new PostgresRepository<Response>(
    pool,
    'responses',
    ResponsesSchema
  );
  await repo.initialize();
  return repo;
}
