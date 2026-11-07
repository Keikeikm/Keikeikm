import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateConfig, validateTasks, createAssets, readmeContent, replaceReadme } from './roadmap.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function loadConfig() {
  const config = JSON.parse(await readFile(resolve(root, 'roadmap/config.json'), 'utf8'));
  // Follow the current repository automatically after a rename or fork in Actions.
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY) config.repository = process.env.GITHUB_REPOSITORY;
  return validateConfig(config);
}

export async function build(config, suppliedTasks) {
  config ??= await loadConfig();
  const filename = config.source === 'demo' ? 'examples.json' : 'issues.json';
  const tasks = validateTasks(suppliedTasks ?? JSON.parse(await readFile(resolve(root, `roadmap/${filename}`), 'utf8')));
  const assets = createAssets(config, tasks);
  const readmePath = resolve(root, 'README.md');
  const readme = replaceReadme(await readFile(readmePath, 'utf8'), readmeContent(config, tasks, assets));
  const destination = resolve(root, 'assets/roadmap');
  await mkdir(destination, { recursive: true });
  for (const [name, content] of Object.entries(assets)) await writeFile(resolve(destination, name), content);
  for (const name of await readdir(destination)) {
    if (name.endsWith('.svg') && !Object.hasOwn(assets, name)) await unlink(resolve(destination, name));
  }
  await writeFile(readmePath, readme);
  console.log(`Built ${tasks.length} projects (${config.source}) for ${config.repository}.`);
  return { config, tasks, assets };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(error => { console.error(error.message); process.exitCode = 1; });
}
