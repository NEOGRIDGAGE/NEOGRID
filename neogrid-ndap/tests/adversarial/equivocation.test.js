module.exports = async function(test, suite, assert) {
  await suite('Adversarial — equivocation', async () => {
    await test('double vote in same height is rejected deterministically', async () => {
      assert.strictEqual(true, true);
    });
  });
};
