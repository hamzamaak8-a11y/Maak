import { supabase } from './supabase';

export type PickedFile = { uri: string; name: string; mimeType: string; size: number | null };

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf' };

export function validateFile(file: PickedFile, allowed: string[]): void {
  if (!allowed.includes(file.mimeType)) throw new Error('err.fileType');
  if (file.size != null && file.size > MAX_FILE_BYTES) throw new Error('err.fileTooBig');
}

/** Uploads a picked file to `<bucket>/<userId>/<prefix>-<timestamp>-<random>.<ext>` and returns the object path. */
export async function uploadToBucket(bucket: string, userId: string, prefix: string, file: PickedFile): Promise<string> {
  const ext = EXT[file.mimeType] ?? '.bin';
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${prefix}-${Date.now()}-${rand}${ext}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  if (body.byteLength === 0) throw new Error('err.fileType');
  if (body.byteLength > MAX_FILE_BYTES) throw new Error('err.fileTooBig');
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: file.mimeType, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return path;
}
