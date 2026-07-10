import type { Types } from "mongoose";
import { ThemeModel } from "../models/Theme.js";

export async function scoreLibraryItems(
  items: Array<{ tagSlugs?: string[]; toObject(): Record<string, unknown> }>,
  themeId?: Types.ObjectId | string,
): Promise<Array<Record<string, unknown> & { recommendationScore: number }>> {
  if (!themeId) {
    return items.map((item) => ({ ...item.toObject(), recommendationScore: 0 }));
  }

  const theme = await ThemeModel.findById(themeId);
  if (!theme) {
    return items.map((item) => ({ ...item.toObject(), recommendationScore: 0 }));
  }

  const weights = Object.fromEntries(theme.tagWeights ?? new Map());

  return items.map((item) => {
    let score = 0;
    for (const tagSlug of item.tagSlugs ?? []) {
      score += weights[tagSlug] ?? 0;
    }
    return { ...item.toObject(), recommendationScore: score };
  });
}

export function sortByRecommendation<T extends { recommendationScore?: number }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) => (right.recommendationScore ?? 0) - (left.recommendationScore ?? 0),
  );
}
