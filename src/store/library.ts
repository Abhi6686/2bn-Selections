import baseLibrary from "../data/selectionLibrary.json";
import masterCategories from "../data/masterCategories.json";
import type { LibraryItem, SelectionLevel } from "../types";
import { LEVEL_LABELS } from "../types";

interface RawLibraryItem {
  category: string;
  categoryKey?: string;
  selectionSlot?: string;
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
        categoryKey: rawItem.categoryKey ?? rawItem.category,
        selectionSlot: rawItem.selectionSlot,
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

export const masterCategorySections = masterCategories.sections;
export const masterFlatCategories: string[] = masterCategories.flatCategories;
export const defaultCategories: string[] = masterFlatCategories.length
  ? masterFlatCategories
  : baseLibrary.categories;
export const styleThemesFromMasterList: string[] =
  masterCategories.meta.styleThemesFromDocument;
export const changeOrderMinimum: number = baseLibrary.meta.changeOrderMinimum;
export const vendorName: string = baseLibrary.meta.vendor;

export function createInitialLibrary(): LibraryItem[] {
  return buildLibraryItems();
}

export function itemMatchesCategoryKey(item: LibraryItem, categoryKey: string): boolean {
  return (
    item.categoryKey === categoryKey ||
    item.category === categoryKey ||
    `${item.category} - ${item.selectionSlot ?? ""}`.trim() === categoryKey
  );
}

export function getWizardCategoryKeys(libraryItems: LibraryItem[]): string[] {
  const keys = new Set<string>();
  for (const item of libraryItems) {
    const key =
      item.categoryKey ??
      (item.selectionSlot ? `${item.category} - ${item.selectionSlot}` : item.category);
    keys.add(key);
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function formatWizardStepLabel(categoryKey: string): string {
  const parts = categoryKey.split(" - ");
  if (parts.length >= 2) {
    return parts.slice(-2).join(" — ");
  }
  return categoryKey;
}

export function findItemsForCategory(
  libraryItems: LibraryItem[],
  categoryKey: string,
  level?: SelectionLevel,
): LibraryItem[] {
  return libraryItems
    .filter(
      (item) =>
        itemMatchesCategoryKey(item, categoryKey) &&
        (level === undefined || item.level === level),
    )
    .sort((left, right) => left.level.localeCompare(right.level));
}

export function findItemsForCategoryAllLevels(
  libraryItems: LibraryItem[],
  categoryKey: string,
): LibraryItem[] {
  return findItemsForCategory(libraryItems, categoryKey);
}

export function getLibraryItemImage(item: LibraryItem | undefined): string | undefined {
  if (!item) return undefined;
  return item.imageUrl ?? imageUrlByItemId.get(item.id);
}

export const levelLabels = LEVEL_LABELS;
