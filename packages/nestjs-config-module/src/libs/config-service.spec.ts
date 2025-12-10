import { Test } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { ConfigService } from './config.service';
import { Tokens } from './tokens';
import { ConfigModuleOptions } from './types';

async function fixture(options?: ConfigModuleOptions) {
  const module = await Test.createTestingModule({
    providers: [
      ConfigService,
      {
        provide: Tokens.ConfigOptions,
        useValue: options,
      },
    ],
  }).compile();

  return { module };
}

describe('ConfigService', () => {
  test.concurrent('should be defined', async () => {
    const { module } = await fixture();

    const service = module.get<ConfigService>(ConfigService);

    expect(service).toBeDefined();
  });

  test.concurrent('should return value', async () => {
    const options = {
      data: {
        JWT_SECRET_KEY: faker.git.commitSha(),
      },
    };

    const { module } = await fixture(options);

    const service = module.get<ConfigService>(ConfigService);

    expect(service.getString('JWT_SECRET_KEY')).toEqual(
      options.data.JWT_SECRET_KEY,
    );
  });
});
