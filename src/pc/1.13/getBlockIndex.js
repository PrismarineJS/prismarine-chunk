function getBlockIndex (pos) {
  return (pos.y << 8) | (pos.z << 4) | pos.x
}

module.exports = getBlockIndex
