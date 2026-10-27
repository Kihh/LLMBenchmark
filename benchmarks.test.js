const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSnapshot } = require('./benchmarks');

const catalog = { items: [{ category: 'agentic', benchmarkKey: 'terminalBench4', url: 'https://benchlm.ai/benchmarks/terminal-bench-4', format: 'Task completion rate' }] };
function model(name, score, extra = {}) {
  return { model: name, displayScore: 80, rankingEligible: true, benchmarks: { agentic: { terminalBench4: score } }, ...extra };
}
const source = items => ({ items, sourceLastUpdated: 'October 26, 2026' });

test('single scores are independent of composites, versions and tool settings', () => {
  const data = buildSnapshot(source([model('Model', 0, { benchmarks: {
    agentic: { terminalBench4: 0, terminalBench2: 45, hleWithTools: 70 }, knowledge: { hleNoTools: 40 },
  } })]), catalog);
  assert.deepEqual(data.categories['Terminal-Bench 4.0'], [['Model', 0]]);
  assert.equal(data.categories['Terminal-Bench 2.0'], undefined);
  assert.deepEqual(data.categories["Humanity's Last Exam (有工具)"], [['Model', 70]]);
  assert.deepEqual(data.categories["Humanity's Last Exam (无工具)"], [['Model', 40]]);
  assert.deepEqual(data.categories.Overall, [['Model', 80]]);
});

test('filters invalid scores before sorting and limiting to fifteen', () => {
  const items = Array.from({ length: 20 }, (_, i) => model(`Model ${i}`, i));
  items.push(model('null', null), model('string', '99'), model('nan', NaN), model('high', 110), model('negative', -1));
  const rows = buildSnapshot(source(items), catalog).categories['Terminal-Bench 4.0'];
  assert.equal(rows.length, 15);
  assert.deepEqual(rows[0], ['Model 19', 19]);
  assert.deepEqual(rows[14], ['Model 5', 5]);
});

test('only published eligible overall scores enter the overview', () => {
  const data = buildSnapshot(source([model('Eligible', 50), model('Provisional', 60, { rankingEligible: false, displayScore: 99 })]), catalog);
  assert.deepEqual(data.categories.Overall, [['Eligible', 80]]);
  assert.equal(data.categories['Terminal-Bench 4.0'].length, 2);
});

test('clustered and obsolete benchmarks are omitted entirely', () => {
  const data = buildSnapshot(source([96, 95, 94, 93, 91].map((score, i) => model(`Model ${i}`, score))), catalog);
  assert.equal(data.benchmarks.find(b => b.key === 'terminalBench4'), undefined);
  assert.equal(data.categories['Terminal-Bench 4.0'], undefined);
  assert.equal(data.benchmarks.some(b => ['legacy', 'reference'].includes(b.tier)), false);
  for (const label of ['ARC-AGI-2', 'SWE-bench Verified', 'Terminal-Bench 2.0', 'MMLU-Pro', 'GPQA Diamond', 'MMMU']) {
    assert.equal(data.categories[label], undefined);
  }
  const sparse = buildSnapshot(source([model('Only one', 99)]), catalog);
  assert.equal(sparse.benchmarks.find(b => b.key === 'terminalBench4').tier, 'frontier');
});

test('failed refresh preserves trusted scores and their original dates', () => {
  const previous = buildSnapshot(source([model('Model', 42)]), catalog, null, '2026-10-26T01:00:00Z');
  const data = buildSnapshot(null, null, previous, '2026-10-27T01:00:00Z');
  assert.deepEqual(data.categories, previous.categories);
  assert.equal(data.updatedAt, previous.updatedAt);
  const bench = data.benchmarks.find(b => b.key === 'terminalBench4');
  assert.equal(bench.status, 'cached');
  assert.equal(bench.fetchedAt, previous.updatedAt);
  assert.equal(bench.sourceUpdatedAt, 'October 26, 2026');
});

test('partial coverage keeps last successful single score without inventing missing scores', () => {
  const previous = buildSnapshot(source([model('Model', 42)]), catalog);
  const data = buildSnapshot(source([model('Model', null)]), catalog, previous);
  assert.deepEqual(data.categories['Terminal-Bench 4.0'], [['Model', 42]]);
  assert.equal(data.benchmarks.find(b => b.key === 'terminalBench4').status, 'cached');
  assert.deepEqual(data.categories.DeepSWE, []);
  assert.equal(data.benchmarks.find(b => b.key === 'deepSwe').status, 'unavailable');
});

test('old fallback caches are discarded and malformed exports are rejected', () => {
  const data = buildSnapshot(null, null, { categories: { Overall: [['Invented', 99]] } });
  assert.deepEqual(data.categories.Overall, []);
  assert.equal(data.updatedAt, null);
  assert.throws(() => buildSnapshot({ models: [] }, catalog), /Invalid model/);
  assert.throws(() => buildSnapshot(source([model('Model', 42)]), { items: [] }), /Invalid benchmark/);
});
