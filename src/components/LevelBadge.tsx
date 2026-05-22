import type { SelectionLevel } from "../types";

const labels: Record<SelectionLevel, string> = {
  "1": "Level 1",
  "2": "Level 2",
  "3": "Level 3",
};

export function LevelBadge({ level }: { level: SelectionLevel }) {
  return <span className={`level-badge l${level}`}>{labels[level]}</span>;
}
