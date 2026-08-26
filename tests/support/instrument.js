import { createInstrumenter } from 'istanbul-lib-instrument';

const instrumenter = createInstrumenter({
  coverageVariable: '__coverage__',
  esModules: false,
  produceSourceMap: false
});

/**
 * Coverage collected from every jsdom window created during this worker's run.
 * Merged and reported by tests/tools/coverage-report.mjs.
 */
export const collected = [];

/**
 * Instruments a script so that executing it populates `window.__coverage__`.
 * `filename` is what shows up in the coverage report — inline page scripts use
 * `<page>.html#script<n>` so each inline block is reported separately.
 */
export function instrument(code, filename) {
  try {
    return instrumenter.instrumentSync(code, filename);
  } catch {
    // A script we cannot parse (e.g. JSON-LD blocks) still has to run verbatim.
    return code;
  }
}

export function collectFrom(window) {
  if (window.__coverage__) collected.push(window.__coverage__);
}
