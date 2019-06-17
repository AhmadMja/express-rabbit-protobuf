const protobuf = require('protobufjs');

export default async (/* Path to .proto file */ path) => {
  return await protobuf.load(path);
};
