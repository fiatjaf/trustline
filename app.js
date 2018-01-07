/* global Elm */

const PeerBook = require('peer-book')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')

const createNode = require('./create-node')

// var knownPeers = JSON.parse(localStorage.getItem('known-peers') || '{}')
var tried = new PeerBook()
var book = new PeerBook()
var queue = new Map()

const app = Elm.Main.fullscreen()

createNode((err, node) => {
  if (err) {
    return console.warn('could not create the Node', err)
  }

  node.on('peer:discovery', (peerInfo) => {
    console.log('discovered a peer', peerInfo.id.toB58String())
    if (tried.has(peerInfo)) return
    if (book.has(peerInfo)) return

    console.log(' > dialing', peerInfo.id.toB58String())
    node.dial(peerInfo, '/trustline/0.0.1', (err, conn) => {
      if (err) {
        // console.log('  $$$ failed to dial', peerInfo.id.toB58String(), err)
        tried.put(peerInfo)
        return
      }

      console.log('  [] connected to', peerInfo.id.toB58String())
      handleConnection(peerInfo, conn)
    })
  })

  node.on('peer:connect', (peerInfo) => {
    console.log(' > got connection to: ' + peerInfo.id.toB58String())
  })

  node.on('peer:disconnect', (peerInfo) => {
    console.log(' > lost connection to: ' + peerInfo.id.toB58String())
  })

  node.start((err) => {
    if (err) {
      return console.log('failed to start node, maybe WebRTC is not supported')
    }

    const idStr = node.peerInfo.id.toB58String()
    console.log('node is listening!', idStr)

    node.handle('/trustline/0.0.1', (protocol, conn) => {
      console.log('  [] got call on ' + protocol)

      conn.getPeerInfo((err, peerInfo) => {
        if (err) {
          console.log(err)
          return
        }

        handleConnection(peerInfo, conn)
      })
    })

    // NOTE: to stop the node
    // node.stop((err) => {})
  })
})

app.ports.sendMessage.subscribe(([peerId, text]) => {
  let p = queue.get(peerId)
  p.push(text)
})

function handleConnection (peerInfo, conn) {
  book.put(peerInfo)
  app.ports.gotConnection.send(peerInfo.id.toB58String())

  if (!queue.has(peerInfo.id.toB58String())) {
    let p = Pushable()

    queue.set(peerInfo.id.toB58String(), p)

    pull(
      p,
      conn
    )

    pull(
      conn,
      pull.map(data => data.toString('utf8').replace('\n', '')),
      pull.drain(text => {
        app.ports.gotMessage.send([peerInfo.id.toB58String(), text])
      })
    )
  }
}
