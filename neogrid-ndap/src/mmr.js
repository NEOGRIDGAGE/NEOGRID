const { hashData } = require('./utils');

class MMR {
  constructor() {
    this.log = [];
  }

  append(data) {
    const hashed = hashData(typeof data === 'string' ? data : JSON.stringify(data));
    this.log.push(hashed);
    return this.log.length - 1;
  }

  getAll() {
    return this.log;
  }

  getAt(index) {
    if (index < 0 || index >= this.log.length) return null;
    return this.log[index];
  }

  size() {
    return this.log.length;
  }
}

module.exports = { MMR };
