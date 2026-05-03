const { MESSAGE_TYPES, createMessage, messageHash, serializeMessage, parseMessage } = require('../src/network/message');
const { PeerManager } = require('../src/network/peer');
const { GossipLayer }  = require('../src/network/gossip');
const { validate }     = require('../src/network/validator');

module.exports = async function(test, suite, assert) {

  await suite('Network — message protocol', async () => {

    await test('createMessage returns correct structure', async () => {
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'node-1', { smtRoot: 'abc', mmrRoot: 'def' });
      assert.strictEqual(msg.type, 'STATE_UPDATE');
      assert.strictEqual(msg.nodeId, 'node-1');
      assert.ok(typeof msg.timestamp === 'number');
      assert.strictEqual(msg.signature, null);
      assert.deepStrictEqual(msg.payload, { smtRoot: 'abc', mmrRoot: 'def' });
    });

    await test('createMessage throws on unknown type', async () => {
      assert.throws(() => createMessage('UNKNOWN_TYPE', 'node-1', {}), /Unknown message type/);
    });

    await test('messageHash is deterministic', async () => {
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'node-1', { smtRoot: 'r1', mmrRoot: 'r2' });
      assert.strictEqual(messageHash(msg), messageHash(msg));
    });

    await test('messageHash differs for different payloads', async () => {
      const a = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'node-1', { smtRoot: 'r1', mmrRoot: 'r2' });
      const b = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'node-1', { smtRoot: 'r3', mmrRoot: 'r4' });
      assert.notStrictEqual(messageHash(a), messageHash(b));
    });

    await test('serializeMessage and parseMessage round-trip', async () => {
      const msg = createMessage(MESSAGE_TYPES.SYNC_REQUEST, 'node-2', { lastKnownRoot: 'abc123' });
      const raw = serializeMessage(msg);
      const parsed = parseMessage(raw);
      assert.strictEqual(parsed.type, msg.type);
      assert.strictEqual(parsed.nodeId, msg.nodeId);
      assert.deepStrictEqual(parsed.payload, msg.payload);
    });

    await test('parseMessage rejects malformed JSON', async () => {
      assert.throws(() => parseMessage('{bad json}'), /Invalid JSON/);
    });

    await test('parseMessage rejects message missing required fields', async () => {
      assert.throws(() => parseMessage(JSON.stringify({ type: 'STATE_UPDATE' })), /missing required fields/);
    });

    await test('parseMessage rejects unknown message type', async () => {
      assert.throws(() => parseMessage(JSON.stringify({
        type: 'HACK', nodeId: 'x', timestamp: Date.now(), payload: {}
      })), /Unknown message type/);
    });

    await test('all MESSAGE_TYPES constants defined', async () => {
      for (const t of ['STATE_UPDATE','TRANSACTION_BROADCAST','SYNC_REQUEST','SYNC_RESPONSE','PROOF_REQUEST','PROOF_RESPONSE']) {
        assert.strictEqual(MESSAGE_TYPES[t], t);
      }
    });

  });

  await suite('Network — peer manager', async () => {

    function mockWs(open = true) {
      const sent = [];
      return { readyState: open ? 1 : 3, send: (d) => sent.push(d), _sent: sent };
    }

    await test('addPeer and count', async () => {
      const pm = new PeerManager();
      assert.strictEqual(pm.count(), 0);
      pm.addPeer(mockWs(), { id: 'n1' });
      assert.strictEqual(pm.count(), 1);
    });

    await test('removePeer decrements count', async () => {
      const pm = new PeerManager();
      const ws = mockWs();
      pm.addPeer(ws);
      pm.removePeer(ws);
      assert.strictEqual(pm.count(), 0);
    });

    await test('getPeers returns array of ws handles', async () => {
      const pm = new PeerManager();
      const ws = mockWs();
      pm.addPeer(ws);
      assert.strictEqual(pm.getPeers().length, 1);
      assert.strictEqual(pm.getPeers()[0], ws);
    });

    await test('broadcast sends to all open peers except excluded', async () => {
      const pm = new PeerManager();
      const ws1 = mockWs(), ws2 = mockWs(), ws3 = mockWs();
      pm.addPeer(ws1); pm.addPeer(ws2); pm.addPeer(ws3);
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'a', mmrRoot: 'b' });
      pm.broadcast(msg, ws1);
      assert.strictEqual(ws1._sent.length, 0);
      assert.strictEqual(ws2._sent.length, 1);
      assert.strictEqual(ws3._sent.length, 1);
    });

    await test('broadcast skips closed peers', async () => {
      const pm = new PeerManager();
      const open = mockWs(true), closed = mockWs(false);
      pm.addPeer(open); pm.addPeer(closed);
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'a', mmrRoot: 'b' });
      const sent = pm.broadcast(msg);
      assert.strictEqual(sent, 1);
      assert.strictEqual(closed._sent.length, 0);
    });

    await test('setPeerId updates peer metadata', async () => {
      const pm = new PeerManager();
      const ws = mockWs();
      pm.addPeer(ws);
      pm.setPeerId(ws, 'my-node-id');
      assert.strictEqual(pm.getPeerMeta(ws).id, 'my-node-id');
    });

    await test('send returns false for closed socket', async () => {
      const pm = new PeerManager();
      const ws = mockWs(false);
      pm.addPeer(ws);
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'a', mmrRoot: 'b' });
      assert.strictEqual(pm.send(ws, msg), false);
    });

  });

  await suite('Network — gossip layer', async () => {

    function mockPeers() {
      const broadcasts = [];
      return { broadcast: (msg, ex) => broadcasts.push({ msg, ex }), _broadcasts: broadcasts };
    }

    await test('isDuplicate returns false for unseen message', async () => {
      const g = new GossipLayer(mockPeers());
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'x', mmrRoot: 'y' });
      assert.strictEqual(g.isDuplicate(msg), false);
    });

    await test('isDuplicate returns true after markSeen', async () => {
      const g = new GossipLayer(mockPeers());
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'x', mmrRoot: 'y' });
      g.markSeen(msg);
      assert.strictEqual(g.isDuplicate(msg), true);
    });

    await test('receive returns false for duplicate', async () => {
      const g = new GossipLayer(mockPeers());
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'x', mmrRoot: 'y' });
      g.receive(msg, null, {});
      assert.strictEqual(g.receive(msg, null, {}), false);
    });

    await test('receive calls type handler for new message', async () => {
      const g = new GossipLayer(mockPeers());
      let called = false;
      const msg = createMessage(MESSAGE_TYPES.SYNC_REQUEST, 'n', { lastKnownRoot: 'abc' });
      g.receive(msg, null, { [MESSAGE_TYPES.SYNC_REQUEST]: () => { called = true; } });
      assert.strictEqual(called, true);
    });

    await test('STATE_UPDATE is forwarded to peers excluding sender', async () => {
      const peers = mockPeers();
      const g = new GossipLayer(peers);
      const senderWs = {};
      const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'x', mmrRoot: 'y' });
      g.receive(msg, senderWs, {});
      assert.strictEqual(peers._broadcasts.length, 1);
      assert.strictEqual(peers._broadcasts[0].ex, senderWs);
    });

    await test('TRANSACTION_BROADCAST is forwarded to peers', async () => {
      const peers = mockPeers();
      const g = new GossipLayer(peers);
      const msg = createMessage(MESSAGE_TYPES.TRANSACTION_BROADCAST, 'n', { txHash: 'abc' });
      g.receive(msg, null, {});
      assert.strictEqual(peers._broadcasts.length, 1);
    });

    await test('SYNC_REQUEST is not forwarded (point-to-point)', async () => {
      const peers = mockPeers();
      const g = new GossipLayer(peers);
      const msg = createMessage(MESSAGE_TYPES.SYNC_REQUEST, 'n', { lastKnownRoot: 'abc' });
      g.receive(msg, null, {});
      assert.strictEqual(peers._broadcasts.length, 0);
    });

    await test('seenCount reflects unique messages', async () => {
      const g = new GossipLayer(mockPeers());
      const m1 = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'a', mmrRoot: 'b' });
      const m2 = createMessage(MESSAGE_TYPES.STATE_UPDATE, 'n', { smtRoot: 'c', mmrRoot: 'd' });
      g.markSeen(m1); g.markSeen(m2);
      assert.strictEqual(g.seenCount(), 2);
    });

  });

  await suite('Network — validator', async () => {

    function freshMsg(type, payload, overrides = {}) {
      return Object.assign(createMessage(type, 'node-test', payload), overrides);
    }

    await test('validate passes a valid STATE_UPDATE', async () => {
      const msg = freshMsg(MESSAGE_TYPES.STATE_UPDATE, { smtRoot: 'a', mmrRoot: 'b' });
      assert.doesNotThrow(() => validate(msg));
    });

    await test('validate rejects STATE_UPDATE missing smtRoot', async () => {
      const msg = freshMsg(MESSAGE_TYPES.STATE_UPDATE, { mmrRoot: 'b' });
      assert.throws(() => validate(msg), /smtRoot/);
    });

    await test('validate rejects STATE_UPDATE missing mmrRoot', async () => {
      const msg = freshMsg(MESSAGE_TYPES.STATE_UPDATE, { smtRoot: 'a' });
      assert.throws(() => validate(msg), /mmrRoot/);
    });

    await test('validate rejects stale message (>60s old)', async () => {
      const msg = freshMsg(MESSAGE_TYPES.STATE_UPDATE, { smtRoot: 'a', mmrRoot: 'b' },
        { timestamp: Date.now() - 70_000 });
      assert.throws(() => validate(msg), /timestamp out of window/);
    });

    await test('validate rejects future-dated message', async () => {
      const msg = freshMsg(MESSAGE_TYPES.STATE_UPDATE, { smtRoot: 'a', mmrRoot: 'b' },
        { timestamp: Date.now() + 10_000 });
      assert.throws(() => validate(msg), /timestamp out of window/);
    });

    await test('validate passes SYNC_REQUEST with lastKnownRoot', async () => {
      const msg = freshMsg(MESSAGE_TYPES.SYNC_REQUEST, { lastKnownRoot: 'abc' });
      assert.doesNotThrow(() => validate(msg));
    });

    await test('validate rejects SYNC_REQUEST missing lastKnownRoot', async () => {
      const msg = freshMsg(MESSAGE_TYPES.SYNC_REQUEST, {});
      assert.throws(() => validate(msg), /lastKnownRoot/);
    });

    await test('validate passes SYNC_RESPONSE with all required fields', async () => {
      const msg = freshMsg(MESSAGE_TYPES.SYNC_RESPONSE, {
        stateRoot: 'sr', mmrRoot: 'mr', recentLogs: [],
      });
      assert.doesNotThrow(() => validate(msg));
    });

    await test('validate rejects SYNC_RESPONSE missing recentLogs', async () => {
      const msg = freshMsg(MESSAGE_TYPES.SYNC_RESPONSE, { stateRoot: 'sr', mmrRoot: 'mr' });
      assert.throws(() => validate(msg), /recentLogs/);
    });

    await test('validate rejects SYNC_RESPONSE with stateRoot missing', async () => {
      const msg = freshMsg(MESSAGE_TYPES.SYNC_RESPONSE, { mmrRoot: 'mr', recentLogs: [] });
      assert.throws(() => validate(msg), /stateRoot/);
    });

  });

};
