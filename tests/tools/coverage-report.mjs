#!/usr/bin/env node
// Merges the per-worker istanbul coverage dumps written by the test run and
// prints a per-file summary (plus an lcov report under coverage/).
import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import libCoverage from 'istanbul-lib-coverage';
import { createContext } from 'istanbul-lib-report';
import { create as createReport } from 'istanbul-reports';

const RAW_DIR = path.resolve('.coverage-raw');
const OUT_DIR = path.resolve('coverage');

if (!existsSync(RAW_DIR)) {
  console.error('No coverage data found — run `npm test` first.');
  process.exit(1);
}

const map = libCoverage.createCoverageMap({});
for (const file of readdirSync(RAW_DIR).filter(f => f.endsWith('.json'))) {
  map.merge(JSON.parse(readFileSync(path.join(RAW_DIR, file), 'utf8')));
}

const rows = map.files().map(file => {
  const summary = map.fileCoverageFor(file).toSummary();
  return {
    file,
    statements: summary.statements,
    branches: summary.branches,
    functions: summary.functions
  };
});

const pad = (s, n) => String(s).padEnd(n);
const pct = m => (m.total === 0 ? '   n/a' : `${m.pct.toFixed(1).padStart(5)}%`);
const width = Math.max(20, ...rows.map(r => r.file.length));

console.log(`${pad('file', width)}  stmts  branch   funcs  uncovered stmts`);
for (const row of rows.sort((a, b) => a.statements.pct - b.statements.pct)) {
  const missing = row.statements.total - row.statements.covered;
  console.log(
    `${pad(row.file, width)} ${pct(row.statements)} ${pct(row.branches)} ${pct(row.functions)}` +
    `  ${missing}/${row.statements.total}`
  );
}

const total = map.getCoverageSummary();
console.log(`${pad('ALL', width)} ${pct(total.statements)} ${pct(total.branches)} ${pct(total.functions)}`);

mkdirSync(OUT_DIR, { recursive: true });
const context = createContext({ coverageMap: map, dir: OUT_DIR });
createReport('lcovonly').execute(context);
createReport('html').execute(context);
