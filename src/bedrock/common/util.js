const xxhash = require('xxhash-wasm')
let hasher
module.exports = {
  async getChecksum (buffer) {
    if (!hasher) {
      hasher = await xxhash()
    }
    return hasher.h64Raw(buffer)
  }
}
