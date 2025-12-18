import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { PostgresStoreAdapter } from './adapters/postgres';
import { MongoStoreAdapter } from './adapters/mongo';
import { MongoConfigAdapter } from './adapters/mongo-config';
import { KafkaStreamAdapter } from './adapters/kafka';
import { StoreAdapter, StreamAdapter, ConfigAdapter } from './core';

export interface ArqueModuleOptions {
  config?: {
    mongo?: any; // Define usage specific types if possible, using any for flexibility now
  };
  store?: {
    mongo?: any;
    postgres?: any;
  };
  stream?: {
    kafka?: any;
  };
}

export interface ArqueModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<ArqueModuleOptions> | ArqueModuleOptions;
  inject?: any[];
}

export const ARQUE_STORE_ADAPTER = 'ARQUE_STORE_ADAPTER';
export const ARQUE_STREAM_ADAPTER = 'ARQUE_STREAM_ADAPTER';
export const ARQUE_CONFIG_ADAPTER = 'ARQUE_CONFIG_ADAPTER';

@Global()
@Module({})
export class ArqueModule {
  static forRootAsync(options: ArqueModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: ARQUE_STORE_ADAPTER,
        useFactory: async (config: ArqueModuleOptions) => {
          if (config.store?.postgres) {
            const adapter = new PostgresStoreAdapter(config.store.postgres);
            await adapter.init();
            return adapter;
          } else if (config.store?.mongo) {
            const adapter = new MongoStoreAdapter(config.store.mongo);
            await adapter.init();
             return adapter;
          }
          throw new Error('No store adapter configured');
        },
        inject: ['ARQUE_MODULE_OPTIONS'],
      },
      {
         provide: ARQUE_STREAM_ADAPTER,
         useFactory: async (config: ArqueModuleOptions) => {
             if (config.stream?.kafka) {
                 const adapter = new KafkaStreamAdapter(config.stream.kafka);
                 await adapter.init(); // Assuming init needed
                 return adapter;
             }
             return null; // Stream might be optional?
         },
         inject: ['ARQUE_MODULE_OPTIONS']
      },
      {
          provide: ARQUE_CONFIG_ADAPTER,
          useFactory: async (config: ArqueModuleOptions) => {
              if (config.config?.mongo) {
                  const adapter = new MongoConfigAdapter(config.config.mongo);
                  await adapter.init(); // Assuming init
                  return adapter;
              }
              return null;
          },
          inject: ['ARQUE_MODULE_OPTIONS']
      },
      {
        provide: 'ARQUE_MODULE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];

    return {
      module: ArqueModule,
      providers: providers,
      exports: [ARQUE_STORE_ADAPTER, ARQUE_STREAM_ADAPTER, ARQUE_CONFIG_ADAPTER],
    };
  }
}
