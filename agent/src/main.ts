import { ShutdownSignal } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { writeFileSync } from 'fs';
import path from 'path';
import { AsyncModule } from './async/async-event.module';
import { program } from 'commander';
import { AccountProjectionModule } from './projections/account-projection/account.projection';

// CLI options, similar to Opexa
program
  .option('-m, --mode <mode>', 'app | projection | async', 'app')
  .option(
    '-p, --projections <projections...>',
    'projections to start (comma or space separated)',
    ''
  )
  .version('0.1.0');

program.exitOverride();

let options;
try {
  program.parse(global.argv || process.argv);
  options = program.opts();
} catch (error) {
  // fallback to env vars if CLI fails
  options = {
    mode: process.env['MODE'] || 'app',
    projections: process.env['PROJECTION'] ? [process.env['PROJECTION']] : [],
  };
}

const SHUTDOWN_SIGNALS = [
  ShutdownSignal.SIGHUP,
  ShutdownSignal.SIGINT,
  ShutdownSignal.SIGTERM,
];

async function bootstrap() {
  const MODE = options.mode || 'app';
  const NODE_ENV = process.env['NODE_ENV'] || 'development';

  if (MODE === 'app') {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks(SHUTDOWN_SIGNALS);
    // const globalPrefix = 'api';
    // app.setGlobalPrefix(globalPrefix);

    const port = parseInt(process.env['PORT'] || '3000', 10);
    await app.listen(port);
    try {
      writeFileSync(path.resolve(process.cwd(), './health'), 'OK');
    } catch {}
    console.log(
      `🚀 Application is running on: http://localhost:${port}/ [${NODE_ENV}]`
    );
    return;
  }

  if (MODE === 'projection') {
    const modules = [];

    if (options.projections.includes('account')) {
      modules.push(['account', AccountProjectionModule]);
    }

    await Promise.all(
      modules.map(async ([id, module]) => {
        const ctx = await NestFactory.createApplicationContext(module);

        ctx.enableShutdownHooks(SHUTDOWN_SIGNALS);

        await ctx.init();

        console.info('service started', {
          mode: options.mode,
          environment: NODE_ENV,
          projection: id,
        });
      })
    );

    writeFileSync(path.resolve(process.cwd(), './health'), 'OK');

    return;
  }

  if (MODE === 'async') {
    const brokers = (
      process.env['KAFKA_BROKERS'] ||
      'localhost:9092,localhost:9093,localhost:9094'
    )
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    const microservice =
      await NestFactory.createMicroservice<MicroserviceOptions>(AsyncModule, {
        transport: Transport.KAFKA,
        options: {
          client: { brokers },
          consumer: {
            groupId: `${
              process.env['SERVICE_NAME'] || 'genesis'
            }-${MODE}-consumer`,
            allowAutoTopicCreation: true,
          },
        },
      });

    microservice.enableShutdownHooks(SHUTDOWN_SIGNALS);
    await microservice.listen();
    try {
      writeFileSync(path.resolve(process.cwd(), './health'), 'OK');
    } catch {}
    console.log(`✅ Kafka async microservice listening [${NODE_ENV}]`);
    return;
  }

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
