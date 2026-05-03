class MinimalNodeClient {
  applyEvent(event) {
    this.state = this.state || { height: 0, view: 0 };
    this.state.lastEvent = event.type;
    return this.state;
  }

  getState() {
    return this.state || { height: 0, view: 0 };
  }

  sendMessage() {}
  receiveMessage() {}
  propose() {}
  vote() {}
  finalize() {}
}

module.exports = { MinimalNodeClient };