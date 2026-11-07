import { createHash } from 'node:crypto';

export const themes = {
  light: { bg: '#ffffff', card: '#f6f6f6', text: '#202322', muted: '#6d706f', faded: '#898c8a', line: '#dedfdf', track: '#f1f2f1', green: '#579f7b', check: '#00a63d', solid: '#202322', inverse: '#ffffff', amber: '#aa7b29' },
  dark: { bg: '#0d1117', card: '#161b22', text: '#e6edf3', muted: '#9da7b3', faded: '#8c959f', line: '#30363d', track: '#21262d', green: '#67b68e', check: '#5bce83', solid: '#e6edf3', inverse: '#0d1117', amber: '#d5ab61' },
};

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function validateConfig(config) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repository)) throw new Error('repository must be owner/repo');
  if (!['demo', 'github'].includes(config.source)) throw new Error('source must be demo or github');
  for (const key of ['title', 'description', 'badge', 'heading', 'label', 'inProgressLabel']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error(`${key} must be non-empty text`);
  }
  if (config.title.length > 40 || config.badge.length > 24 || config.heading.length > 40 || config.description.length > 220) {
    throw new Error('Keep title/heading ≤ 40, badge ≤ 24, description ≤ 220 characters');
  }
  return config;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function validateTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Roadmap data must be an array');
  const ids = new Set();
  return tasks.map(task => {
    if (typeof task.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(task.id) || ids.has(task.id)) throw new Error('Task IDs must be unique and contain only letters, digits, _ or -');
    ids.add(task.id);
    if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 256) throw new Error('Task title must contain 1–256 characters');
    if (typeof task.focus !== 'string' || task.focus.length > 240) throw new Error('Task focus must be text up to 240 characters');
    if (!['completed', 'in-progress', 'planned'].includes(task.status)) throw new Error(`Invalid status: ${task.status}`);
    if (task.url && !safeUrl(task.url)) throw new Error('Task links must be HTTPS URLs');
    return { ...task, url: task.url ? safeUrl(task.url) : undefined };
  });
}

function field(body, heading) {
  const sections = String(body ?? '').split(/^###\s+/m).slice(1);
  const section = sections.find(s => s.split('\n')[0].trim().toLowerCase() === heading.toLowerCase());
  const value = section?.split('\n').slice(1).join(' ').trim();
  return value && value !== '_No response_' ? value : '';
}

export function tasksFromIssues(issues, config) {
  return validateTasks(issues
    .filter(issue => !issue.pull_request && issue.labels?.some(label => (typeof label === 'string' ? label : label.name) === config.label))
    .filter(issue => !(issue.state === 'closed' && issue.state_reason === 'not_planned'))
    .sort((a, b) => a.number - b.number)
    .map(issue => ({
      id: `issue-${issue.number}`,
      title: issue.title.replace(/^\[Roadmap\]\s*/i, '').trim(),
      focus: field(issue.body, 'Technical focus').slice(0, 240) || 'Open-source project',
      status: issue.state === 'closed' ? 'completed' : issue.labels.some(label => (typeof label === 'string' ? label : label.name) === config.inProgressLabel) ? 'in-progress' : 'planned',
      url: safeUrl(field(issue.body, 'Project link')) || `https://github.com/${config.repository}/issues/${issue.number}`,
    })));
}

// Estimate text widths without foreignObject, scripts, or externally loaded fonts.
function textWidth(text, size) {
  return [...text].reduce((sum, c) => sum + (/[^\u0000-\u00ff]/.test(c) ? 1 : /[ilI.,'!:;| ]/.test(c) ? 0.28 : /[MW@%]/.test(c) ? 0.9 : 0.57) * size, 0);
}

export function wrapText(text, maxWidth, size) {
  const lines = [];
  let line = '';
  for (const word of String(text).trim().split(/\s+/)) {
    if (line && textWidth(`${line} ${word}`, size) > maxWidth) { lines.push(line); line = ''; }
    for (const char of (line ? ' ' : '') + word) {
      if (line && textWidth(line + char, size) > maxWidth) { lines.push(line.trimEnd()); line = ''; }
      line += char;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.length ? lines : [''];
}

function text(x, y, value, size, color, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escapeXml(value)}</text>`;
}

function svg(width, height, label, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${escapeXml(label)}</title><g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, 'Noto Sans', sans-serif">${body}</g></svg>\n`;
}

const mark = `<path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 .1.36 2.04 3.3 1.39.1-.73.39-1.23.71-1.52-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.7 10.7 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z"/>`;

export function renderHeader(config, tasks, theme, mobile = false) {
  const c = themes[theme], w = mobile ? 440 : 960, pad = 20;
  const titleSize = mobile ? 22 : 24;
  const titleLines = wrapText(config.title, w - 2 * pad - 44 - (mobile ? 0 : 235), titleSize);
  let body = `<g transform="translate(20 23) scale(1.2)" fill="${c.text}">${mark}</g>`;
  titleLines.forEach((line, i) => { body += text(62, 46 + i * 30, line, titleSize, c.text, 'font-weight="600"'); });
  const badgeW = Math.max(155, Math.ceil(textWidth(config.badge, 16) + 24));
  const badgeY = mobile ? 60 + (titleLines.length - 1) * 30 : 21;
  const badgeX = mobile ? pad : w - pad - badgeW;
  body += `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="28" rx="14" fill="${c.track}"/>`;
  body += text(badgeX + badgeW / 2, badgeY + 19, config.badge, 16, c.text, 'text-anchor="middle" letter-spacing=".4"');
  const descY = mobile ? badgeY + 56 : 88 + (titleLines.length - 1) * 30;
  const lines = wrapText(config.description, w - pad * 2, 17);
  lines.forEach((line, i) => { body += text(pad, descY + i * 25, line, 17, c.muted); });
  const headingY = descY + (lines.length - 1) * 25 + 45;
  const headings = wrapText(config.heading, w - pad * 2 - (mobile ? 0 : 180), 18);
  headings.forEach((line, i) => { body += text(pad, headingY + i * 26, line, 18, c.text, 'font-weight="500"'); });
  const countY = headingY + (headings.length - 1) * 26 + (mobile ? 28 : 0);
  const completed = tasks.filter(t => t.status === 'completed').length;
  body += text(mobile ? pad : w - pad, countY, `${completed} / ${tasks.length} completed`, 16, c.muted, mobile ? '' : 'text-anchor="end"');
  const barY = countY + 24, barW = w - pad * 2;
  body += `<rect x="${pad}" y="${barY}" width="${barW}" height="8" rx="4" fill="${c.track}"/>`;
  if (completed) body += `<rect x="${pad}" y="${barY}" width="${barW * completed / tasks.length}" height="8" rx="4" fill="${c.green}"/>`;
  const h = barY + 28;
  return svg(w, h, `${config.title}. ${completed} of ${tasks.length} projects completed. ${config.source === 'demo' ? 'Example data.' : ''}`, `<rect width="${w}" height="${h}" fill="${c.bg}"/>${body}`);
}

export function renderCard(task, theme, mobile = false) {
  const c = themes[theme], w = mobile ? 440 : 960;
  const size = mobile ? 19 : 20, x = mobile ? 66 : 80;
  const titleLines = wrapText(task.title, w - x - 65, size);
  const focusLines = wrapText(task.focus, w - x - 36, 16);
  const focusY = 38 + (titleLines.length - 1) * 27 + 31;
  const h = Math.max(96, focusY + (focusLines.length - 1) * 23 + 24);
  const done = task.status === 'completed', active = task.status === 'in-progress';
  const cx = mobile ? 33 : 42;
  let body = `<rect width="${w}" height="${h}" rx="12" fill="${c.card}"/>`;
  body += `<circle cx="${cx}" cy="34" r="13" fill="${done ? c.solid : 'none'}" stroke="${done ? c.solid : c.line}"/>`;
  if (done) body += `<path d="M${cx - 7} 34l5 5 9-10" fill="none" stroke="${c.inverse}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  titleLines.forEach((line, i) => { body += text(x, 41 + i * 27, line, size, done ? c.faded : c.text, done ? 'text-decoration="line-through"' : ''); });
  focusLines.forEach((line, i) => { body += text(x, focusY + i * 23, line, 16, c.muted); });
  const sx = w - 29;
  body += `<circle cx="${sx}" cy="30" r="8" fill="none" stroke="${done ? c.check : active ? c.amber : c.faded}" stroke-width="1.7" ${done || active ? '' : 'stroke-dasharray="3.5 3.5"'}/>`;
  if (done) body += `<path d="M${sx - 4} 30l3 3 5-6" fill="none" stroke="${c.check}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (active) body += `<circle cx="${sx}" cy="30" r="3" fill="${c.amber}"/>`;
  return svg(w, h, `${task.title}. ${task.status}. ${task.focus}`, body);
}

export function renderEmpty(theme, mobile = false) {
  const c = themes[theme], w = mobile ? 440 : 960;
  return svg(w, 120, 'No projects on the roadmap yet.', `<rect width="${w}" height="120" rx="12" fill="${c.card}"/>${text(24, 44, 'Room for the next idea.', 22, c.text, 'font-weight="500"')}${text(24, 80, 'Follow along as new projects take shape.', 16, c.muted)}`);
}

export function renderFooter(config, theme, mobile = false) {
  const c = themes[theme], w = mobile ? 440 : 960;
  const lines = wrapText(config.source === 'demo' ? 'Demo roadmap · Example projects, ready to make your own.' : 'Built with curiosity. Shared with the community.', w - 40, 14);
  const h = 28 + lines.length * 22;
  return svg(w, h, lines.join(' '), `<rect width="${w}" height="${h}" fill="${c.bg}"/>${lines.map((line, i) => text(20, 30 + i * 22, line, 14, c.muted)).join('')}`);
}

export function assetReference(path, content) {
  return `${path}?v=${createHash('sha256').update(content).digest('hex').slice(0, 12)}`;
}

export function picture(name, alt, assets, url) {
  const ref = suffix => escapeXml(assetReference(`assets/roadmap/${name}${suffix}.svg`, assets[`${name}${suffix}.svg`]));
  const content = `<picture>\n  <source media="(prefers-color-scheme: dark) and (max-width: 600px)" srcset="${ref('-dark-mobile')}">\n  <source media="(max-width: 600px)" srcset="${ref('-light-mobile')}">\n  <source media="(prefers-color-scheme: dark)" srcset="${ref('-dark')}">\n  <img src="${ref('-light')}" alt="${escapeXml(alt)}" width="960">\n</picture>`;
  return url ? `<a href="${escapeXml(url)}">\n${content}\n</a>` : content;
}

export function createAssets(config, tasks) {
  const assets = {};
  for (const theme of Object.keys(themes)) {
    for (const mobile of [false, true]) {
      const suffix = `${theme}${mobile ? '-mobile' : ''}.svg`;
      assets[`header-${suffix}`] = renderHeader(config, tasks, theme, mobile);
      for (const task of tasks) assets[`${task.id}-${suffix}`] = renderCard(task, theme, mobile);
      if (!tasks.length) assets[`empty-${suffix}`] = renderEmpty(theme, mobile);
      assets[`footer-${suffix}`] = renderFooter(config, theme, mobile);
    }
  }
  return assets;
}

export function readmeContent(config, tasks, assets) {
  const issuesUrl = `https://github.com/${config.repository}/issues?q=${encodeURIComponent(`is:issue label:"${config.label}"`)}`;
  const content = [picture('header', `${config.title} — ${tasks.filter(t => t.status === 'completed').length} / ${tasks.length} completed${config.source === 'demo' ? ' (example data)' : ''}`, assets)];
  for (const task of tasks) content.push(picture(task.id, `${task.title} — ${task.status} · ${task.focus}${config.source === 'demo' ? ' (example)' : ''}`, assets, task.url || `docs/EXAMPLES.md#${task.id}`));
  if (!tasks.length) content.push(picture('empty', 'No projects on the roadmap yet.', assets, issuesUrl));
  content.push(picture('footer', config.source === 'demo' ? 'Example projects — replace with your own plans.' : 'Built with curiosity. Shared with the community.', assets));
  return `<!-- ROADMAP:START -->\n<!-- Generated by npm run build; edit roadmap/config.json or your roadmap Issues. -->\n\n${content.join('\n<br>\n')}\n\n[Explore the roadmap](${issuesUrl}) · [Suggest an idea](https://github.com/${config.repository}/issues/new?template=idea.yml) · [How this works](docs/SETUP.md)\n\n<!-- ROADMAP:END -->`;
}

export function replaceReadme(current, generated) {
  const start = '<!-- ROADMAP:START -->', end = '<!-- ROADMAP:END -->';
  if (current.split(start).length !== 2 || current.split(end).length !== 2 || current.indexOf(end) < current.indexOf(start)) throw new Error('README must contain exactly one ROADMAP:START / ROADMAP:END pair');
  return current.slice(0, current.indexOf(start)) + generated + current.slice(current.indexOf(end) + end.length);
}

export async function fetchIssues(repository, label, token, fetchImpl = fetch) {
  const issues = [];
  for (let page = 1; ; page++) {
    const url = new URL(`https://api.github.com/repos/${repository}/issues`);
    url.search = new URLSearchParams({ state: 'all', labels: label, per_page: '100', page: String(page), sort: 'created', direction: 'asc' });
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'open-source-lab-profile', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub Issues request failed (HTTP ${response.status}); existing generated files were kept.`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Unexpected GitHub Issues response');
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
}
