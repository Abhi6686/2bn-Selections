import baseLibrary from "../data/selectionLibrary.json";
import type { LibraryItem, SelectionLevel } from "../types";

interface RawLibraryItem {
  category: string;
  manufacturer: string;
  model: string;
  product: string;
  finish: string;
  priceMin: number;
  priceMax: number;
  group?: string;
  optional?: boolean;
  imageUrl?: string;
}

function buildLibraryItems(): LibraryItem[] {
  const items: LibraryItem[] = [];
  const levels = baseLibrary.levels as Record<
    SelectionLevel,
    { items: RawLibraryItem[] }
  >;

  for (const level of ["1", "2", "3"] as SelectionLevel[]) {
    for (const rawItem of levels[level].items) {
      items.push({
        id: `lib-${level}-${rawItem.model.replace(/\s+/g, "-")}`,
        level,
        category: rawItem.category,
        manufacturer: rawItem.manufacturer,
        model: rawItem.model,
        product: rawItem.product,
        finish: rawItem.finish,
        priceMin: rawItem.priceMin,
        priceMax: rawItem.priceMax,
        group: rawItem.group,
        optional: rawItem.optional,
        imageUrl: rawItem.imageUrl,
      });
    }
  }

  return items;
}

const imageUrlByItemId = new Map(
  buildLibraryItems().map((item) => [item.id, item.imageUrl] as const),
);

export function mergeLibraryImages(storedItems: LibraryItem[]): LibraryItem[] {
  const freshItems = createInitialLibrary();
  const freshById = new Map(freshItems.map((item) => [item.id, item]));

  return storedItems.map((item) => {
    const fresh = freshById.get(item.id);
    return {
      ...item,
      imageUrl: item.imageUrl ?? fresh?.imageUrl,
    };
  });
}

export const defaultCategories: string[] = baseLibrary.categories;
export const changeOrderMinimum: number = baseLibrary.meta.changeOrderMinimum;
export const vendorName: string = baseLibrary.meta.vendor;

export function createInitialLibrary(): LibraryItem[] {
  return buildLibraryItems();
}

export function findItemsForCategory(
  libraryItems: LibraryItem[],
  category: string,
  level?: SelectionLevel,
): LibraryItem[] {
  return libraryItems
    .filter(
      (item) =>
        item.category === category && (level === undefined || item.level === level),
    )
    .sort((left, right) => left.level.localeCompare(right.level));
}

export function findItemsForCategoryAllLevels(
  libraryItems: LibraryItem[],
  category: string,
): LibraryItem[] {
  return findItemsForCategory(libraryItems, category);
}

export function getLibraryItemImage(item: LibraryItem | undefined): string | undefined {
  if (!item) return undefined;
  return item.imageUrl ?? imageUrlByItemId.get(item.id);
}

export const levelLabels: Record<SelectionLevel, string> = {
  "1": "Level 1 — Value",
  "2": "Level 2 — Mid",
  "3": "Level 3 — Premium",
};
