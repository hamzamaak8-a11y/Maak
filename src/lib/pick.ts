import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { PickedFile } from './upload';

export async function pickImage(): Promise<PickedFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const mime = a.mimeType ?? (/\.png$/i.test(a.uri) ? 'image/png' : 'image/jpeg');
  return { uri: a.uri, name: a.fileName ?? 'image', mimeType: mime, size: a.fileSize ?? null };
}

/** Lets the user choose several photos at once (up to `limit`). */
export async function pickImages(limit: number): Promise<PickedFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: Math.max(1, limit) });
  if (res.canceled) return [];
  return res.assets.slice(0, limit).map(a => ({ uri: a.uri, name: a.fileName ?? 'image', mimeType: a.mimeType ?? (/\.png$/i.test(a.uri) ? 'image/png' : 'image/jpeg'), size: a.fileSize ?? null }));
}

export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf', size: a.size ?? null };
}

/** Lets the admin choose a .csv file and returns its text. */
export async function pickCsvText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  const text = await (await fetch(a.uri)).text();
  if (text.length > 1_000_000) throw new Error('err.fileTooBig');
  return text;
}
