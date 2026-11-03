// Read `count` 32-bit big-endian values straight from the SmartBuffer's backing buffer into `data`
// (section longs are stored high word first, so each pair is written i+1 then i), advancing the
// buffer's read offset once at the end. This avoids SmartBuffer's per-value readUInt32BE, which does
// a bounds check and an offset write on every one of the ~count reads in a section.
function readSectionLongs (smartBuffer, data, count) {
  const buf = smartBuffer.internalBuffer
  let off = smartBuffer.readOffset
  for (let i = 0; i < count; i += 2) {
    data[i + 1] = buf.readUInt32BE(off); off += 4
    data[i] = buf.readUInt32BE(off); off += 4
  }
  smartBuffer.readOffset = off
}

module.exports = { readSectionLongs }
