import { DOC_TYPES, type OnboardingPersonal, type OnboardingProfessional, type ProviderDocumentRow } from "../../lib/onboarding";
import { useLanguage } from "../../i18n";

export default function ReviewStep({
  personal,
  professional,
  documents,
}: {
  personal: OnboardingPersonal;
  professional: OnboardingProfessional;
  documents: ProviderDocumentRow[];
}) {
  const { t } = useLanguage();
  const rows: Array<[string, string]> = [
    [t("common.name"), personal.full_name],
    [t("common.phone"), personal.phone],
    [t("common.city"), personal.city],
    [t("steps.profession"), professional.profession],
    [t("steps.serviceCategory"), t(professional.service_category)],
    [t("steps.reviewExp"), professional.experience_years || "—"],
    [t("adm.bio"), professional.bio],
    [t("pdetail.services"), professional.services.length ? professional.services.join(t("common.listSep")) : t("onb.notSet")],
    [t("steps.reviewPrice"), professional.price_from ? t("price.from") + " " + professional.price_from : t("onb.onContact")],
    [t("pdetail.range"), professional.service_radius_km ? professional.service_radius_km + t("onb.kmSuffix") : t("common.unspecified")],
  ];
  const docRows = (Object.keys(DOC_TYPES) as Array<keyof typeof DOC_TYPES>).map((dt) => {
    const doc = documents.find((d) => d.document_type === dt);
    return [t(DOC_TYPES[dt].label), doc ? t("steps.uploadedOk") : t("steps.notUploaded")] as [string, string];
  });
  return (
    <div className="onb-step-card">
      <h2 className="onb-step-title">{t("steps.reviewTitle")}</h2>
      <p className="onb-step-sub">{t("onb.reviewSub")}</p>
      <div className="onb-review">
        {rows.map(([k, v]) => (
          <div key={k} className="onb-review-row"><span>{k}</span><span>{v || "—"}</span></div>
        ))}
        {docRows.map(([k, v]) => (
          <div key={k} className="onb-review-row"><span>{k}</span><span>{v}</span></div>
        ))}
      </div>
    </div>
  );
}
