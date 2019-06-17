const amqp = require('amqplib');

export default async (
  /* RabbitMQ server address */ host,
  /* RabbitMQ listening port */ port,
  /* queue options */ queueOptions,
  exchangeName
) => {
  // console.log("host===", host);
  const connection = await amqp.connect(`${host || 'amqp://localhost'}:${port || '5672'}`);
  const channel = await connection.createChannel();
  channel.assertExchange(exchangeName, 'direct', { durable: true });
  const queue = await channel.assertQueue('', queueOptions);
  return { channel, queue };
};
