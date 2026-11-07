import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, loadConfig, build } from './build-roadmap.mjs';
import { fetchIssues, tasksFromIssues } from './roadmap.mjs';

try {
  const config = await loadConfig();
  if (config.source === 'demo') {
    await build(config);
    console.log('Demo mode: change source to "github" in roadmap/config.json to sync Issues.');
  } else {
    const issues = await fetchIssues(config.repository, config.label, process.env.GITHUB_TOKEN);
    const tasks = tasksFromIssues(issues, config);
    await build(config, tasks);
    await writeFile(resolve(root, 'roadmap/issues.json'), `${JSON.stringify(tasks, null, 2)}\n`);
    console.log(`Synced ${tasks.length} roadmap Issues.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
