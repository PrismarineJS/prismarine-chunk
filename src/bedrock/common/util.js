const xxhash = require('xxhash-wasm')
let hasher
module.exports = {
  async getChecksum (buffer) {
    if (!hasher) {
      hasher = await xxhash()
    }
    return Buffer.from(hasher.h64Raw(buffer)).readBigUInt64LE(0)
  }
}
