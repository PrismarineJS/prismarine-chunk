const ADDRESS_BITS_PER_WORD = 32

// Returns index of the word containing given bit
function getWordIndex (bitIndex) {
  return bitIndex >> ADDRESS_BITS_PER_WORD
}

// implementation of the bit set of variable length
// heavily based on Java BitSet class
class BitSet {
  constructor () {
    this.words = new Array(1).fill(0)
    this.wordsInUse = 0
  }

  static fromArray (words) {
    const newBitSet = new BitSet()

    newBitSet.words = words.slice()
    newBitSet.wordsInUse = words.length

    return newBitSet
  }

  toArray () {
    return this.words.slice(0, this.wordsInUse)
  }

  getWordAt (wordIndex) {
    return this.words[wordIndex]
  }

  ensureCapacity (requiredCapacity) {
    const currentCapacity = this.words.length
    if (requiredCapacity > currentCapacity) {
      const newCapacity = Math.max(2 * currentCapacity, requiredCapacity)

      this.words.length = newCapacity
      this.words.fill(0, currentCapacity, newCapacity)
    }
  }

  expandTo (wordIndex) {
    const minRequiredSize = wordIndex + 1
    if (this.wordsInUse < minRequiredSize) {
      this.ensureCapacity(minRequiredSize)
      this.wordsInUse = minRequiredSize
    }
  }

  recalculateWordsInUse () {
    let i
    for (i = this.wordsInUse - 1; i >= 0; i--) {
      if (this.words[i] !== 0) {
        break
      }
    }
    this.wordsInUse = i + 1
  }

  merge (otherBitSet) {
    // Make sure we have enough space for merging
    this.expandTo(otherBitSet.wordsInUse - 1)

    for (let i = 0; i < otherBitSet.wordsInUse; i++) {
      this.words[i] |= otherBitSet.words[i]
    }
  }

  set (bitIndex) {
    if (bitIndex < 0) {
      throw new Error('Negative bit index passed to BitSet')
    }
    const wordIndex = getWordIndex(bitIndex)
    this.expandTo(wordIndex)

    this.words[wordIndex] |= (1 << bitIndex)
  }

  clear (bitIndex) {
    if (bitIndex < 0) {
      throw new Error('Negative bit index passed to BitSet')
    }
    const wordIndex = getWordIndex(bitIndex)
    if (wordIndex >= this.wordsInUse) {
      return
    }
    this.words[wordIndex] &= ~(1 << bitIndex)
    this.recalculateWordsInUse()
  }

  get (bitIndex) {
    if (bitIndex < 0) {
      throw new Error('Negative bit index passed to BitSet')
    }
    const wordIndex = getWordIndex(bitIndex)

    return (wordIndex < this.wordsInUse) &&
      ((this.words[wordIndex] & (1 << bitIndex)) !== 0)
  }
}

module.exports = BitSet
