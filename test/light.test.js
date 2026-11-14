/* eslint-env mocha */

const assert = require('assert')
const { Vec3 } = require('vec3')
const { pcVersions } = require('./versions')

function sectionLocalIndex (x, y, z) {
  return ((y & 15) << 8) | (z << 4) | x
}

function readNibble (buf, index) {
  return (index & 1) ? (buf[index >> 1] >> 4) : (buf[index >> 1] & 15)
}

const pattern = (x, y, z) => ((x * 5) + (z * 7) + (y * 11) + 1) & 15

for (const version of pcVersions) {
  if (version.startsWith('bedrock')) continue
  const registry = require('prismarine-registry')(version)
  const ChunkColumn = require('prismarine-chunk')(registry)
  const sep = registry.supportFeature('lightSentSeparately')
  const newFmt = registry.supportFeature('newLightingDataFormat')

  describe('light ' + version, () => {
    const solid = registry.blocksByName.stone?.defaultState ?? 1

    function fill (column) {
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          for (let y = 0; y < 16; y++) {
            const pos = new Vec3(x, y, z)
            column.setBlockStateId(pos, solid)
            const v = pattern(x, y, z)
            column.setBlockLight(pos, v)
            column.setSkyLight(pos, v)
          }
        }
      }
    }

    function assertMatches (column) {
      for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
          for (let y = 0; y < 16; y++) {
            const v = pattern(x, y, z)
            assert.strictEqual(column.getBlockLight(new Vec3(x, y, z)), v, `blockLight ${x},${y},${z}`)
            assert.strictEqual(column.getSkyLight(new Vec3(x, y, z)), v, `skyLight ${x},${y},${z}`)
          }
        }
      }
    }

    it('block and sky light survive a wire serialization round-trip', () => {
      const column = new ChunkColumn()
      fill(column)
      assertMatches(column)

      const column2 = new ChunkColumn()
      if (newFmt) {
        const d = column.dumpLight()
        column2.loadParsedLight(d.skyLight, d.blockLight, d.skyLightMask, d.blockLightMask, d.emptySkyLightMask, d.emptyBlockLightMask)
      } else if (sep) {
        const d = column.dumpLight()
        column2.loadLight(d, column.skyLightMask, column.blockLightMask, column.emptySkyLightMask ?? 0, column.emptyBlockLightMask ?? 0)
      } else {
        const buf = column.dump()
        column2.load(buf, column.getMask(), true)
      }
      assertMatches(column2)
    })

    if (sep) {
      it('dumped light bytes are in real Minecraft nibble order', () => {
        const column = new ChunkColumn()
        fill(column)

        let skyBytes, blockBytes
        if (newFmt) {
          const d = column.dumpLight()
          skyBytes = Buffer.from(d.skyLight[0])
          blockBytes = Buffer.from(d.blockLight[0])
        } else {
          const d = column.dumpLight()
          let off = 0
          const readSec = () => {
            let shift = 0
            let value = 0
            let b
            do { b = d[off++]; value |= (b & 0x7f) << shift; shift += 7 } while (b & 0x80)
            const sec = d.subarray(off, off + value)
            off += value
            return sec
          }
          skyBytes = readSec()
          blockBytes = readSec()
        }

        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            for (let y = 0; y < 16; y++) {
              const idx = sectionLocalIndex(x, y, z)
              const v = pattern(x, y, z)
              assert.strictEqual(readNibble(blockBytes, idx), v, `block nibble ${x},${y},${z}`)
              assert.strictEqual(readNibble(skyBytes, idx), v, `sky nibble ${x},${y},${z}`)
            }
          }
        }
      })
    }
  })
}
