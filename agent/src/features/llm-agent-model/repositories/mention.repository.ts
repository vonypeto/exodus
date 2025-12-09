import { Pool } from 'pg';
import { PostgresRepository } from '@genesis/postgresql-repository';
import { Repository } from '@genesis/repository';
import { ObjectId } from '@genesis/object-id';

export type Mention = {
  id: ObjectId;
  responseId: ObjectId;
  brandId: ObjectId;
  mentioned: boolean;
  positionIndex?: number;
};

export const MentionsSchema = {
  id: Buffer,
  responseId: Buffer,
  brandId: Buffer,
  mentioned: Boolean,
  positionIndex: Number,
};

export type MentionsRepository = Repository<Mention>;

export async function createMentionsRepository(
  pool: Pool
): Promise<MentionsRepository> {
  const repo = new PostgresRepository<Mention>(
    pool,
    'mentions',
    MentionsSchema
  );
  await repo.initialize();
  return repo;
}
