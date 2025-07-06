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
})
