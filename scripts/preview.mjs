import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { root, build } from './build-roadmap.mjs';

await build();
const readme = await readFile(resolve(root, 'README.md'), 'utf8');
const content = readme.slice(readme.indexOf('<picture>'), readme.lastIndexOf('</picture>') + '</picture>'.length);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Open Source Lab — Preview</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#202322;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}main{max-width:1026px;margin:40px auto;padding:24px 32px;border:1px solid #e5e7e9;border-radius:22px;line-height:1.5}img{max-width:100%;height:auto}a{color:inherit;text-decoration:none}a:focus-visible{outline:2px solid #579f7b;outline-offset:3px}nav{font-size:13px;margin:4px 20px 12px;color:#6d706f}nav a:hover{text-decoration:underline}nav span{padding:0 8px}@media(max-width:600px){main{margin:12px 8px;padding:12px;border-radius:16px}nav{font-size:12px;margin:12px 4px}}@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}main{border-color:#30363d}nav{color:#9da7b3}}
</style></head><body><main>${content}<nav><a href="/docs/SETUP.md">How this works</a><span>·</span><a href="/?theme=light">Light</a><span>·</span><a href="/?theme=dark">Dark</a></nav></main>
<script>
const theme = new URLSearchParams(location.search).get('theme');
if (theme === 'light' || theme === 'dark') {
  for (const style of document.styleSheets) for (const rule of style.cssRules) if (rule.conditionText === '(prefers-color-scheme: dark)') rule.media.mediaText = theme === 'dark' ? 'all' : 'not all';
  for (const source of document.querySelectorAll('source')) if (source.media.includes('prefers-color-scheme: dark')) source.media = theme === 'dark' ? source.media.replace('(prefers-color-scheme: dark)', 'all') : 'not all';
}
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return; }
    const file = resolve(root, `.${pathname}`);
    if (!['assets', 'docs'].some(dir => file.startsWith(resolve(root, dir) + sep))) { response.writeHead(404); response.end('Not found'); return; }
    const data = await readFile(file);
    response.setHeader('Content-Type', extname(file) === '.svg' ? 'image/svg+xml' : 'text/plain; charset=utf-8');
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => { console.error(`Cannot start preview: ${error.message}`); process.exitCode = 1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${server.address().port}`));
