#!/usr/bin/env node
/**
 * living-system-map — build a self-contained interactive system map from one data file.
 *
 *   node build.js [data-file] [-o output.html]
 *
 * Defaults: reads ./system-map.data.js, writes ./system-map.html
 * No dependencies. Node 14+.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* ---------- args ---------- */
const argv = process.argv.slice(2);
let dataPath = null, outPath = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-o' || a === '--out') { outPath = argv[++i]; }
  else if (a === '-h' || a === '--help') { help(); process.exit(0); }
  else if (!dataPath) { dataPath = a; }
}
dataPath = path.resolve(dataPath || 'system-map.data.js');
outPath = path.resolve(outPath || path.join(path.dirname(dataPath), 'system-map.html'));

/** Show whichever of the relative/absolute path is shorter — `../../../..` chains
 *  are harder to read than the absolute path they resolve to. */
function shortPath(p) {
  const rel = path.relative(process.cwd(), p);
  return rel && rel.length < p.length && !rel.startsWith('../../..') ? rel : p;
}

function help() {
  console.log(`
living-system-map

  node build.js [data-file] [-o output.html]

  data-file   path to your map data (default: ./system-map.data.js)
  -o, --out   output path (default: alongside the data file, system-map.html)

The output is a single self-contained HTML file. No server, no dependencies.
`);
}

/* ---------- default palettes ----------
   Used when a domain/status omits `color`. Chosen to stay distinguishable
   against both light and dark backgrounds, and to survive the common forms of
   colour-vision deficiency by varying lightness as well as hue. */
const DOMAIN_PALETTE = [
  { light: '#6257F2', dark: '#8B82FF' },
  { light: '#0E9E93', dark: '#35C3B6' },
  { light: '#C9821F', dark: '#E3A748' },
  { light: '#CB4F92', dark: '#E877B4' },
  { light: '#4E6E8E', dark: '#7DA0C0' },
  { light: '#7C51E6', dark: '#A585F2' },
  { light: '#2F7D4F', dark: '#4FB37A' },
  { light: '#B5453C', dark: '#E8756B' },
];
const STATUS_PALETTE = [
  { light: '#1F9A63', dark: '#3EBE85' },
  { light: '#C9821F', dark: '#E3A748' },
  { light: '#7C51E6', dark: '#A585F2' },
  { light: '#74848F', dark: '#8496A1' },
  { light: '#0E8C9E', dark: '#47C8D7' },
];
const KINDS = ['triggers', 'feeds', 'calls', 'reads', 'emits'];

/* ---------- load ---------- */
if (!fs.existsSync(dataPath)) {
  fail(`data file not found: ${dataPath}\n\nCreate one (see SCHEMA.md) or pass a path:\n  node build.js path/to/system-map.data.js`);
}
let data;
try {
  delete require.cache[require.resolve(dataPath)];
  data = require(dataPath);
} catch (e) {
  fail(`could not load ${shortPath(dataPath)}:\n  ${e.message}`);
}
if (!data || typeof data !== 'object') fail('data file must `module.exports = { ... }` an object.');

/* ---------- validate ----------
   Every problem is collected and reported at once. A map that renders blank in a
   browser because of one bad id is the single most annoying failure mode here, so
   dangling references are errors, not warnings. */
const errors = [];
const warnings = [];

const stages = arr(data.stages, 'stages');
const domains = arr(data.domains, 'domains');
const statuses = arr(data.statuses, 'statuses');
const nodes = arr(data.nodes, 'nodes');
const edges = arr(data.edges, 'edges');

function arr(v, name) {
  if (v == null) return [];
  if (!Array.isArray(v)) { errors.push(`\`${name}\` must be an array.`); return []; }
  return v;
}

if (!stages.length) errors.push('`stages` is empty — you need at least one band for nodes to sit in.');
if (!domains.length) errors.push('`domains` is empty — you need at least one colour family.');
if (!nodes.length) errors.push('`nodes` is empty — nothing to draw.');

const stageIds = new Set(), domainIds = new Set(), statusIds = new Set(), nodeIds = new Set();
dupCheck(stages, stageIds, 'stage');
dupCheck(domains, domainIds, 'domain');
dupCheck(statuses, statusIds, 'status');
dupCheck(nodes, nodeIds, 'node');

function dupCheck(list, set, label) {
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') { errors.push(`${label}[${i}] is not an object.`); return; }
    if (!item.id) { errors.push(`${label}[${i}] is missing \`id\`.`); return; }
    if (set.has(item.id)) errors.push(`duplicate ${label} id "${item.id}".`);
    set.add(item.id);
    if (!item.label && !item.name) warnings.push(`${label} "${item.id}" has no \`label\` — the id will be shown instead.`);
  });
}

nodes.forEach((n, i) => {
  const where = `node "${n && n.id ? n.id : '#' + i}"`;
  if (!n || !n.id) return;
  if (!n.name) errors.push(`${where} is missing \`name\`.`);
  if (!n.stage) errors.push(`${where} is missing \`stage\`.`);
  else if (!stageIds.has(n.stage)) errors.push(`${where} has stage "${n.stage}" which is not in \`stages\`.`);
  if (!n.domain) errors.push(`${where} is missing \`domain\`.`);
  else if (!domainIds.has(n.domain)) errors.push(`${where} has domain "${n.domain}" which is not in \`domains\`.`);
  if (n.status && !statusIds.has(n.status)) errors.push(`${where} has status "${n.status}" which is not in \`statuses\`.`);
  if (!n.role) warnings.push(`${where} has no \`role\` — the side panel will look empty.`);

  if (n.steps) {
    const spine = Array.isArray(n.steps.spine) ? n.steps.spine : [];
    const parallel = Array.isArray(n.steps.parallel) ? n.steps.parallel : [];
    const seen = new Set();
    spine.concat(parallel).forEach((s, j) => {
      if (!s || !s.id) { errors.push(`${where} step[${j}] is missing \`id\`.`); return; }
      if (seen.has(s.id)) errors.push(`${where} has duplicate step id "${s.id}".`);
      seen.add(s.id);
      if (!s.name) errors.push(`${where} step "${s.id}" is missing \`name\`.`);
    });
    if (n.steps.branchFrom && !seen.has(n.steps.branchFrom)) {
      errors.push(`${where} has branchFrom "${n.steps.branchFrom}" which is not one of its steps.`);
    }
    if (parallel.length && !n.steps.branchFrom) {
      warnings.push(`${where} has parallel steps but no \`branchFrom\` — they will hang off the first step.`);
    }
  }
});

edges.forEach((e, i) => {
  const where = `edge[${i}]`;
  if (!e || typeof e !== 'object') { errors.push(`${where} is not an object.`); return; }
  if (!e.from) errors.push(`${where} is missing \`from\`.`);
  else if (!nodeIds.has(e.from)) errors.push(`${where} from "${e.from}" is not a known node id.`);
  if (!e.to) errors.push(`${where} is missing \`to\`.`);
  else if (!nodeIds.has(e.to)) errors.push(`${where} to "${e.to}" is not a known node id.`);
  if (e.from && e.from === e.to) warnings.push(`${where} points "${e.from}" at itself; it will not be drawn usefully.`);
  if (!e.kind) errors.push(`${where} is missing \`kind\` (one of: ${KINDS.join(', ')}).`);
  else if (!KINDS.includes(e.kind)) errors.push(`${where} has kind "${e.kind}"; must be one of: ${KINDS.join(', ')}.`);
  if (!e.label) warnings.push(`${where} (${e.from} → ${e.to}) has no \`label\` — the panel will show the bare kind.`);
});

// A stage nobody uses draws an empty band label; more often it means a typo.
stages.forEach(s => {
  if (s.id && !nodes.some(n => n && n.stage === s.id)) warnings.push(`stage "${s.id}" has no nodes.`);
});
// Isolated nodes are usually a missed connection, and they are the whole point of the map.
const connected = new Set();
edges.forEach(e => { if (e && e.from) connected.add(e.from); if (e && e.to) connected.add(e.to); });
const orphans = nodes.filter(n => n && n.id && !connected.has(n.id)).map(n => n.id);
if (orphans.length) warnings.push(`${orphans.length} node(s) have no connections at all: ${orphans.join(', ')}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem${errors.length > 1 ? 's' : ''} in ${shortPath(dataPath)}:\n`);
  errors.forEach(e => console.error('  · ' + e));
  console.error('');
  process.exit(1);
}

/* ---------- colours ---------- */
function colorFor(item, i, palette) {
  const light = item.color || palette[i % palette.length].light;
  const dark = item.colorDark || item.color || palette[i % palette.length].dark;
  return { light, dark };
}
const domColors = domains.map((d, i) => ({ id: d.id, ...colorFor(d, i, DOMAIN_PALETTE) }));
const staColors = statuses.map((s, i) => ({ id: s.id, ...colorFor(s, i, STATUS_PALETTE) }));

function varBlock(mode) {
  return domColors.map(d => `--d-${cssId(d.id)}:${d[mode]};`).join('')
       + staColors.map(s => `--s-${cssId(s.id)}:${s[mode]};`).join('');
}
function cssId(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, '-'); }
function cssAttr(id) { return String(id).replace(/["\\]/g, '\\$&'); }

const COLORS = [
  `:root{${varBlock('light')}}`,
  `@media (prefers-color-scheme:dark){:root{${varBlock('dark')}}}`,
  `:root[data-theme="light"]{${varBlock('light')}}`,
  `:root[data-theme="dark"]{${varBlock('dark')}}`,
  domColors.map(d => `[data-domain="${cssAttr(d.id)}"]{--dom:var(--d-${cssId(d.id)});}`).join(''),
  staColors.map(s => `[data-status="${cssAttr(s.id)}"]{--st:var(--s-${cssId(s.id)});}`).join(''),
].join('\n');

/* ---------- assemble ---------- */
const payload = {
  title: data.title || 'System Map',
  kicker: data.kicker || 'System Map',
  subtitle: data.subtitle || 'How everything connects',
  layout: data.layout || {},
  stages: stages.map(s => ({ id: s.id, label: s.label || s.id, numbered: s.numbered !== false })),
  domains: domains.map(d => ({ id: d.id, label: d.label || d.id })),
  statuses: statuses.map(s => ({ id: s.id, label: s.label || s.id })),
  nodes,
  edges,
};

// `</script` inside any string would close the inline script tag early.
const json = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script');

const tplPath = path.join(__dirname, 'template.html');
if (!fs.existsSync(tplPath)) fail(`template.html not found next to build.js (looked in ${__dirname}).`);
let out = fs.readFileSync(tplPath, 'utf8');

const before = out;
out = out
  .replace('/*__COLORS__*/', COLORS)
  .replace(/\/\*__DATA__\*\/[\s\S]*?\/\*__DATA__\*\//, json)
  .replace(/__TITLE__/g, escHtml(payload.title))
  .replace(/__KICKER__/g, escHtml(payload.kicker))
  .replace(/__SUBTITLE__/g, escHtml(payload.subtitle));

if (out === before) fail('template.html has no placeholders left — is it the right file?');
if (out.includes('/*__DATA__*/')) fail('failed to inject data into template.html.');

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);

/* ---------- report ---------- */
const withSteps = nodes.filter(n => n.steps && n.steps.spine && n.steps.spine.length).length;
const withHow = nodes.filter(n => n.how).length;

if (warnings.length) {
  console.log(`\n! ${warnings.length} warning${warnings.length > 1 ? 's' : ''}:`);
  warnings.forEach(w => console.log('  · ' + w));
}
console.log(`
✓ ${shortPath(outPath)}  (${(out.length / 1024).toFixed(0)} KB)
  ${nodes.length} nodes · ${edges.length} edges · ${stages.length} stages · ${domains.length} domains
  ${withSteps}/${nodes.length} have a step breakdown · ${withHow}/${nodes.length} have a deep write-up
`);

function fail(msg) {
  console.error('\n✗ ' + msg + '\n');
  process.exit(1);
}
