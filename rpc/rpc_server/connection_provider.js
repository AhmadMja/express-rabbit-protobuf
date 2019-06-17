const amqp = require('amqplib');

export default async (/* RabbitMQ server address */ host, /* RabbitMQ listening port */ port) => {
  const conn = await amqp.connect(`${host || 'amqp://localhost'}:${port || '5672'}`);
  return { conn };
};
