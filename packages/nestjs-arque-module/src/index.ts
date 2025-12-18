import {
  DynamicModule,
  Inject,
  Module,
  ModuleMetadata,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  MongoConfigAdapter,
  MongoConfigAdapterOptions,
  KafkaStreamAdapter,
  KafkaStreamAdapterOptions,
  MongoStoreAdapter,
  MongoStoreAdapterOptions,
  PostgresStoreAdapter,
  PostgresStoreAdapterOptions,
  PostgresConfigAdapter,
  PostgresConfigAdapterOptions,
  ConfigAdapter,
  StoreAdapter,
  StreamAdapter,
} from '@exodus/arque';
import { Tokens } from './libs/tokens';

export { Tokens };

export type ArqueModuleOptions = {
  store: {
    mongo?: MongoStoreAdapterOptions;
    postgresql?: PostgresStoreAdapterOptions;
  };
  stream: {
    kafka?: KafkaStreamAdapterOptions;
  };
  config: {
    mongo?: MongoConfigAdapterOptions;
    postgres?: PostgresConfigAdapterOptions;
  };
};

export type ArqueModuleAsyncOptions = Pick<ModuleMetadata, 'imports'> & {
  useFactory?: (
    ...args: any[]
  ) => Promise<ArqueModuleOptions> | ArqueModuleOptions;
  inject?: any[];
};

@Module({})
export class ArqueModule
  implements OnApplicationShutdown, OnApplicationBootstrap
{
  constructor(
    @Inject(Tokens.ConfigAdapter)
    private readonly config: ConfigAdapter,
    @Inject(Tokens.StoreAdapter)
    private readonly store: StoreAdapter,
    @Inject(Tokens.StreamAdapter)
    private readonly stream: StreamAdapter
  ) {}

  async onApplicationBootstrap() {
    await Promise.all([
      this.store.init(),
      this.stream.init(),
      this.config.init(),
    ]);
  }

  async onApplicationShutdown() {
    await Promise.all([
      this.store.close(),
      this.stream.close(),
      this.config.close(),
    ]);
  }

  static forRootAsync(options: ArqueModuleAsyncOptions): DynamicModule {
    return {
      global: true,
      module: ArqueModule,
      providers: [
        {
          provide: Tokens.ArqueModuleOptions,
          useFactory: options.useFactory,
          inject: (options.inject ?? []) as never, // Fix type mismatch
        },
        {
          provide: Tokens.StoreAdapter,
          useFactory: async (options: ArqueModuleOptions) => {
            if (options.store.mongo) {
              return new MongoStoreAdapter(options.store.mongo);
            }
            if (options.store.postgresql) {
              return new PostgresStoreAdapter(options.store.postgresql);
            }
            throw new Error('No store adapter configured');
          },
          inject: [Tokens.ArqueModuleOptions],
        },
        {
          provide: Tokens.StreamAdapter,
          useFactory: async (options: ArqueModuleOptions) => {
            if (options.stream.kafka) {
              return new KafkaStreamAdapter(options.stream.kafka);
            }
            throw new Error('No stream adapter configured'); // Or optional?
          },
          inject: [Tokens.ArqueModuleOptions],
        },
        {
          provide: Tokens.ConfigAdapter,
          useFactory: async (options: ArqueModuleOptions) => {
            if (options.config.mongo) {
              return new MongoConfigAdapter(options.config.mongo);
            }
            if (options.config.postgres) {
              // Added PostgresConfigAdapter support
              return new PostgresConfigAdapter(options.config.postgres);
            }
            throw new Error('No config adapter configured');
          },
          inject: [Tokens.ArqueModuleOptions],
        },
      ],
      exports: [
        Tokens.ConfigAdapter,
        Tokens.StoreAdapter,
        Tokens.StreamAdapter,
      ],
    };
  }
}
