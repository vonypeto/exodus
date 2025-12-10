import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from './config.service';
import { Tokens } from './tokens';
import { ConfigModuleOptions } from './types';

@Module({})
export class ConfigModule {
  static forRoot(options?: ConfigModuleOptions): DynamicModule {
    return {
      global: true,
      module: ConfigModule,
      providers: [
        {
          provide: Tokens.ConfigOptions,
          useValue: options,
        },
        ConfigService,
      ],
      exports: [ConfigService],
    };
  }
}
