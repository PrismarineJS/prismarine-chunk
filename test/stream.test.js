/* eslint-env mocha */

const Stream = require('../src/bedrock/common/Stream')
const assert = require('assert')

describe('stream', function () {
  describe('readZigZagVarInt', function () {
    let stream

    beforeEach(function () {
      stream = new Stream()
    })

    it('should correctly write and read a positive number (123456)', function () {
      const hex = writeZigZagVarInt(123456)
      const valueFromStream = stream.readZigZagVarInt()

      assert.equal(hex, '80890f')
      assert.equal(valueFromStream, 123456)
    })

    it('should correctly write and read a negative number (-1236877772)', function () {
      const hex = writeZigZagVarInt(-1236877772)
      const valueFromStream = stream.readZigZagVarInt()

      assert.equal(hex, '9787ca9b09')
      assert.equal(valueFromStream, -1236877772)
    })

    it('should correctly write and read 1529044762', function () {
      const hex = writeZigZagVarInt(1529044762)
      const valueFromStream = stream.readZigZagVarInt()

      assert.equal(hex, 'b4fc9ab20b')
      assert.equal(valueFromStream, 1529044762)
    })

    function writeZigZagVarInt (value) {
      stream.writeZigZagVarInt(value)
      return stream.buffer.slice(0, stream.writeOffset).toString('hex')
    }
  })

  describe('writeVarInt', function () {
    let stream

    beforeEach(function () {
      stream = new Stream()
    })

    it('should encode a negative number as a 5-byte unsigned varint (-1)', function () {
      const hex = writeVarInt(-1)
      const valueFromStream = stream.readVarInt()

      assert.equal(hex, 'ffffffff0f')
      assert.equal(valueFromStream | 0, -1)
    })

    it('should encode the minimum 32-bit integer (-2147483648)', function () {
      const hex = writeVarInt(-2147483648)
      const valueFromStream = stream.readVarInt()

      assert.equal(hex, '8080808008')
      assert.equal(valueFromStream | 0, -2147483648)
    })

    function writeVarInt (value) {
      stream.writeVarInt(value)
      return stream.buffer.slice(0, stream.writeOffset).toString('hex')
    }
  })
})
