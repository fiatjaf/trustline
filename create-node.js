const PeerInfo = require('peer-info')
const PeerId = require('peer-id')
const Node = require('./browser-bundle')

function createPeer (callback) {
  let myself = localStorage.getItem('my-id')

  if (myself) {
    PeerId.createFromJSON(JSON.parse(myself), (err, peerId) => {
      if (err) {
        return callback(err)
      }

      callback(null, new PeerInfo(peerId))
    })
  } else {
    PeerInfo.create(callback)
  }
}

function createNode (callback) {
  createPeer((err, peerInfo) => {
    if (err) {
      return callback(err)
    }

    localStorage.setItem('my-id', JSON.stringify(peerInfo.id.toJSON()))

    const pis = peerInfo.id.toB58String()
    const ma = `/dns4/star-signal.cloud.ipfs.team/tcp/443/wss/p2p-webrtc-star/ipfs/${pis}`
    peerInfo.multiaddrs.add(ma)

    const node = new Node(peerInfo)

    node.idStr = pis
    callback(null, node)
  })
}

module.exports = createNode
