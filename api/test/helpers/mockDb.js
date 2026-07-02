// Replaces the query surface of the shared db module with a per-test handler.
// db.js exports one object that every route/middleware accesses by property
// (never destructured), so mutating it here reaches all consumers — no real
// MySQL needed. Tests dispatch on SQL substrings.
//
// Loaded via createRequire: the src tree is CommonJS, and native require
// guarantees a single shared module instance (an ESM import of the same file
// would create a second, separate instance under vitest).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('../../src/db.js');

const state = { handler: null };

async function dispatch(sql, params) {
  if (!state.handler) throw new Error('db handler not set for this test');
  return (await state.handler(sql, params)) || [];
}

db.query = (sql, params) => dispatch(sql, params);
db.pool = {
  query: async (sql, params) => [await dispatch(sql, params)],
  getConnection: async () => { throw new Error('getConnection not stubbed in these tests'); }
};

export function setDbHandler(fn) {
  state.handler = fn;
}
