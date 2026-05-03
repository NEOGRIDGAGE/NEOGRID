const { LinkedMMR, GENESIS_ROOT } = require('../src/mmr');
const { hashData } = require('../src/utils');

module.exports = async function(test, suite, assert) {
  await suite('LinkedMMR — cryptographic log', async () => {

    await test('initial root is genesis root', async () => {
      const mmr = new LinkedMMR();
      assert.strictEqual(mmr.currentRoot(), GENESIS_ROOT);
    });

    await test('root changes after each append', async () => {
      const mmr = new LinkedMMR();
      const r0 = mmr.currentRoot();
      mmr.append('tx1');
      const r1 = mmr.currentRoot();
      mmr.append('tx2');
      const r2 = mmr.currentRoot();
      assert.notStrictEqual(r0, r1);
      assert.notStrictEqual(r1, r2);
    });

    await test('appendLinked returns structured entry', async () => {
      const mmr = new LinkedMMR();
      const prevRoot = mmr.currentRoot();
      const entry = mmr.appendLinked('txhash-abc', prevRoot, 'newroot-xyz');
      assert.strictEqual(entry.index, 0);
      assert.strictEqual(entry.txHash, 'txhash-abc');
      assert.strictEqual(typeof entry.mmrRoot, 'string');
      assert.ok(entry.timestamp > 0);
    });

    await test('entries are append-only (size only grows)', async () => {
      const mmr = new LinkedMMR();
      assert.strictEqual(mmr.size(), 0);
      for (let i = 0; i < 5; i++) {
        mmr.append(`entry-${i}`);
        assert.strictEqual(mmr.size(), i + 1);
      }
    });

    await test('log integrity verification passes for valid log', async () => {
      const mmr = new LinkedMMR();
      mmr.append('a');
      mmr.append('b');
      mmr.append('c');
      const result = mmr.verify();
      assert.strictEqual(result.valid, true);
    });

    await test('all roots are unique (monotonically distinct)', async () => {
      const mmr = new LinkedMMR();
      const roots = new Set([mmr.currentRoot()]);
      for (let i = 0; i < 10; i++) {
        mmr.append(`data-${i}`);
        roots.add(mmr.currentRoot());
      }
      assert.strictEqual(roots.size, 11);
    });

    await test('getAt returns correct entry', async () => {
      const mmr = new LinkedMMR();
      mmr.append('first');
      mmr.append('second');
      const entry = mmr.getAt(0);
      assert.strictEqual(entry.index, 0);
    });

    await test('getAt out of bounds returns null', async () => {
      const mmr = new LinkedMMR();
      assert.strictEqual(mmr.getAt(99), null);
    });

    await test('replay test — same data produces different entries (timestamps differ)', async () => {
      const mmr = new LinkedMMR();
      const e1 = mmr.appendLinked('tx-same', 'root-a', 'root-b');
      const e2 = mmr.appendLinked('tx-same', 'root-b', 'root-c');
      assert.notStrictEqual(e1.mmrRoot, e2.mmrRoot);
    });
  });
};
