import {
  Inject,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import {
  ArqueModule,
  Tokens as ArqueModuleTokens,
} from '@exodus/nestjs-arque-module';
import { ConfigModule, ConfigService } from '@exodus/config';
import { Connection } from 'mongoose';
import {
  ArqueKafkaStreamAdapterSerializers,
  ArqueMongoStoreAdapterSerializers,
} from '../../libs/serializers';
import { MemberAccountCreatedEventHandler } from './handlers/member-account-created.handler';
import { AccountProjectionState } from './libs/types';
import {
  Broker,
  ConfigAdapter,
  Projection,
  StoreAdapter,
  StreamAdapter,
} from '@exodus/arque';
import { AccountService } from '../../features/account-model/account.service';
import { AccountModule } from '../../features/account-model/account.module';

@Module({
  imports: [
    ConfigModule.forRoot(),

    MongooseModule.forRootAsync({
      useFactory: async (config: ConfigService) => ({
        uri: await config.getString('AGENT_MONGODB_URI'),
        minPoolSize: Math.floor(
          (config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10) *
            0.4
        ),
        maxPoolSize:
          config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10,
        socketTimeoutMS: 60000,
        heartbeatFrequencyMS: 2000,
        serverSelectionTimeoutMS: 30000,
        autoIndex: config.getString('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    ArqueModule.forRootAsync({
      useFactory: async (config: ConfigService) => {
        return {
          config: {
            mongo: {
              uri: config.getString('EVENT_STORE_MONGODB_URI'),
              maxPoolSize: config.getNumber(
                'ARQUE_CONFIG_MONGO_MAX_POOL_SIZE',
                { optional: true }
              ),
            },
          },
          store: {
            mongo: {
              uri: config.getString('EVENT_STORE_MONGODB_URI'),
              serializers: ArqueMongoStoreAdapterSerializers,
              maxPoolSize: config.getNumber('ARQUE_STORE_MONGO_MAX_POOL_SIZE', {
                optional: true,
              }),
            },
          },
          stream: {
            kafka: {
              brokers: [
                ...new Set(
                  config.getString('KAFKA_BROKERS').split(',')
                ).values(),
              ],
              serializers: ArqueKafkaStreamAdapterSerializers,
              prefix: 'exodus',
              minBytes:
                config.getString('NODE_ENV') === 'production' ? 1024 : 1,
              maxBytes: 1024 * 1024 * 10,
              maxBytesPerPartition: 1024 * 1024 * 2,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    // CounterModule.forRootAsync({
    //   useFactory: async (connection: Connection) => ({
    //     connection,
    //   }),
    //   inject: [getConnectionToken()],
    // }),

    AccountModule,
  ],
})
export class AccountProjectionModule
  implements OnApplicationShutdown, OnApplicationBootstrap
{
  private readonly broker: Broker;
  private readonly projection: Projection;

  constructor(
    @Inject(ArqueModuleTokens.StoreAdapter)
    readonly store: StoreAdapter,
    @Inject(ArqueModuleTokens.StreamAdapter)
    readonly stream: StreamAdapter,
    @Inject(ArqueModuleTokens.ConfigAdapter)
    readonly config: ConfigAdapter,
    @Inject(getConnectionToken())
    readonly connection: Connection,
    readonly account: AccountService
  ) {
    this.broker = new Broker(config, stream);
    this.projection = new Projection(
      store,
      stream,
      config,
      [MemberAccountCreatedEventHandler],
      'agent.projection.account',
      <AccountProjectionState>{
        connection,
        account,
      }
    );
  }

  async onApplicationBootstrap() {
    await this.broker.start();
    await this.projection.start();
  }

  async onApplicationShutdown() {
    await this.projection.stop();
    await this.broker.stop();
  }
}
