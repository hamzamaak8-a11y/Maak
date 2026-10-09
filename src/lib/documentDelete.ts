/**
 * Deleting an identity document, in the only order that cannot leave a false "approved": the database row first (and PROVEN deleted), then the file.
 * Supabase answers "0 rows deleted" without an error when a policy hides the row, so the number of deleted rows is checked.
 * If the file cannot be removed afterwards the row is already gone, the path is remembered and retried later: an upload without a row is
 * never mistaken for evidence and the owner is always allowed to delete it.
 */
export type DocRef = { id: string; provider_id: string; storage_path: string; status: string };

export type DocClient = {
  deleteRow(doc: DocRef): Promise<{ deleted: number; error: unknown }>;
  removeFile(path: string): Promise<{ error: unknown }>;
  rememberOrphan(path: string): Promise<void>;
};

export async function deleteDocumentWith(client: DocClient, doc: DocRef): Promise<void> {
  if (doc.status !== 'pending') throw new Error('document_locked'); // approved / rejected documents are evidence: the database refuses too
  const { deleted, error } = await client.deleteRow(doc);
  if (error) throw error;
  if (deleted === 0) throw new Error('document_locked'); // nothing was deleted: do not claim success
  const removed = await client.removeFile(doc.storage_path);
  if (removed.error) {
    await client.rememberOrphan(doc.storage_path);
    throw new Error('document_file_left');
  }
}
