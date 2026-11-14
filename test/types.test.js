/* eslint-env mocha */

const { execFileSync } = require('child_process')
const path = require('path')

describe('types', function () {
  this.timeout(60 * 1000)

  it('type checks usage', () => {
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(__dirname, 'types')], { stdio: 'inherit' })
  })
})
