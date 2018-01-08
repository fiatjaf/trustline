const sha256 = require('fast-sha256')
const bs58 = require('bs58')

module.exports = class Blockchain {
  constructor (me, other) {
    this.me = me
    this.other = other

    this.last = {
      n: 0,
      op: 'begin',
      hash: '',
      signature: ''
    }
    this.byHash = {}
    this.byN = [this.last]
  }

  addBlock (block, callback) {
    this.validateBlock(block, invalidReason => {
      if (invalidReason) {
        return callback(new Error(invalidReason))
      }

      this.byHash[block.hash] = block
      this.byN[block.n] = block
      this.last = block
      callback(null, block)
    })
  }

  validateBlock (block, callback) {
    let {op, author, n, prev, hash, signature} = block

    if (this.last.hash !== prev) {
      return callback('last hash is not current last hash')
    }
    if (this.last.n + 1 !== n) {
      return callback('this block # is not equal to previous # + 1')
    }
    if (!parseOp(op)) {
      return callback('invalid op: ' + op)
    }
    if (hash !== bs58.encode(blockhash(block, this.byN[n - 1].signature))) {
      return callback('hash does not match')
    }

    var author_key
    if (author === bs58.encode(this.me.id.marshalPubKey())) {
      author_key = this.me.id.pubKey
    } else if (author === bs58.encode(this.other.id.marshalPubKey())) {
      author_key = this.other.id.pubKey
    } else {
      return callback('block author does not belong to this trustline')
    }

    author_key.verify(bs58.decode(hash), bs58.decode(signature), (err, result) => {
      if (err) return callback(err)
      if (result !== true) return callback('failed to verify')
      callback(null)
    })
  }

  issueIOU (amount, currency, callback) {
    let n = this.last.n + 1
    let op = `iou ${amount} ${currency.toUpperCase()}`

    var block = {
      n,
      op,
      prev: this.last.hash,
      author: bs58.encode(this.me.id.marshalPubKey()),
      hash: undefined,
      signature: undefined
    }

    let hash_b = blockhash(block, this.last.signature)

    this.me.id.privKey.sign(hash_b, (err, sig) => {
      if (err) return callback(err)

      block.hash = bs58.encode(hash_b)
      block.signature = bs58.encode(sig)

      this.addBlock(block, callback)
    })
  }
}

function blockhash ({n, op, prev, author}, prevSignature) {
  return sha256([n, op, prev, author, prevSignature].join('|'))
}

function parseOp (op) {
  let iou = op.match(/iou (\d+(.\d+)?) ([A-Z]+)/)
  if (iou) {
    return {type: 'iou', value: parseFloat(iou[1]), currency: iou[3]}
  }
}
