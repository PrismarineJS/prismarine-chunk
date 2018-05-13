// Taken from bit-twiddle library
const REVERSE_TABLE = new Array(256);

(function (tab) {
  for (let i = 0; i < 256; ++i) {
    let v = i
    let r = i
    let s = 7
    for (v >>>= 1; v; v >>>= 1) {
      r <<= 1
      r |= v & 1
      --s
    }
    tab[i] = (r << s) & 0xff
  }
})(REVERSE_TABLE)

module.exports.reverseBits32 = (v) =>
  (REVERSE_TABLE[v & 0xff] << 24) |
  (REVERSE_TABLE[(v >>> 8) & 0xff] << 16) |
  (REVERSE_TABLE[(v >>> 16) & 0xff] << 8) |
  REVERSE_TABLE[(v >>> 24) & 0xff]

module.exports.reverseBits16 = (v) =>
  (REVERSE_TABLE[v & 0xff] << 8) |
  REVERSE_TABLE[(v >>> 8) & 0xff]

module.exports.reverseBits = (data, n) => {
  let datau = data >>> 0// Coerce unsigned.
  let storage = 0
  for (let i = 0; i < n; i++) {
    storage = storage | (datau & 1)
    if (i !== n - 1) {
      storage = storage << 1
      datau = datau >>> 1
    }
  }
  return storage
}
