import { SelectionLevel } from "../types";
import { Badge } from "./ui/badge";

interface LevelBadgeProps {
  level: SelectionLevel;
}

export function LevelBadge({ level }: LevelBadgeProps) {
  if (level === "1") {
    return <Badge variant="level1">Level 1 — Value</Badge>;
  }
  if (level === "2") {
    return <Badge variant="level2">Level 2 — Mid</Badge>;
  }
  return <Badge variant="level3">Level 3 — Premium</Badge>;
}
