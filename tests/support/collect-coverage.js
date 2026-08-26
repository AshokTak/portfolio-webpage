import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll } from 'vitest';
import libCoverage from 'istanbul-lib-coverage';
import { collected } from './instrument.js';
import { repoPath } from './page.js';

const OUT_DIR = repoPath('.coverage-raw');

afterAll(() => {
  if (!collected.length) return;
  const map = libCoverage.createCoverageMap({});
  collected.forEach(data => map.merge(data));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${randomUUID()}.json`, JSON.stringify(map.toJSON()));
});
