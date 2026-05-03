module.exports = function invariantsTest(client) {
  return client.checkInvariants ? client.checkInvariants() : true;
};