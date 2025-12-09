import { Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { AppController } from './controllers/app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
