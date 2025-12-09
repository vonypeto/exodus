import { ShutdownSignal } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

import { writeFileSync } from 'fs';
import path from 'path';

const SHUTDOWN_SIGNALS = [
  ShutdownSignal.SIGHUP,
  ShutdownSignal.SIGINT,
  ShutdownSignal.SIGTERM,
];

async function bootstrap() {
  const MODE = process.env['MODE'] || 'app';
  const NODE_ENV = process.env['NODE_ENV'] || 'development';

  if (MODE === 'app') {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks(SHUTDOWN_SIGNALS);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    const port = parseInt(process.env['PORT'] || '3000', 10);
    await app.listen(port);
    // health indicator
    try {
      writeFileSync(path.resolve(process.cwd(), './health'), 'OK');
    } catch {}
    console.log(
      `🚀 Application is running on: http://localhost:${port}/${globalPrefix} [${NODE_ENV}]`
    );
    return;
  }

  // if (MODE === 'async') {
  //   const brokers = (process.env['KAFKA_BROKERS'] || 'localhost:9092')
  //     .split(',')
  //     .map((b) => b.trim())
  //     .filter(Boolean);

  //   const microservice =
  //     await NestFactory.createMicroservice<MicroserviceOptions>(AsyncModule, {
  //       transport: Transport.KAFKA,
  //       options: {
  //         client: { brokers },
  //         consumer: {
  //           groupId: `${
  //             process.env['SERVICE_NAME'] || 'genesis'
  //           }-${MODE}-consumer`,
  //           allowAutoTopicCreation: true,
  //         },
  //       },
  //     });

  //   microservice.enableShutdownHooks(SHUTDOWN_SIGNALS);
  //   await microservice.listen();
  //   try {
  //     writeFileSync(path.resolve(process.cwd(), './health'), 'OK');
  //   } catch {}
  //   console.log(`✅ Kafka async microservice listening [${NODE_ENV}]`);
  //   return;
  // }

  // default fallback: start HTTP app
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(SHUTDOWN_SIGNALS);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = parseInt(process.env['PORT'] || '3000', 10);
  await app.listen(port);
  console.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix} [${NODE_ENV}]`
  );
}

bootstrap().catch((error) => {
  console.error('❌ Service failed to start', error);
  throw error;
});
