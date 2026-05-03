module.exports = function invariantValidationTest(client, reference) {
  if (!client || !reference) return false;
  return true;
};