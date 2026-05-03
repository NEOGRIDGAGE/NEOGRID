const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function sha(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function computeCoreHash() {
  return {
    consensus: sha(path.join(__dirname, '../consensus/bft.js')),
    validator: sha(path.join(__dirname, '../consensus/validator.js')),
    smt: sha(path.join(__dirname, '../smt.js')),
    bft: sha(path.join(__dirname, '../consensus/bft.js')),
  };
}

module.exports = { computeCoreHash };