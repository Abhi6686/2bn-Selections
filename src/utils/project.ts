import type { Project, ProjectSelection, SelectionLevel } from "../types";

export function getProjectLevelSummary(project: Project): string {
  const levelsUsed = new Set(project.selections.map((selection) => selection.level));
  if (levelsUsed.size === 0) {
    return "No selections";
  }
  if (levelsUsed.size === 1) {
    return `Level ${project.selections[0].level}`;
  }
  return "All levels";
}

export function deriveDefaultLevel(selections: ProjectSelection[]): SelectionLevel {
  if (selections.length === 0) {
    return "1";
  }
  const levelCounts: Record<SelectionLevel, number> = { "1": 0, "2": 0, "3": 0 };
  for (const selection of selections) {
    levelCounts[selection.level] += 1;
  }
  const sortedLevels = (["1", "2", "3"] as SelectionLevel[]).sort(
    (left, right) => levelCounts[right] - levelCounts[left],
  );
  return sortedLevels[0];
}

export function isMixedLevelProject(project: Project): boolean {
  const levelsUsed = new Set(project.selections.map((selection) => selection.level));
  return levelsUsed.size > 1;
}
