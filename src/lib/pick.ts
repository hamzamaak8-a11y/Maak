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

export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf', size: a.size ?? null };
}
