module.exports = {
  rpc_client: (/* AQMP Options */ AQMP_Options, /* protocol buffer options */ protobuf_Options) => {
    return require('./rpc_client/rpc_consumer').rpcProvider(AQMP_Options, protobuf_Options);
  },
  rpcServer: (
    handlers,
    /* AQMP Options */ AQMP_Options,
    /* protocol buffer options */ protobuf_Options
  ) => {
    return require('./rpc_server/rpc_server').rpcProvider(handlers, AQMP_Options, protobuf_Options);
  }
};
