import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'public');
const pages = [
  ['/', 'index.html'],
  ['/digital-egenkontrol/', 'funktioner/digital-egenkontrol.html'],
  ['/egenkontrol-restaurant/', 'egenkontrol-restaurant/index.html'],
  ['/egenkontrol-takeaway/', 'egenkontrol-takeaway/index.html'],
  ['/risikoanalyse-haccp/', 'funktioner/risikoanalyse-haccp.html'],
  ['/funktioner/afvigelsesrapporter.html', 'funktioner/afvigelsesrapporter.html'],
  ['/funktioner/dashboard-statistik.html', 'funktioner/dashboard-statistik.html'],
  ['/funktioner/onboarding-setup.html', 'funktioner/onboarding-setup.html'],
  ['/funktioner/myndighedsrapporter.html', 'funktioner/myndighedsrapporter.html'],
];

const read = (relative) => fs.readFileSync(path.join(publicDir, relative), 'utf8');
const capture = (html, pattern) => (html.match(pattern)?.[1] || '').trim();

test('indekserbare salgssider har unik title, description, canonical og én H1', () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const [route, file] of pages) {
    const html = read(file);
    const title = capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = capture(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i);
    const canonical = capture(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i);
    assert.ok(title.includes('Madkontrollen'), `${file}: title mangler brand`);
    assert.ok(description.length >= 70 && description.length <= 160, `${file}: description er ${description.length} tegn`);
    assert.equal(canonical, `https://madkontrollen.dk${route}`, `${file}: forkert canonical`);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${file}: skal have én H1`);
    assert.match(html, /<meta[^>]+name=["']robots["'][^>]+content=["']index,follow["']/i, `${file}: mangler index,follow`);
    assert.ok(!titles.has(title), `${file}: dubleret title`);
    assert.ok(!descriptions.has(description), `${file}: dubleret description`);
    titles.add(title);
    descriptions.add(description);
  }
});

test('forsiden bruger den aftalte SEO-title, description og H1', () => {
  const html = read('index.html');
  assert.match(html, /<title>Digital egenkontrol til restaurant og takeaway \| Madkontrollen<\/title>/);
  assert.match(html, /<h1>Digital egenkontrol til restaurant og takeaway<\/h1>/);
  const description = capture(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i);
  assert.ok(description.length >= 145 && description.length <= 160);
});

test('offentligt SEO-indhold bruger korrekt brand og ingen udokumenterede sensorløfter', () => {
  const files = pages.map(([, file]) => file).concat([
    'privatlivspolitik.html', 'vilkaar-og-betingelser.html', 'gdpr.html',
    'cookie-indstillinger.html', 'support.html', 'user-data-deletion.html',
  ]);
  const combined = files.map(read).join('\n');
  assert.doesNotMatch(combined, /Madkontrollen Pro|EWCP Egenkontrol|tidligere Madkontrollen/i);
  assert.doesNotMatch(combined, /automatisk temperaturmåling|realtidsmålinger/i);
  assert.doesNotMatch(combined, /opfylder[^.]{0,80}Fødevarestyrelsens krav/i);
  assert.match(combined, /Aroi-D/);
  assert.match(combined, /CVR 42405000|CVR: 42405000/);
});

test('sitemap og robots dækker salgssider og afskærmer appområder', () => {
  const sitemap = read('sitemap.xml');
  for (const [route] of pages) assert.match(sitemap, new RegExp(`<loc>https://madkontrollen\\.dk${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
  const robots = read('robots.txt');
  for (const blocked of ['/admin/', '/dashboard', '/login.html', '/quick-onboarding.html', '/modules/egenkontrol/', '/core/', '/platform/', '/sso/']) {
    assert.ok(robots.includes(`Disallow: ${blocked}`), `robots mangler ${blocked}`);
  }
});

test('Firebase Hosting har canonical-ruter og noindex-headere til private områder', () => {
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const hosting = Array.isArray(firebase.hosting) ? firebase.hosting[0] : firebase.hosting;
  const redirects = new Map((hosting.redirects || []).map((entry) => [entry.source, entry.destination]));
  assert.equal(redirects.get('/funktioner/digital-egenkontrol.html'), '/digital-egenkontrol/');
  assert.equal(redirects.get('/funktioner/risikoanalyse-haccp.html'), '/risikoanalyse-haccp/');
  assert.equal(redirects.get('/egenkontrol-restaurant'), '/egenkontrol-restaurant/');
  assert.equal(redirects.get('/egenkontrol-takeaway'), '/egenkontrol-takeaway/');
  const headers = JSON.stringify(hosting.headers || []);
  assert.match(headers, /X-Robots-Tag/);
  assert.match(headers, /noindex, nofollow/);
});
