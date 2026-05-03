const { MESSAGE_TYPES } = require('./message');
const { validateTxStructure } = require('../tx');

function validateMessage(msg) {
  if (!msg || typeof msg !== 'object')     throw new Error('Message must be an object');
  if (!msg.type)                           throw new Error('Message missing type');
  if (!msg.nodeId)                         throw new Error('Message missing nodeId');
  if (typeof msg.timestamp !== 'number')   throw new Error('Message missing timestamp');
  if (!MESSAGE_TYPES[msg.type])            throw new Error(`Unknown type: ${msg.type}`);
  if (!Object.prototype.hasOwnProperty.call(msg, 'payload')) throw new Error('Message missing payload');

  const age = Date.now() - msg.timestamp;
  if (age < 0 || age > 60_000) throw new Error(`Message timestamp out of window: ${age}ms`);
}

function validateStateUpdate(msg, engine) {
  validateMessage(msg);
  const { smtRoot, mmrRoot } = msg.payload || {};
  if (!smtRoot) throw new Error('STATE_UPDATE missing smtRoot');
  if (!mmrRoot) throw new Error('STATE_UPDATE missing mmrRoot');
}

function validateTransactionBroadcast(msg) {
  validateMessage(msg);
  const tx = msg.payload && msg.payload.tx;
  if (!tx) throw new Error('TRANSACTION_BROADCAST missing tx');
  validateTxStructure(tx);
}

function validateSyncRequest(msg) {
  validateMessage(msg);
  if (!msg.payload || !msg.payload.lastKnownRoot) {
    throw new Error('SYNC_REQUEST missing lastKnownRoot');
  }
}

function validateSyncResponse(msg) {
  validateMessage(msg);
  const { stateRoot, mmrRoot, recentLogs } = msg.payload || {};
  if (!stateRoot)                throw new Error('SYNC_RESPONSE missing stateRoot');
  if (!mmrRoot)                  throw new Error('SYNC_RESPONSE missing mmrRoot');
  if (!Array.isArray(recentLogs)) throw new Error('SYNC_RESPONSE missing recentLogs array');
}

const VALIDATORS = {
  [MESSAGE_TYPES.STATE_UPDATE]:          validateStateUpdate,
  [MESSAGE_TYPES.TRANSACTION_BROADCAST]: validateTransactionBroadcast,
  [MESSAGE_TYPES.SYNC_REQUEST]:          validateSyncRequest,
  [MESSAGE_TYPES.SYNC_RESPONSE]:         validateSyncResponse,
  [MESSAGE_TYPES.PROOF_REQUEST]:         validateMessage,
  [MESSAGE_TYPES.PROOF_RESPONSE]:        validateMessage,
};

function validate(msg, engine) {
  validateMessage(msg);
  const specific = VALIDATORS[msg.type];
  if (specific) specific(msg, engine);
}

module.exports = { validate, validateMessage, validateStateUpdate };
