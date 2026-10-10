// Run: node --experimental-strip-types tests/documentDelete.test.mjs
import assert from 'node:assert/strict';
import { deleteDocumentWith } from '../src/lib/documentDelete.ts';

const doc = (status) => ({ id: 'd1', provider_id: 'p1', storage_path: 'p1/id-1', status });
function fake({ rows = 1, rowError = null, fileError = null } = {}) {
  const log = [];
  return { log, client: {
    deleteRow: async () => { log.push('row'); return { deleted: rows, error: rowError }; },
    removeFile: async (p) => { log.push('file:' + p); return { error: fileError }; },
    rememberOrphan: async (p) => { log.push('orphan:' + p); },
  } };
}

// approved / rejected: refused before anything is touched (the old code deleted the FILE first)
for (const s of ['approved', 'rejected']) { const f = fake(); await assert.rejects(deleteDocumentWith(f.client, doc(s)), /document_locked/); assert.deepEqual(f.log, [], s + ' must not touch the row or the file'); }
// the database hides the row (0 rows, no error): not a success, and the file is NOT deleted
{ const f = fake({ rows: 0 }); await assert.rejects(deleteDocumentWith(f.client, doc('pending')), /document_locked/); assert.deepEqual(f.log, ['row']); }
// the database fails: surfaced, file untouched
{ const f = fake({ rowError: new Error('network') }); await assert.rejects(deleteDocumentWith(f.client, doc('pending')), /network/); assert.deepEqual(f.log, ['row']); }
// normal case: row first, then the file
{ const f = fake(); await deleteDocumentWith(f.client, doc('pending')); assert.deepEqual(f.log, ['row', 'file:p1/id-1']); }
// the file cannot be removed after the row is gone: reported, remembered for a retry, never a false "all done"
{ const f = fake({ fileError: new Error('storage 500') }); await assert.rejects(deleteDocumentWith(f.client, doc('pending')), /document_file_left/); assert.deepEqual(f.log, ['row', 'file:p1/id-1', 'orphan:p1/id-1']); }
console.log('documentDelete: 6 scenarios passed');
