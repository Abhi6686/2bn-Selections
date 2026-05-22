import type { AppState, Project } from "../types";
import { createInitialLibrary, defaultCategories, mergeLibraryImages } from "./library";

const STORAGE_KEY = "2bn-selections-app-v1";

function enrichProjects(projects: Project[], libraryItems: ReturnType<typeof mergeLibraryImages>): Project[] {
  const libraryById = new Map(libraryItems.map((item) => [item.id, item]));

  return projects.map((project) => ({
    ...project,
    selections: project.selections.map((selection) => {
      const libraryItem = libraryById.get(selection.libraryItemId);
      return {
        ...selection,
        imageUrl: selection.imageUrl ?? libraryItem?.imageUrl,
        finish: selection.finish ?? libraryItem?.finish,
      };
    }),
  }));
}

export function loadAppState(): AppState {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {
      libraryItems: createInitialLibrary(),
      customCategories: [],
      projects: [],
      activeProjectId: null,
    };
  }

  try {
    const parsed = JSON.parse(stored) as AppState;
    const libraryItems = parsed.libraryItems?.length
      ? mergeLibraryImages(parsed.libraryItems)
      : createInitialLibrary();

    return {
      libraryItems,
      customCategories: parsed.customCategories ?? [],
      projects: enrichProjects(parsed.projects ?? [], libraryItems),
      activeProjectId: parsed.activeProjectId ?? null,
    };
  } catch {
    return {
      libraryItems: createInitialLibrary(),
      customCategories: [],
      projects: [],
      activeProjectId: null,
    };
  }
}

export function saveAppState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getAllCategories(state: AppState): string[] {
  const fromLibrary = new Set(state.libraryItems.map((item) => item.category));
  const fromCustom = state.customCategories;
  const fromDefault = defaultCategories;
  return [...new Set([...fromDefault, ...fromLibrary, ...fromCustom])].sort();
}
