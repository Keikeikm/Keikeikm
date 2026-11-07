import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, validateTasks, tasksFromIssues, renderHeader, renderCard, createAssets, readmeContent, replaceReadme, fetchIssues, wrapText, safeUrl, assetReference } from '../scripts/roadmap.mjs';

// Test fixtures must stay independent of the owner's editable config and projects.
const config = {
  repository: 'example/open-source-lab',
  source: 'demo',
  title: 'My Open Source Lab',
  description: 'A living roadmap of open-source projects.',
  badge: 'Building in public',
  heading: 'Open Source Roadmap',
  label: 'roadmap',
  inProgressLabel: 'in progress',
};
const samples = [
  { id: 'agent-workspace', title: 'Build an agent workspace', focus: 'AI Tools', status: 'completed' },
  { id: 'cli-toolkit', title: 'Release a CLI toolkit', focus: 'Developer Experience', status: 'planned' },
];
const issue = (number, props = {}) => ({ number, title: `[Roadmap] Project ${number}`, body: '### Technical focus\n\nAI · Tools\n\n### Project link\n\n_No response_\n\n### Plan\n\n- [ ] Ship', state: 'open', labels: [{ name: 'roadmap' }], ...props });

test('Issue lifecycle: label, complete, reopen, cancel, remove label, exclude PR', () => {
  const original = issue(1);
  assert.equal(tasksFromIssues([original], config)[0].status, 'planned');
  assert.equal(tasksFromIssues([issue(1, { labels: ['roadmap', 'in progress'] })], config)[0].status, 'in-progress');
  assert.equal(tasksFromIssues([issue(1, { state: 'closed', state_reason: 'completed' })], config)[0].status, 'completed');
  assert.equal(tasksFromIssues([issue(1, { state: 'open', state_reason: 'reopened' })], config)[0].status, 'planned');
  for (const excluded of [issue(1, { labels: [] }), issue(1, { pull_request: {} }), issue(1, { state: 'closed', state_reason: 'not_planned' })]) {
    assert.deepEqual(tasksFromIssues([excluded], config), []);
  }
});

test('Issue form metadata and real project links are parsed; unsafe links fall back to Issue', () => {
  const result = tasksFromIssues([issue(2), issue(1)], config);
  assert.deepEqual(result.map(t => t.id), ['issue-1', 'issue-2']);
  assert.equal(result[0].focus, 'AI · Tools');
  assert.equal(result[0].title, 'Project 1');
  assert.equal(result[0].url, `https://github.com/${config.repository}/issues/1`);
  const withLink = link => issue(1, { body: `### Technical focus\n\nTypeScript\n\n### Project link\n\n${link}` });
  assert.equal(tasksFromIssues([withLink('https://github.com/example/project')], config)[0].url, 'https://github.com/example/project');
  assert.equal(tasksFromIssues([withLink('javascript:alert(1)')], config)[0].url, result[0].url);
  assert.equal(safeUrl('https://user:secret@example.com'), null);
});

test('GitHub pagination includes closed projects beyond page one', async () => {
  const calls = [];
  const result = await fetchIssues(config.repository, 'roadmap', 'test-token', async (url, options) => {
    calls.push(String(url));
    assert.equal(url.searchParams.get('state'), 'all');
    assert.equal(url.searchParams.get('labels'), 'roadmap');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return { ok: true, json: async () => calls.length === 1 ? Array.from({ length: 100 }, (_, i) => issue(i + 1)) : [issue(101, { state: 'closed' })] };
  });
  assert.equal(result.length, 101);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /page=2/);
});

test('API errors and malformed responses fail instead of returning empty data', async () => {
  await assert.rejects(fetchIssues(config.repository, 'roadmap', null, async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(fetchIssues(config.repository, 'roadmap', null, async () => ({ ok: true, json: async () => ({ message: 'bad response' }) })), /Unexpected/);
});

test('Progress handles zero, partial, and all completed projects', () => {
  assert.match(renderHeader(config, [], 'light'), /0 \/ 0 completed/);
  const tasks = [{ ...samples[0], status: 'completed' }, { ...samples[1], status: 'planned' }];
  assert.match(renderHeader(config, tasks, 'light'), /width="460" height="8"/);
  assert.match(renderHeader(config, tasks.map(t => ({ ...t, status: 'completed' })), 'dark'), /2 \/ 2 completed/);
  assert.doesNotMatch(renderHeader(config, [], 'dark'), /NaN|Infinity/);
  const emptyAssets = createAssets({ ...config, source: 'github' }, []);
  assert.ok(emptyAssets['empty-light.svg']);
  assert.doesNotMatch(readmeContent({ ...config, source: 'github' }, [], emptyAssets), /agent-workspace|example data/);
});

test('External text cannot add SVG or HTML elements', () => {
  const task = { id: 'safe', title: '<script>alert("x")</script> & text', focus: '<img src=x onerror=alert(1)>', status: 'completed', url: 'https://example.com/?q="&x=<test>' };
  const rendered = renderCard(task, 'light');
  assert.doesNotMatch(rendered, /<script|<img|<foreignObject/);
  assert.match(rendered, /&lt;script&gt;/);
  const assets = createAssets(config, [task]);
  assert.doesNotMatch(readmeContent(config, [task], assets), /<script|onerror="/);
});

test('Mobile cards wrap long English, CJK, and unbroken titles without truncation', () => {
  const title = '这是一个很长的开源项目名称，用于验证手机上的自动换行以及完整显示所有内容';
  assert.equal(wrapText(title, 260, 19).join(''), title);
  const lines = wrapText('W'.repeat(100), 260, 19);
  assert.ok(lines.length > 5);
  assert.equal(lines.join(''), 'W'.repeat(100));
  const mobile = renderCard({ ...samples[0], title }, 'light', true);
  assert.ok(Number(mobile.match(/height="(\d+)"/)[1]) > 96);
  assert.match(mobile, /viewBox="0 0 440/);
});

test('README links each card, includes theme and mobile sources, preserves user content', () => {
  const assets = createAssets(config, samples);
  const generated = readmeContent(config, samples, assets);
  assert.equal((generated.match(/<a href=/g) || []).length, samples.length);
  assert.match(generated, /prefers-color-scheme: dark/);
  assert.match(generated, /max-width: 600px/);
  assert.match(generated, /example data/);
  const result = replaceReadme('My bio\n<!-- ROADMAP:START -->old<!-- ROADMAP:END -->\nMy links', generated);
  assert.ok(result.startsWith('My bio\n'));
  assert.ok(result.endsWith('\nMy links'));
  assert.throws(() => replaceReadme('no markers', generated), /exactly one/);
});

for (const source of ['demo', 'github']) {
  test(`README renders the ${source} source with the correct labels and links`, () => {
    const sourceConfig = { ...config, source };
    const tasks = source === 'demo' ? samples : tasksFromIssues([issue(1)], sourceConfig);
    const assets = createAssets(sourceConfig, tasks);
    const generated = readmeContent(sourceConfig, tasks, assets);
    if (source === 'demo') {
      assert.match(generated, /example data/);
      assert.match(assets['footer-light.svg'], /Demo roadmap/);
      assert.match(generated, /href="docs\/EXAMPLES.md#agent-workspace"/);
    } else {
      assert.doesNotMatch(generated, /example data|\(example\)|docs\/EXAMPLES.md/);
      assert.doesNotMatch(assets['footer-light.svg'], /Demo roadmap/);
      assert.match(generated, /href="https:\/\/github.com\/example\/open-source-lab\/issues\/1"/);
      assert.match(generated, /0 \/ 1 completed/);
    }
  });
}

test('Generation is deterministic; cache key changes only with image contents', () => {
  assert.deepEqual(createAssets(config, samples), createAssets(config, samples));
  assert.notEqual(assetReference('a.svg', 'one'), assetReference('a.svg', 'two'));
  assert.equal(assetReference('a.svg', 'one'), assetReference('a.svg', 'one'));
});

test('Invalid config, paths, duplicate IDs, statuses, and unsafe links fail validation', () => {
  validateConfig(config);
  validateTasks(samples);
  assert.throws(() => validateConfig({ ...config, repository: 'not-a-repo' }));
  assert.throws(() => validateConfig({ ...config, source: 'unknown' }));
  assert.throws(() => validateTasks([{ ...samples[0], id: '../../outside' }]));
  assert.throws(() => validateTasks([samples[0], samples[0]]));
  assert.throws(() => validateTasks([{ ...samples[0], status: 'made-up' }]));
  assert.throws(() => validateTasks([{ ...samples[0], url: 'javascript:alert(1)' }]));
});
