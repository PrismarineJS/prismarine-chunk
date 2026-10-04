// Chunk implementations are loaded lazily: a process only ever needs the one matching its bot's version, but a plain
// map of require() calls pulls in every pc and bedrock decoder at import time (hundreds of ms and megabytes of unused
// modules). Each entry below is a thunk; loader() resolves and caches the one it needs on first use. Node's own module
// cache makes the shared entries (several versions mapping to the same file) effectively free after the first resolve.
const chunkImplementations = {
  pc: {
    1.8: () => require('./pc/1.8/chunk'),
    1.9: () => require('./pc/1.9/chunk'),
    '1.10': () => require('./pc/1.9/chunk'),
    1.11: () => require('./pc/1.9/chunk'),
    1.12: () => require('./pc/1.9/chunk'),
    1.13: () => require('./pc/1.13/chunk'),
    1.14: () => require('./pc/1.14/chunk'),
    1.15: () => require('./pc/1.15/chunk'),
    1.16: () => require('./pc/1.16/chunk'),
    1.17: () => require('./pc/1.17/chunk'),
    1.18: () => require('./pc/1.18/chunk'),
    1.19: () => require('./pc/1.18/chunk'),
    '1.20': () => require('./pc/1.18/chunk'),
    1.21: () => require('./pc/1.18/chunk'),
    26.1: () => require('./pc/1.18/chunk')
  },
  bedrock: {
    0.14: () => require('./bedrock/0.14/chunk'),
    '1.0': () => require('./bedrock/1.0/chunk'),
    1.3: () => require('./bedrock/1.3/chunk'),
    1.16: () => require('./bedrock/1.3/chunk'),
    1.17: () => require('./bedrock/1.3/chunk'),
    1.18: () => require('./bedrock/1.18/chunk'),
    1.19: () => require('./bedrock/1.18/chunk'),
    '1.20': () => require('./bedrock/1.18/chunk'),
    1.21: () => require('./bedrock/1.18/chunk')
  }
}

module.exports = loader
// Caching
const blobCache = require('./bedrock/common/BlobCache')
module.exports.BlobEntry = blobCache.BlobEntry
module.exports.BlobType = blobCache.BlobType

// Each implementation is required at most once and then reused, so repeated loader() calls (e.g. a proxy serving
// several bots) stay a plain map lookup rather than re-entering require().
const resolved = {}
function resolveImplementation (type, majorVersion) {
  const key = type + ' ' + majorVersion
  if (resolved[key]) return resolved[key]
  const impls = chunkImplementations[type]
  const thunk = impls && impls[majorVersion]
  if (!thunk) throw new Error(`[Prismarine-chunk] No chunk implementation for ${type} ${majorVersion} found`)
  resolved[key] = thunk()
  return resolved[key]
}

function loader (registryOrVersion) {
  const registry = typeof registryOrVersion === 'string' ? require('prismarine-registry')(registryOrVersion) : registryOrVersion
  const version = registry.version
  if (!version) throw new Error('Specified version does not exist')
  const Implementation = resolveImplementation(version.type, version.majorVersion)
  try {
    return Implementation(registry)
  } catch (e) {
    console.log(`Error while loading ${version.type} - ${version.majorVersion}`)
    throw e
  }
}
