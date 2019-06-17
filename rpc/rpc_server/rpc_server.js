// https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html

// todo: handel rejections
// FIXME: responses to incoming messages is enabled after some time... make it better

import { Service as ServiceClass, Type as TypeClass } from 'protobufjs';
import connectionPromise from './connection_provider';
import servicePromise from '../protobufLoader';

// const AMQP_Options = {
//     host: "amqp://localhost",
//     port: "5672",
//     exchangeName: 'exchangeName'
// };
//
// const protobuf_Options = {
//     path: "/path/to/.proto/file"
// };

export const rpcProvider = async (
  /* handlers function */ handlers,
  /* AQMP_Options */ aqmpOptions,
  protobufOptions
) => {
  const { conn } = await connectionPromise(aqmpOptions.host, aqmpOptions.port);
  const { root } = await servicePromise(protobufOptions.path);

  const allTypeAndServiceNames = Object.keys(root.ServiceProviderProto.nested);

  const allTypes = {};
  const allServiceRaw = {};

  allTypeAndServiceNames.forEach(typeOrService => {
    if (root.ServiceProviderProto.nested[typeOrService] instanceof TypeClass) {
      allTypes[typeOrService] = root.lookupType(typeOrService);
    } else if (root.ServiceProviderProto.nested[typeOrService] instanceof ServiceClass) {
      allServiceRaw[typeOrService] = root.lookupService(typeOrService);
    }
  });

  Object.keys(allServiceRaw).forEach(async serviceName => {
    const rawService = allServiceRaw[serviceName];
    const methodNames = Object.keys(rawService.methods);

    methodNames.forEach(async methodName => {
      const requestTypeName = rawService.methods[methodName].requestType;
      const responseTypeName = rawService.methods[methodName].responseType;
      const requestType = allTypes[requestTypeName];
      const responseType = allTypes[responseTypeName];

      const ch = await conn.createChannel();

      const ex = aqmpOptions.exchangeName;
      ch.assertExchange(ex, 'direct', { durable: true });

      ch.prefetch(10);

      const q = await ch.assertQueue(`${ex}.${rawService.name}.${methodName}`, {
        durable: true
      });
      console.log(`[INFO] ${rawService.name}.${methodName} is ready`);

      ch.bindQueue(q.queue, ex, `${rawService.name}.${methodName}`);

      // const msg = await ch.consume(q.queue);
      // console.log("msg===", msg);

      // cannot be converted to await, because returned object of await ch.consume(q.queue) is different from msg in the callback.
      // cannot be converted to await, because returned object of await ch.consume(q.queue) is different from msg in the callback.
      ch.consume(q.queue, async msg => {
        // console.log("msg === ", msg);

        const reqObj = requestType.decode(msg.content);

        // console.log("reqObj === ", reqObj);

        const validationErrors = requestType.verify(reqObj);

        if (validationErrors) {
          console.log('validationErrors===', validationErrors);
        }

        const resObj = await handlers[`${rawService.name}.${methodName}`](reqObj);

        // console.log("resObj === ", resObj);

        const errMsg = responseType.verify(resObj);

        // console.log("errMsg ===", errMsg);

        if (errMsg) throw Error(errMsg);

        const message = responseType.create(resObj);
        const messageBuffer = responseType.encode(message).finish();

        ch.sendToQueue(msg.properties.replyTo, messageBuffer, {
          correlationId: msg.properties.correlationId,
          persistent: true
        });

        ch.ack(msg);
      });
    });
  });
};
