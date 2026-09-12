import { supabase } from "./supabaseClient";
import type { DocType, ProviderDocumentRow } from "./onboarding";

export const PROVIDER_DOCUMENT_BUCKET = "provider-documents";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

function extensionFor(file: File): string {
  if (file.type === "application/pdf") return ".pdf";
  if (file.type === "image/png") return ".png";
  return ".jpg";
}

function buildStoragePath(userId: string, type: DocType, file: File): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${userId}/${type}-${Date.now()}-${random}${extensionFor(file)}`;
}

function validateDocument(file: File): void {
  if (!file) throw new Error("onb.vFileRequired");
  if (file.size === 0) throw new Error("onb.vFileEmpty");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("onb.vFileBig");
  if (!ALLOWED_DOCUMENT_MIME.has(file.type)) throw new Error("onb.vFileMime");
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("onboarding.authRequired");
  return data.user.id;
}

export async function uploadDocument(file: File, type: DocType): Promise<ProviderDocumentRow> {
  const userId = await requireUserId();
  validateDocument(file);

  const path = buildStoragePath(userId, type, file);
  const { error: uploadError } = await supabase.storage
    .from(PROVIDER_DOCUMENT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw new Error("onb.errUpload");

  const { data, error } = await supabase
    .from("provider_documents")
    .insert({
      provider_id: userId,
      document_type: type,
      storage_path: path,
      status: "pending",
    })
    .select("id,provider_id,document_type,storage_path,status,created_at")
    .single();

  if (error) {
    await supabase.storage.from(PROVIDER_DOCUMENT_BUCKET).remove([path]);
    throw new Error("onb.errSaveDoc");
  }

  return data as ProviderDocumentRow;
}

export async function getDocuments(): Promise<ProviderDocumentRow[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("provider_documents")
    .select("id,provider_id,document_type,storage_path,status,created_at")
    .eq("provider_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error("adm.loadDocsFail");
  return (data ?? []) as ProviderDocumentRow[];
}

export async function deleteDocument(documentId: string): Promise<void> {
  const userId = await requireUserId();
  const { data: document, error: readError } = await supabase
    .from("provider_documents")
    .select("id,provider_id,document_type,storage_path,status,created_at")
    .eq("id", documentId)
    .eq("provider_id", userId)
    .maybeSingle();

  if (readError || !document) throw new Error("steps.deleteFail");

  const { error: storageError } = await supabase.storage
    .from(PROVIDER_DOCUMENT_BUCKET)
    .remove([document.storage_path]);

  if (storageError) throw new Error("steps.deleteFail");

  const { error: deleteError } = await supabase
    .from("provider_documents")
    .delete()
    .eq("id", documentId)
    .eq("provider_id", userId);

  if (deleteError) throw new Error("steps.deleteFail");
}
