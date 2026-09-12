import { supabase } from "./supabaseClient";
import type { DocType, ProviderDocumentRow } from "./onboarding";

export const PROVIDER_DOCUMENT_BUCKET = "provider-documents";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export const PROVIDER_PORTFOLIO_BUCKET = "provider-portfolio";
export const MAX_PORTFOLIO_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PORTFOLIO_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PortfolioImage = {
  id: string;
  path: string;
  url: string;
  created_at: string | null;
  content_type: string | null;
  size: number | null;
};

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

function extensionForPortfolio(file: File): string {
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}

function validatePortfolioImage(file: File): void {
  if (!file) throw new Error("portfolio.required");
  if (file.size === 0) throw new Error("portfolio.empty");
  if (file.size > MAX_PORTFOLIO_IMAGE_BYTES) throw new Error("portfolio.tooLarge");
  if (!ALLOWED_PORTFOLIO_IMAGE_MIME.has(file.type)) throw new Error("portfolio.invalidType");
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("onb.errLoadState");
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

export async function uploadPortfolioImage(file: File): Promise<PortfolioImage> {
  const userId = await requireUserId();
  validatePortfolioImage(file);
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/portfolio-${Date.now()}-${random}${extensionForPortfolio(file)}`;

  const { error } = await supabase.storage.from(PROVIDER_PORTFOLIO_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error("portfolio.uploadFail");

  const { data: signed, error: signedError } = await supabase.storage
    .from(PROVIDER_PORTFOLIO_BUCKET)
    .createSignedUrl(path, 3600);
  if (signedError || !signed?.signedUrl) {
    await supabase.storage.from(PROVIDER_PORTFOLIO_BUCKET).remove([path]);
    throw new Error("portfolio.urlFail");
  }

  return {
    id: path,
    path,
    url: signed.signedUrl,
    created_at: new Date().toISOString(),
    content_type: file.type,
    size: file.size,
  };
}

async function getPrivatePortfolioImages(providerId: string): Promise<PortfolioImage[]> {
  await requireUserId();
  const { data, error } = await supabase.storage.from(PROVIDER_PORTFOLIO_BUCKET).list(providerId, {
    limit: 100,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error("portfolio.loadFail");

  const files = (data ?? []).filter((row) => !!row.name && !!row.id);
  const paths = files.map((row) => `${providerId}/${row.name}`);
  if (paths.length === 0) return [];

  const { data: signedRows, error: signedError } = await supabase.storage
    .from(PROVIDER_PORTFOLIO_BUCKET)
    .createSignedUrls(paths, 3600);
  if (signedError) throw new Error("portfolio.urlFail");

  const byPath = new Map((signedRows ?? []).filter((row) => row.signedUrl).map((row) => [row.path ?? "", row.signedUrl]));
  return files.map((row) => {
    const path = `${providerId}/${row.name}`;
    return {
      id: path,
      path,
      url: byPath.get(path) ?? "",
      created_at: row.created_at ?? null,
      content_type: row.metadata?.mimetype ?? null,
      size: typeof row.metadata?.size === "number" ? row.metadata.size : null,
    };
  }).filter((row) => row.url);
}

export async function getPortfolioImages(providerId: number | string): Promise<PortfolioImage[]> {
  if (typeof providerId === "string") return getPrivatePortfolioImages(providerId);

  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!apiUrl) throw new Error("portfolio.loadFail");
  try {
    const response = await fetch(`${apiUrl}/api/providers/${providerId}/portfolio`);
    if (!response.ok) throw new Error("portfolio.loadFail");
    return (await response.json()) as PortfolioImage[];
  } catch (error) {
    console.error("Portfolio fetch failed", error);
    throw new Error("portfolio.loadFail");
  }
}

export async function deletePortfolioImage(imageId: string): Promise<void> {
  await requireUserId();
  const path = imageId;
  if (!path || path.split("/").length < 2) throw new Error("portfolio.deleteFail");
  const { error } = await supabase.storage.from(PROVIDER_PORTFOLIO_BUCKET).remove([path]);
  if (error) throw new Error("portfolio.deleteFail");
}
