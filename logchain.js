/* globals fetch */

const sha256 = require('fast-sha256')
const bs58 = require('bs58')
const parallel = require('run-parallel')
const waterfall = require('run-waterfall')

module.exports = class Blockchain {
  constructor (peerBook, me, other) {
    this._me = me
    this._other = other

    this.book = peerBook

    this.last = {
      n: 0,
      op: 'begin',
      hash: '',
      signature: ''
    }
    this.byHash = {}
    this.byN = [this.last]
  }

  get me () {
    return this.book.get(this._me)
  }

  get other () {
    return this.book.get(this._other)
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

    parallel([
      cb =>
        author_key.verify(bs58.decode(hash), bs58.decode(signature), (err, result) => {
          if (err) return callback(err)
          if (result !== true) return callback('failed to verify')
          callback(null)
        }),
      cb => validatebtc(block.btc, cb)
    ], callback)
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

    waterfall([
      latestbtc,
      ({time, hash}, cb) => {
        block.btc = {time, hash}
        let hash_b = blockhash(block, this.last.signature)

        this.me.id.privKey.sign(hash_b, (err, sig) => {
          if (err) return callback(err)

          block.hash = bs58.encode(hash_b)
          block.signature = bs58.encode(sig)

          cb(null, block)
        })
      }
    ], (err, block) => {
      if (err) return callback(err)

      this.addBlock(block, callback)
    })
  }
}

function blockhash ({n, btc, op, prev, author}, prevSignature) {
  return sha256([n, op, prev, btc.hash, author, prevSignature].join('|'))
}

function parseOp (op) {
  let iou = op.match(/iou (\d+(.\d+)?) ([A-Z]+)/)
  if (iou) {
    return {type: 'iou', value: parseFloat(iou[1]), currency: iou[3]}
  }
}

function latestbtc (callback) {
  return fetch('https://blockchain.info/latestblock?cors=true')
    .then(r => r.json())
    .then(block => callback(null, block))
    .catch(callback)
}

function validatebtc ({hash, time}, callback) {
  return fetch(`https://blockchain.info/rawblock/${hash}?cors=true`)
    .then(r => r.json())
    .then(block => {
      if (block.hash === hash && block.time === time) return callback(null, true)
      callback(new Error('hash and time do not match bitcoin block'))
    })
    .catch(callback)
}
