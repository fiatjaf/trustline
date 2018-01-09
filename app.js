/* global Elm */

const PeerBook = require('peer-book')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')

const createNode = require('./create-node')
const Blockchain = require('./logchain.js')

// var knownPeers = JSON.parse(localStorage.getItem('known-peers') || '{}')
var tried = new PeerBook()
var book = new PeerBook()
var queue = new Map()
var logchains = {}

const app = Elm.Main.fullscreen()

createNode((err, node) => {
  if (err) {
    return console.warn('could not create the Node', err)
  }

  node.on('peer:discovery', (peerInfo) => {
    // console.log('discovered a peer', peerInfo.id.toB58String())
    if (tried.has(peerInfo)) return
    if (book.has(peerInfo)) return

    node.dial(peerInfo, '/trustline/0.0.1', (err, conn) => {
      if (err) {
        // console.log('  $$$ failed to dial', peerInfo.id.toB58String(), err)
        tried.put(peerInfo)
        return
      }

      handleConnection(node.peerInfo, peerInfo, conn)
    })
  })

  node.on('peer:connect', (peerInfo) => {
    // console.log(' > got connection to: ' + peerInfo.id.toB58String())
  })

  node.on('peer:disconnect', (peerInfo) => {
    // console.log(' > lost connection to: ' + peerInfo.id.toB58String())
  })

  node.start((err) => {
    if (err) {
      return console.log('failed to start node, maybe WebRTC is not supported')
    }

    book.put(node.peerInfo)

    console.log('node is listening!', node.peerInfo.id.toB58String())
    app.ports.gotMyself.send(node.peerInfo.id.toB58String())

    node.handle('/trustline/0.0.1', (protocol, conn) => {
      conn.getPeerInfo((err, peerInfo) => {
        if (err) {
          console.log(err)
          return
        }

        handleConnection(node.peerInfo, peerInfo, conn)
      })
    })

    app.ports.issueIOU.subscribe(issueIOU)

    // NOTE: to stop the node
    // node.stop((err) => {})
  })
})

function issueIOU ([toId, amount, currency]) {
  let chain = logchains[toId]
  chain.issueIOU(amount, currency, (err, block) => {
    if (err) {
      console.warn('error issuing IOU', err)
    } else {
      app.ports.gotBlock.send([toId, block])
      let p = queue.get(toId)
      p.push(`new-block ~ ${JSON.stringify(block)}`)
    }
  })
}

function handleConnection (me, peerInfo, conn) {
  book.put(peerInfo)

  let idStr = peerInfo.id.toB58String()
  if (!(idStr in logchains)) {
    logchains[idStr] = new Blockchain(book, me, peerInfo)
  }

  app.ports.gotConnection.send(idStr)

  let p = Pushable()

  queue.set(idStr, p)

  pull(
    p,
    conn
  )

  pull(
    conn,
    pull.map(data => data.toString('utf8').replace('\n', '')),
    pull.drain(text => {
      handleMessage(peerInfo, text)
    })
  )

  // start by requesting old blocks
  let chain = logchains[idStr]
  p.push(`get-block-at ~ ${chain.last.n + 1}`)
}

function handleMessage (peerInfo, message) {
  let [kind, payload] = message.split(' ~ ')

  let idStr = peerInfo.id.toB58String()
  let p = queue.get(idStr)
  let chain = logchains[idStr]

  switch (kind) {
    case 'requested-block':
      chain.addBlock(JSON.parse(payload), (err, block) => {
        if (err) {
          return console.warn('requested block was invalid', block, err)
        }
        p.push(`get-block-at ${block.n + 1}`)
      })
      break
    case 'query-chain-height':
      p.push(`response-chain-height ${chain.last.n}`)
      break
    case 'response-chain-height':
      if (parseInt(payload) === chain.last.n) {
        console.log(`we're up to date (at height ${chain.last.n})`)
      } else {
        p.push(`get-block-at ${chain.last.n + 1}`)
      }
      break
    case 'block-not-found-at':
      p.push(`query-chain-height`)
      break
    case 'get-block-at':
      let block = chain.byN[parseInt(payload)]
      if (block) {
        p.push(`requested-block ~ ${JSON.stringify(block)}`)
      } else {
        p.push(`block-not-found-at ~ ${payload}`)
      }
      break
    case 'new-block':
      chain.addBlock(JSON.parse(payload), (err, block) => {
        if (err) {
          console.warn('new block was invalid', block, err)
          p.push(`rejected-new-block ~ ${block.hash}: ${err}`)
        } else {
          console.log('received new block', block)
          app.ports.gotBlock.send([idStr, block])
          p.push(`added-new-block ~ ${block.hash}`)
        }
      })
      break
    case 'added-new-block':
      console.log(`our new block was added: ${payload}`)
      break
    case 'rejected-new-block':
      console.warn(`we've send and invalid block: ${payload}`)
      break
    default:
      return
  }
}
