import { Inject } from '@nestjs/common';
import { joser } from '@exodus/joser';
import { Queue } from 'bullmq';
import { Producer } from 'kafkajs';
import { dispatch } from './dispatch';
import { Tokens } from './tokens';
import { AsyncEvent, AsyncEventDispatcherModuleOptions } from './types';

export class AsyncEventDispatcherService {
  constructor(
    @Inject(Tokens.AsyncEventDispatchModuleOptions)
    private readonly options: AsyncEventDispatcherModuleOptions,
    @Inject(Tokens.KafkaProducer)
    private readonly producer: Producer,
    @Inject(Tokens.BullMQQueue)
    private readonly queue: Queue
  ) {}

  async dispatch<T extends AsyncEvent>(
    context: string | string[],
    event: T,
    opts?: { delay?: number; category?: string }
  ) {
    if (opts?.delay) {
      if (!this.queue) {
        this.options.logger?.error('queue is not configured', {
          context,
          event,
          opts,
        });

        return;
      }

      await this.queue.add(
        'DispatchDelayedAsyncEvent',
        joser.serialize({
          context,
          event,
          opts,
        }),
        {
          delay: opts.delay,
        }
      );

      return;
    }

    await dispatch(
      {
        producer: this.producer,
        logger: this.options.logger,
      },
      context,
      event,
      opts
    );
  }
}
