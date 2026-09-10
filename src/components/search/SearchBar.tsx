import { Search, X } from "lucide-react";
import { useLanguage } from "../../i18n";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
};

export default function SearchBar({ value, onChange, onClear }: SearchBarProps) {
  const { t } = useLanguage();
  return (
    <label className="market-searchbar">
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        autoComplete="off"
      />
      {value ? (
        <button type="button" className="market-searchbar-clear" onClick={onClear ?? (() => onChange(""))} aria-label={t("search.clear")}>
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}
