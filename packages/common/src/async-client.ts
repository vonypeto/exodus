import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { joser } from './joser';

export async function createAsyncClient(params: {
  brokers: string[];
  id: string;
}) {
  const client = ClientProxyFactory.create({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'cron',
        brokers: params.brokers,
      },
      serializer: {
        serialize: (value) => {
          return {
            key: null,
            value: JSON.stringify(joser.serialize(value)),
          };
        },
      },
      producer: {
        idempotent: true,
      },
    },
  });

  await client.connect();

  return client;
}
