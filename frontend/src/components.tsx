import type { PermissionFlags } from "./api";

export interface Notice {
  ok: boolean;
  text: string;
}

export function Banner({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <div className={`banner ${notice.ok ? "banner-ok" : "banner-err"}`} role="status">
      {notice.text}
    </div>
  );
}

const LABELS: [keyof PermissionFlags, string][] = [
  ["can_read", "read"],
  ["can_update", "update"],
  ["can_delete", "delete"],
];

export function PermissionChips({ perms }: { perms: PermissionFlags }) {
  return (
    <span className="chips">
      {LABELS.map(([key, label]) => (
        <span key={key} className={`chip ${perms[key] ? "chip-on" : "chip-off"}`}>
          {label}
        </span>
      ))}
    </span>
  );
}
