/**
 * Test Suite: Graphify Integration, Knowledge Graph Invariants & Agent Hooks
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const graphifyOutDir = path.join(rootDir, 'graphify-out');
const graphJsonPath = path.join(graphifyOutDir, 'graph.json');
const graphReportPath = path.join(graphifyOutDir, 'GRAPH_REPORT.md');
const graphHtmlPath = path.join(graphifyOutDir, 'graph.html');

console.log('--- Testing Graphify Knowledge Graph Invariants ---');

// 1. Verify graphify-out directory and essential artifacts exist
assert.ok(fs.existsSync(graphifyOutDir), 'graphify-out/ directory must exist');
assert.ok(fs.existsSync(graphJsonPath), 'graphify-out/graph.json must exist');
assert.ok(fs.existsSync(graphReportPath), 'graphify-out/GRAPH_REPORT.md must exist');
assert.ok(fs.existsSync(graphHtmlPath), 'graphify-out/graph.html must exist');

// 2. Validate graph.json structure and non-trivial node/edge counts
const graphRaw = fs.readFileSync(graphJsonPath, 'utf8');
let graph;
try {
  graph = JSON.parse(graphRaw);
} catch (err) {
  assert.fail(`graph.json is not valid JSON: ${err.message}`);
}

assert.ok(Array.isArray(graph.nodes), 'graph.nodes must be an array');
const edges = Array.isArray(graph.links) ? graph.links : graph.edges;
assert.ok(Array.isArray(edges), 'graph must have links or edges array');
assert.ok(graph.nodes.length > 50, `graph.nodes count should be substantial (found ${graph.nodes.length})`);
assert.ok(edges.length > 50, `edges count should be substantial (found ${edges.length})`);

// 3. Verify core codebase modules are indexed in graph.nodes
const nodeIds = new Set(graph.nodes.map(n => n.id || n.label || ''));
const nodeFiles = new Set(graph.nodes.map(n => n.source_file || '').filter(Boolean));

const expectedSymbolsOrFiles = [
  'crypto.js',
  'storageService.js',
  'smtpService.js',
  'aiService.js',
  'App.jsx',
  'settings.js'
];

for (const item of expectedSymbolsOrFiles) {
  const fileMatched = Array.from(nodeFiles).some(f => f.includes(item));
  const idMatched = Array.from(nodeIds).some(id => id.includes(item));
  assert.ok(fileMatched || idMatched, `Expected core module "${item}" to be indexed in the knowledge graph`);
}

// 4. Verify graphify CLI is runnable and reports valid version
const versionRes = spawnSync('graphify', ['--version'], { encoding: 'utf8', cwd: rootDir });
assert.strictEqual(versionRes.status, 0, `graphify --version failed: ${versionRes.stderr}`);
assert.match(versionRes.stdout, /graphify \d+\.\d+/, 'graphify output should match expected version pattern');

// 5. Test graph query execution
const queryRes = spawnSync('graphify', ['query', 'crypto.js'], { encoding: 'utf8', cwd: rootDir });
assert.strictEqual(queryRes.status, 0, `graphify query failed: ${queryRes.stderr}`);
assert.ok(
  queryRes.stdout.includes('EDGE') || queryRes.stdout.includes('NODE') || queryRes.stdout.includes('crypto'),
  'graphify query for crypto.js should return graph context'
);

// 6. Verify agent instructions contain graphify mandates
const agentsMd = fs.readFileSync(path.join(rootDir, 'AGENTS.md'), 'utf8');
const claudeMd = fs.readFileSync(path.join(rootDir, 'CLAUDE.md'), 'utf8');
const geminiMd = fs.readFileSync(path.join(rootDir, 'GEMINI.md'), 'utf8');

assert.ok(agentsMd.includes('## graphify'), 'AGENTS.md must contain graphify section');
assert.ok(claudeMd.includes('## graphify'), 'CLAUDE.md must contain graphify section');
assert.ok(geminiMd.includes('## graphify'), 'GEMINI.md must contain graphify section');

// 7. Verify git post-commit hook exists and references graphify
const hookPath = path.join(rootDir, '.git', 'hooks', 'post-commit');
if (fs.existsSync(hookPath)) {
  const hookContent = fs.readFileSync(hookPath, 'utf8');
  assert.ok(hookContent.includes('graphify'), 'post-commit hook must reference graphify auto-rebuild');
}

// 8. Verify package.json scripts
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
assert.ok(pkg.scripts['graphify:update'], 'package.json must contain graphify:update script');
assert.ok(pkg.scripts['graphify:query'], 'package.json must contain graphify:query script');

console.log('✓ All Graphify Knowledge Graph Invariants PASSED');
