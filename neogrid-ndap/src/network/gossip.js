const { messageHash, MESSAGE_TYPES } = require('./message');

const MAX_SEEN = 10000;

class GossipLayer {
  constructor(peers) {
    this._peers    = peers;
    this._seen     = new Set();
    this._seenList = []; // maintain insertion order for eviction
  }

  isDuplicate(msg) {
    return this._seen.has(messageHash(msg));
  }

  markSeen(msg) {
    const h = messageHash(msg);
    if (this._seen.has(h)) return;
    this._seen.add(h);
    this._seenList.push(h);
    if (this._seenList.length > MAX_SEEN) {
      this._seen.delete(this._seenList.shift());
    }
  }

  forward(msg, senderWs = null) {
    this._peers.broadcast(msg, senderWs);
  }

  receive(msg, senderWs, handlers) {
    if (this.isDuplicate(msg)) return false;
    this.markSeen(msg);

    const handler = handlers[msg.type];
    if (handler) handler(msg, senderWs);

    if (msg.type === MESSAGE_TYPES.STATE_UPDATE ||
        msg.type === MESSAGE_TYPES.TRANSACTION_BROADCAST) {
      this.forward(msg, senderWs);
    }

    return true;
  }

  seenCount() {
    return this._seen.size;
  }
}

module.exports = { GossipLayer };
