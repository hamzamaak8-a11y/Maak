import { useState } from "react";
import { Check, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useLanguage } from "../../i18n";
import { DOC_TYPES, type DocType, type ProviderDocumentRow } from "../../lib/onboarding";
import { deleteDocument, uploadDocument } from "../../lib/storage";

export default function DocumentsStep({
  documents,
  onDocumentsChange,
}: {
  documents: ProviderDocumentRow[];
  onDocumentsChange: (docs: ProviderDocumentRow[]) => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(docType: DocType, file: File | null) {
    if (!file) return;
    setError(null);
    setBusy(docType);
    try {
      const existing = documents.find((d) => d.document_type === docType);
      if (existing) await deleteDocument(existing.id);
      const created = await uploadDocument(file, docType);
      onDocumentsChange(documents.filter((d) => d.document_type !== docType).concat(created));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("steps.uploadFail"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(doc: ProviderDocumentRow) {
    setError(null);
    setBusy(doc.document_type);
    try {
      await deleteDocument(doc.id);
      onDocumentsChange(documents.filter((d) => d.id !== doc.id));
    } catch {
      setError(t("steps.deleteFail"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="onb-step-card">
      <h2 className="onb-step-title">{t("steps.docsTitle")}</h2>
      <p className="onb-step-sub">{t("steps.docsSub")}</p>
      {error ? <div className="onb-error">{t(error)}</div> : null}
      <div className="onb-docs">
        {(Object.keys(DOC_TYPES) as DocType[]).map((dt) => {
          const cfg = DOC_TYPES[dt];
          const doc = documents.find((d) => d.document_type === dt);
          const isBusy = busy === dt;
          return (
            <div key={dt} className="onb-doc">
              <div className="onb-doc-head">
                <span className="onb-doc-label">{t(cfg.label)}{cfg.required ? " *" : ""}</span>
                {doc ? <span className="onb-doc-ok"><Check size={13} /> {t("common.uploaded")}</span> : null}
              </div>
              {doc ? (
                <div className="onb-doc-done">
                  <span className="onb-doc-file"><FileText size={15} /> {doc.storage_path.split("/").pop()}</span>
                  <button className="mini-button" type="button" disabled={isBusy} onClick={() => handleRemove(doc)}>
                    {isBusy ? <Loader2 className="auth-spin" size={14} /> : <Trash2 size={14} />}
                    <span>{t("common.delete")}</span>
                  </button>
                </div>
              ) : (
                <label className={"onb-upload" + (isBusy ? " busy" : "")}>
                  <input type="file" accept={cfg.accept} disabled={isBusy} onChange={(e) => handleFile(dt, e.target.files?.[0] ?? null)} />
                  {isBusy ? <Loader2 className="auth-spin" size={18} /> : <Upload size={18} />}
                  <span>{t("steps.chooseFile")}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
