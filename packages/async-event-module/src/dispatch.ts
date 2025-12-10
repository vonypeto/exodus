import { joser } from '@exodus/joser';
import { CompressionTypes, Producer } from 'kafkajs';
import { AsyncEvent } from './types';
import { Logger } from '@nestjs/common';

export async function dispatch(
  dependencies: {
    producer: Producer;
    logger?: Logger;
  },
  context: string | string[],
  event: AsyncEvent,
  opts?: { category?: string }
) {
  const topics = (Array.isArray(context) ? context : [context]).map(
    (topic) => `async-event-${topic}`
  );
  console.log(event, topics);
  const message = {
    value: Buffer.from(JSON.stringify(joser.serialize(event)), 'utf8'),
    headers: {
      category: opts?.category ?? undefined,
      id: event.id.buffer,
      type: event.type,
    },
  };

  await dependencies.producer
    .sendBatch({
      compression: CompressionTypes.GZIP,
      topicMessages: topics.map((topic) => ({
        topic,
        messages: [message],
      })),
    })
    .catch((error) => {
      dependencies.logger?.error('failed to dispatch async event', {
        error,
        event,
        context,
      });
    });
}
