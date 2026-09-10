import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
};

export default function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <article className="provider-stat-card">
      <div className="provider-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      {Icon ? <span className="provider-stat-icon"><Icon size={20} aria-hidden="true" /></span> : null}
    </article>
  );
}
