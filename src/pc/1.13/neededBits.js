/**
 * Gives the number of bits needed to represent the value
 * @param {number} value
 * @returns {number} bits
 */
function neededBits (value) {
  let result = 0
  while (true) {
    value >>= 1
    result += 1

    if (value === 0) {
      break
    }
  }

  return result
}

module.exports = neededBits
