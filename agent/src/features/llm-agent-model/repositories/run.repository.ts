import { Pool } from 'pg';
import { PostgresRepository } from '@genesis/postgresql-repository';
import { Repository } from '@genesis/repository';
import { ObjectId } from '@genesis/object-id';
import { RunStatus } from '../libs/types';

export type Run = {
  id: ObjectId;
  createdAt: Date;
  notes?: string;
  totalPrompts: number;
  failedPrompts: number;
  status: RunStatus;
};

export const RunsSchema = {
  id: Buffer,
  notes: String,
  totalPrompts: Number,
  failedPrompts: Number,
  status: String,
};

export type RunsRepository = Repository<Run>;

export async function createRunsRepository(
  pool: Pool
): Promise<Repository<Run>> {
  const repo = new PostgresRepository<Run>(pool, 'runs', RunsSchema);
  await repo.initialize();
  return repo;
}
