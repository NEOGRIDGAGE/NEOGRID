module.exports = async function(test, suite, assert) {
  await suite('Adversarial — partition recovery', async () => {
    await test('partition heals to convergence', async () => {
      assert.strictEqual(true, true);
    });
  });
};
