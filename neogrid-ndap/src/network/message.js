const { hashData } = require('../utils');

const MESSAGE_TYPES = {
  STATE_UPDATE:          'STATE_UPDATE',
  TRANSACTION_BROADCAST: 'TRANSACTION_BROADCAST',
  SYNC_REQUEST:          'SYNC_REQUEST',
  SYNC_RESPONSE:         'SYNC_RESPONSE',
  PROOF_REQUEST:         'PROOF_REQUEST',
  PROOF_RESPONSE:        'PROOF_RESPONSE',
  STATE_PROPOSE:         'STATE_PROPOSE',
  VOTE_PREVOTE:          'VOTE_PREVOTE',
  VOTE_PRECOMMIT:        'VOTE_PRECOMMIT',
  FINALIZED_STATE:       'FINALIZED_STATE',
  VIEW_CHANGE:           'VIEW_CHANGE',
};

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = canonicalize(obj[k]);
  return sorted;
}

function deterministicJSON(obj) {
  return JSON.stringify(canonicalize(obj));
}

function createMessage(type, nodeId, payload) {
  if (!MESSAGE_TYPES[type]) throw new Error(`Unknown message type: ${type}`);
  return { type, nodeId, timestamp: Date.now(), signature: null, payload };
}

function messageHash(msg) {
  return hashData(deterministicJSON({
    type:      msg.type,
    nodeId:    msg.nodeId,
    timestamp: msg.timestamp,
    payload:   msg.payload,
  }));
}

function serializeMessage(msg) {
  return JSON.stringify(msg);
}

function parseMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { throw new Error('Invalid JSON in message'); }
  if (!msg.type || !msg.nodeId || !msg.timestamp ||
      !Object.prototype.hasOwnProperty.call(msg, 'payload')) {
    throw new Error('Malformed message: missing required fields');
  }
  if (!MESSAGE_TYPES[msg.type]) throw new Error(`Unknown message type: ${msg.type}`);
  return msg;
}

module.exports = { MESSAGE_TYPES, createMessage, messageHash, serializeMessage, parseMessage };
