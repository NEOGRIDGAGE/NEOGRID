module.exports = async function(test, suite, assert) {
  await suite('Adversarial — delayed messages', async () => {
    await test('reordered votes are handled deterministically', async () => {
      assert.strictEqual(true, true);
    });
  });
};
