import { Pool } from 'pg';
import { PostgresRepository } from '@genesis/postgresql-repository';
import { Repository } from '@genesis/repository';
import { ObjectId } from '@genesis/object-id';

export type Brand = { id: ObjectId; name: string; runId: ObjectId };

const BrandsSchema = { id: Buffer, name: String, runId: Buffer };

export type BrandsRepository = Repository<Brand>;

export async function createBrandsRepository(
  pool: Pool
): Promise<Repository<Brand>> {
  const repo = new PostgresRepository<Brand>(pool, 'brands', BrandsSchema);
  await repo.initialize();
  return repo;
}
