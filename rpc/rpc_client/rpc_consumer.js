// import 'babel-polyfill';

import uuid from 'uuid/v1';
import { Service as ServiceClass, Type as TypeClass } from 'protobufjs';
import channelPromise from './channel_provider';
import servicePromise from '../protobufLoader';

export const rpcProvider = async (/* AQMP_Options */ AMQP_Options, protobuf_Options) => {
  const { channel, queue } = await channelPromise(
    AMQP_Options.host,
    AMQP_Options.port,
    AMQP_Options.queue_options,
    AMQP_Options.exchange_name
  );
  const { root } = await servicePromise(protobuf_Options.path);

  const callbackCorrMap = [];

  channel.consume(
    queue.queue,
    function(msg) {
      const callbackObject = callbackCorrMap.find(x => x.corr === msg.properties.correlationId);
      /* todo: consider this scenario:
         if RPC consumer sends a message while the server is down.
         After that consumer restarts and server starts.
         In this case server responds to message witch there is no a callback listening to it in consumer side.
         Maybe using a pure client, server arch (like in the web) is necessary to solve this issue (If its important).
         */

      // console.log("msg.content.length ===", msg.content.length);
      // console.log("msg.content ===", msg.content.toString());
      callbackObject.callback(null, msg.content);
      callbackCorrMap.splice(callbackCorrMap.indexOf(callbackObject), 1);
    },
    { noAck: true }
  );

  function RPCImpl(method, requestBuffer, callback) {
    const corr = uuid();

    // todo: do the message verification here
    // todo: problem, here we do not have access to plain object to verify it, we should transfer the buffer to object that is not efficient
    // callback(new Error("this is a test error"));

    // const validationErrors = method.resolvedRequestType.verify(requestBuffer);
    // console.log("validationErrors===", validationErrors);
    //
    // if (validationErrors) {
    //     reject(validationErrors);
    // }

    // console.log("binding key ===", method.parent.name + "." + method.name);

    channel.publish(
      AMQP_Options.exchange_name,
      /* supports only 2 nested methods */ `${method.parent.name}.${method.name}`,
      requestBuffer,
      {
        correlationId: corr,
        replyTo: queue.queue,
        persistent: AMQP_Options.send_options.persistent
      }
    );
    callbackCorrMap.push({ corr, callback });
  }

  const allTypeAndServiceNames = Object.keys(root.ServiceProviderProto.nested);

  const allTypes = {};
  const allServiceImpl = {};
  const allServiceRaw = {};

  allTypeAndServiceNames.forEach(typeOrService => {
    if (root.ServiceProviderProto.nested[typeOrService] instanceof TypeClass) {
      // console.log(typeOrService, "is a type");
      allTypes[typeOrService] = root.lookupType(typeOrService);
    } else if (root.ServiceProviderProto.nested[typeOrService] instanceof ServiceClass) {
      // console.log(typeOrService, "is a service");
      allServiceRaw[typeOrService] = root.lookupService(typeOrService);
      allServiceImpl[typeOrService] = allServiceRaw[typeOrService].create(
        /* see above */ RPCImpl,
        /* request delimited? */ false,
        /* response delimited? */ false
      );
    }
  });

  Object.keys(allServiceRaw).forEach(serviceName => {
    const rawService = allServiceRaw[serviceName];
    const implService = allServiceImpl[serviceName];
    const methodNames = Object.keys(rawService.methods);

    methodNames.forEach(methodName => {
      implService[`_v_${methodName}`] = async requestObj => {
        return new Promise((resolve, reject) => {
          const requestTypeName = rawService.methods[methodName].requestType;
          // console.log(requestTypeName);
          const validationErrors = allTypes[requestTypeName].verify(requestObj);
          // console.log("validationErrors===", validationErrors);

          if (validationErrors) {
            reject(validationErrors);
          } else {
            implService[methodName](/* request object */ requestObj, function(err, response) {
              if (err) {
                reject(err);
              } else {
                resolve(response);
              }
            });
          }
        });
      };
    });
  });

  return {
    services: allServiceImpl,
    types: allTypes
  };
};
