const protobuf = require('protobufjs');

export default async (/* String */ path) => {
  return await protobuf.load(path);
};
