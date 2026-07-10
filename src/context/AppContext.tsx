import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { changeOrderMinimum } from "../store/library";
import { getAllCategories, loadAppState, saveAppState } from "../store/storage";
import type {
  AppState,
  ChangeOrder,
  ChangeOrderLine,
  ChangeOrderStatus,
  LibraryItem,
  Project,
  ProjectSelection,
  SelectionLevel,
} from "../types";
import {
  appendTimelineEvent,
  applyAcceptedChangeOrder,
  createBudgetSnapshot,
  nextChangeOrderNumber,
  sumSelections,
} from "../utils/budget";
import { generateId } from "../utils/format";
import { deriveDefaultLevel } from "../utils/project";

interface AppContextValue {
  state: AppState;
  categories: string[];
  activeProject: Project | null;
  setActiveProjectId: (projectId: string | null) => void;
  addLibraryItem: (item: Omit<LibraryItem, "id" | "custom"> & { imageUrl?: string }) => void;
  addCategory: (categoryName: string) => void;
  createProject: (input: {
    name: string;
    clientName: string;
    address: string;
    selections: ProjectSelection[];
    rooms?: any[];
  }) => Project;
  updateProjectSelection: (
    projectId: string,
    categoryKey: string,
    updates: {
      id?: string;
      state?: "draft" | "confirmed" | "skipped";
      libraryItemId?: string;
      priceUsed?: number;
      quantity?: number;
      slotLabel?: string;
      manufacturer?: string;
      model?: string;
      product?: string;
      level?: SelectionLevel;
      imageUrl?: string;
      finish?: string;
      discountPercent?: number;
      discountFlat?: number;
    },
  ) => void;
  deleteProjectSelection: (projectId: string, selectionId: string) => void;
  submitProjectProposal: (
    projectId: string,
    signatureData: {
      signatureType: "typed" | "drawn";
      typedName?: string;
      signatureImageBase64?: string;
    },
  ) => void;
  submitProjectSelections: (projectId: string) => void;
  unlockProjectCategories: (projectId: string, categoryKeys: string[]) => void;
  toggleProjectSelectionsLock: (projectId: string, locked: boolean) => void;
  toggleDecideLater: (
    projectId: string,
    categoryKey: string,
    slotLabel: string,
    decideLater: boolean,
  ) => void;
  updateProjectLastVisited: (projectId: string, lastVisitedCategoryKey: string) => void;
  createChangeOrder: (
    projectId: string,
    title: string,
    lines: Omit<ChangeOrderLine, "id" | "delta">[],
    notes: string,
  ) => ChangeOrder | null;
  updateChangeOrderStatus: (
    projectId: string,
    changeOrderId: string,
    status: ChangeOrderStatus,
  ) => void;
  resetDemoData: () => void;
  changeOrderMinimum: number;
}

const AppContext = createContext<AppContextValue | null>(null);

function persist(state: AppState): void {
  saveAppState(state);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadAppState());

  useEffect(() => {
    persist(state);
  }, [state]);

  const categories = useMemo(() => getAllCategories(state), [state]);

  const activeProject = useMemo(
    () =>
      state.projects.find((project) => project.id === state.activeProjectId) ??
      null,
    [state.projects, state.activeProjectId],
  );

  const setActiveProjectId = useCallback((projectId: string | null) => {
    setState((previous) => ({ ...previous, activeProjectId: projectId }));
  }, []);

  const addLibraryItem = useCallback(
    (item: Omit<LibraryItem, "id" | "custom">) => {
      const libraryItem: LibraryItem = {
        ...item,
        id: `custom-${generateId()}`,
        custom: true,
      };
      setState((previous) => ({
        ...previous,
        libraryItems: [...previous.libraryItems, libraryItem],
      }));
    },
    [],
  );

  const addCategory = useCallback((categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      return;
    }
    setState((previous) => {
      if (previous.customCategories.includes(trimmed)) {
        return previous;
      }
      return {
        ...previous,
        customCategories: [...previous.customCategories, trimmed],
      };
    });
  }, []);

  const createProject = useCallback(
    (input: {
      name: string;
      clientName: string;
      address: string;
      selections: ProjectSelection[];
      rooms?: any[];
    }): Project => {
      const now = new Date().toISOString();
      const initialBudget = sumSelections(input.selections);
      const defaultLevel = deriveDefaultLevel(input.selections);
      const levelsUsed = new Set(input.selections.map((selection) => selection.level));
      const project: Project = {
        id: generateId(),
        name: input.name,
        clientName: input.clientName,
        address: input.address,
        defaultLevel,
        selections: input.selections,
        initialBudget,
        currentBudget: initialBudget,
        budgetSnapshots: [],
        changeOrders: [],
        timeline: [],
        createdAt: now,
        updatedAt: now,
        rooms: input.rooms,
      };

      const initialSnapshot = createBudgetSnapshot(
        project,
        "Initial selections budget",
        "initial",
      );
      project.budgetSnapshots = [initialSnapshot];

      appendTimelineEvent(project, {
        type: "project_created",
        title: "Project created",
        description: `${input.name} — ${input.clientName}`,
      });

      appendTimelineEvent(project, {
        type: "initial_budget_set",
        title: "Initial budget recorded",
        description:
          levelsUsed.size > 1
            ? "Initial selections across Level 1, 2, and 3"
            : `Level ${defaultLevel} package selections`,
        amountBefore: 0,
        amountAfter: initialBudget,
      });

      setState((previous) => ({
        ...previous,
        projects: [project, ...previous.projects],
        activeProjectId: project.id,
      }));

      return project;
    },
    [],
  );

  const updateProjectSelection = useCallback(
    (
      projectId: string,
      categoryKey: string,
      updates: {
        id?: string;
        state?: "draft" | "confirmed" | "skipped";
        libraryItemId?: string;
        priceUsed?: number;
        quantity?: number;
        slotLabel?: string;
        manufacturer?: string;
        model?: string;
        product?: string;
        level?: SelectionLevel;
        imageUrl?: string;
        finish?: string;
        discountPercent?: number;
        discountFlat?: number;
      },
    ) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex(
          (project) => project.id === projectId,
        );
        if (projectIndex < 0) {
          return previous;
        }

        const project = { ...previous.projects[projectIndex] };
        const selections = [...project.selections];
        
        let selectionIndex = -1;
        if (updates.id) {
          selectionIndex = selections.findIndex((s) => s.id === updates.id);
        } else {
          // If no ID is provided, look for one in categoryKey with matching slotLabel (or empty)
          const targetSlotLabel = updates.slotLabel || "";
          selectionIndex = selections.findIndex(
            (s) => s.category === categoryKey && (s.slotLabel || "") === targetSlotLabel && s.state !== "skipped"
          );
        }

        const previousSelection = selectionIndex >= 0 ? selections[selectionIndex] : null;
        const previousAmount = previousSelection
          ? (previousSelection.priceUsed * (previousSelection.quantity || 1))
          : 0;

        let finalSelections = selections;

        if (updates.state === "skipped") {
          // Skip category: remove all selections in this category and add one skipped selection
          const otherSelections = selections.filter((s) => s.category !== categoryKey);
          const skippedEntry: ProjectSelection = {
            id: updates.id || `sel-${generateId()}`,
            category: categoryKey,
            libraryItemId: "",
            manufacturer: "",
            model: "",
            product: "",
            priceUsed: 0,
            level: "1",
            quantity: 0,
            slotLabel: "",
            state: "skipped",
          };
          finalSelections = [...otherSelections, skippedEntry];
        } else {
          // Confirming or updating selection
          // First, remove any skipped entry for this category
          const filteredSelections = selections.filter(
            (s) => !(s.category === categoryKey && s.state === "skipped")
          );

          let libraryData = {};
          if (updates.libraryItemId) {
            const libraryItem = previous.libraryItems.find(
              (item) => item.id === updates.libraryItemId
            );
            if (libraryItem) {
              libraryData = {
                libraryItemId: libraryItem.id,
                manufacturer: libraryItem.manufacturer,
                model: libraryItem.model,
                product: libraryItem.product,
                level: libraryItem.level,
                finish: libraryItem.finish || "",
                imageUrl: libraryItem.imageUrl,
                priceUsed: updates.priceUsed ?? libraryItem.priceMin,
              };
            }
          }

          if (previousSelection && previousSelection.state !== "skipped") {
            // Update existing
            const updatedSelection: ProjectSelection = {
              ...previousSelection,
              ...libraryData,
              ...(updates.state !== undefined ? { state: updates.state } : {}),
              ...(updates.priceUsed !== undefined ? { priceUsed: updates.priceUsed } : {}),
              ...(updates.manufacturer !== undefined ? { manufacturer: updates.manufacturer } : {}),
              ...(updates.model !== undefined ? { model: updates.model } : {}),
              ...(updates.product !== undefined ? { product: updates.product } : {}),
              ...(updates.level !== undefined ? { level: updates.level } : {}),
              ...(updates.finish !== undefined ? { finish: updates.finish } : {}),
              ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {}),
              ...(updates.quantity !== undefined ? { quantity: updates.quantity } : {}),
              ...(updates.slotLabel !== undefined ? { slotLabel: updates.slotLabel } : {}),
              ...(updates.discountPercent !== undefined ? { discountPercent: updates.discountPercent } : {}),
              ...(updates.discountFlat !== undefined ? { discountFlat: updates.discountFlat } : {}),
            };
            const idx = filteredSelections.findIndex((s) => s.id === previousSelection.id);
            if (idx >= 0) {
              filteredSelections[idx] = updatedSelection;
            } else {
              filteredSelections.push(updatedSelection);
            }
          } else {
            // Create new selection entry
            const newSelection: ProjectSelection = {
              id: updates.id || `sel-${generateId()}`,
              category: categoryKey,
              libraryItemId: updates.libraryItemId || "",
              manufacturer: updates.manufacturer || "",
              model: updates.model || "",
              product: updates.product || "",
              priceUsed: updates.priceUsed || 0,
              level: updates.level || "1",
              finish: updates.finish || "",
              imageUrl: updates.imageUrl,
              quantity: updates.quantity ?? 1,
              slotLabel: updates.slotLabel || "",
              state: updates.state || "confirmed",
              discountPercent: updates.discountPercent || 0,
              discountFlat: updates.discountFlat || 0,
              ...libraryData,
            };
            filteredSelections.push(newSelection);
          }
          finalSelections = filteredSelections;
        }

        project.selections = finalSelections;
        const newBudget = sumSelections(project.selections);
        const budgetDelta = newBudget - project.currentBudget;

        if (budgetDelta !== 0) {
          project.currentBudget = newBudget;
          project.budgetSnapshots = [
            createBudgetSnapshot(project, `Selection change: ${categoryKey}`, "manual"),
            ...project.budgetSnapshots,
          ];

          // Calculate new amount for timeline event
          const newSelectionEntry = project.selections.find(
            (s) => s.category === categoryKey && s.state !== "skipped"
          );
          const newAmount = newSelectionEntry
            ? (newSelectionEntry.priceUsed * (newSelectionEntry.quantity || 1))
            : 0;

          appendTimelineEvent(project, {
            type: "selection_updated",
            title: `${categoryKey} updated`,
            description: newSelectionEntry
              ? `${newSelectionEntry.manufacturer} ${newSelectionEntry.model}`
              : `${categoryKey} updated`,
            amountBefore: previousAmount,
            amountAfter: newAmount,
            category: categoryKey,
          });

          if (Math.abs(budgetDelta) >= changeOrderMinimum) {
            appendTimelineEvent(project, {
              type: "notification",
              title: "Budget change alert",
              description: `Total budget changed by ${budgetDelta >= 0 ? "+" : ""}${budgetDelta.toFixed(2)}. Consider issuing a change order (minimum ${changeOrderMinimum}).`,
              amountBefore: project.currentBudget - budgetDelta,
              amountAfter: project.currentBudget,
            });
          }
        }

        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const deleteProjectSelection = useCallback(
    (projectId: string, selectionId: string) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex(
          (project) => project.id === projectId,
        );
        if (projectIndex < 0) {
          return previous;
        }

        const project = { ...previous.projects[projectIndex] };
        const selectionToDelete = project.selections.find((s) => s.id === selectionId);
        if (!selectionToDelete) {
          return previous;
        }

        const categoryKey = selectionToDelete.category;
        project.selections = project.selections.filter((s) => s.id !== selectionId);
        
        const newBudget = sumSelections(project.selections);
        project.currentBudget = newBudget;
        project.budgetSnapshots = [
          createBudgetSnapshot(project, `Removed selection slot from ${categoryKey}`, "manual"),
          ...project.budgetSnapshots,
        ];

        appendTimelineEvent(project, {
          type: "selection_updated",
          title: `${categoryKey} slot removed`,
          description: `Removed a selection slot from ${categoryKey}`,
          category: categoryKey,
        });

        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const createChangeOrder = useCallback(
    (
      projectId: string,
      title: string,
      lines: Omit<ChangeOrderLine, "id" | "delta">[],
      notes: string,
    ): ChangeOrder | null => {
      let createdOrder: ChangeOrder | null = null;

      setState((previous) => {
        const projectIndex = previous.projects.findIndex(
          (project) => project.id === projectId,
        );
        if (projectIndex < 0) {
          return previous;
        }

        const project = { ...previous.projects[projectIndex] };
        const orderLines: ChangeOrderLine[] = lines.map((line) => ({
          ...line,
          id: generateId(),
          delta: line.newAmount - line.previousAmount,
        }));
        const totalDelta = orderLines.reduce((sum, line) => sum + line.delta, 0);

        if (Math.abs(totalDelta) < changeOrderMinimum) {
          return previous;
        }

        const changeOrder: ChangeOrder = {
          id: generateId(),
          number: nextChangeOrderNumber(project),
          title,
          status: "draft",
          lines: orderLines,
          totalDelta,
          notes,
          createdAt: new Date().toISOString(),
        };

        project.changeOrders = [changeOrder, ...project.changeOrders];
        appendTimelineEvent(project, {
          type: "change_order_created",
          title: `Change Order #${changeOrder.number} drafted`,
          description: title,
          amountAfter: totalDelta,
          changeOrderId: changeOrder.id,
        });

        project.updatedAt = new Date().toISOString();
        createdOrder = changeOrder;

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });

      return createdOrder;
    },
    [],
  );

  const updateChangeOrderStatus = useCallback(
    (projectId: string, changeOrderId: string, status: ChangeOrderStatus) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex(
          (project) => project.id === projectId,
        );
        if (projectIndex < 0) {
          return previous;
        }

        const project = { ...previous.projects[projectIndex] };
        const orderIndex = project.changeOrders.findIndex(
          (order) => order.id === changeOrderId,
        );
        if (orderIndex < 0) {
          return previous;
        }

        const changeOrder = { ...project.changeOrders[orderIndex] };
        const now = new Date().toISOString();
        const previousStatus = changeOrder.status;
        changeOrder.status = status;

        if (status === "released" && previousStatus === "draft") {
          changeOrder.releasedAt = now;
          appendTimelineEvent(project, {
            type: "change_order_released",
            title: `CO #${changeOrder.number} released`,
            description: changeOrder.title,
            amountAfter: changeOrder.totalDelta,
            changeOrderId: changeOrder.id,
          });
        }

        if (status === "accepted" && previousStatus !== "accepted") {
          changeOrder.acceptedAt = now;
          applyAcceptedChangeOrder(project, changeOrder);
          appendTimelineEvent(project, {
            type: "change_order_accepted",
            title: `CO #${changeOrder.number} accepted`,
            description: changeOrder.title,
            amountBefore: project.currentBudget - changeOrder.totalDelta,
            amountAfter: project.currentBudget,
            changeOrderId: changeOrder.id,
          });
        }

        if (status === "rejected") {
          changeOrder.rejectedAt = now;
          appendTimelineEvent(project, {
            type: "change_order_rejected",
            title: `CO #${changeOrder.number} rejected`,
            description: changeOrder.title,
            changeOrderId: changeOrder.id,
          });
        }

        project.changeOrders[orderIndex] = changeOrder;
        project.updatedAt = now;

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const submitProjectProposal = useCallback(
    (
      projectId: string,
      signatureData: {
        signatureType: "typed" | "drawn";
        typedName?: string;
        signatureImageBase64?: string;
      },
    ) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex((p) => p.id === projectId);
        if (projectIndex < 0) return previous;

        const project = { ...previous.projects[projectIndex] };
        project.proposalSigned = true;
        project.proposalPdfUrl = `/uploads/pdfs/proposal-${projectId}-1.pdf`;
        project.unlockedCategoryKeys = [];

        appendTimelineEvent(project, {
          type: "notification",
          title: "Proposal Finalized & Signed",
          description: `Selections proposal signed by client via ${
            signatureData.signatureType === "typed"
              ? `typed name "${signatureData.typedName}"`
              : "drawn signature"
          }.`,
        });

        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const submitProjectSelections = useCallback(
    (projectId: string) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex((p) => p.id === projectId);
        if (projectIndex < 0) return previous;

        const project = { ...previous.projects[projectIndex] };
        project.status = "selections_submitted";

        appendTimelineEvent(project, {
          type: "selections_submitted",
          title: "Selections Sheet Completed & Submitted",
          description: "Selections submitted by homeowner. Awaiting contract signature.",
        });

        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const unlockProjectCategories = useCallback(
    (projectId: string, categoryKeys: string[]) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex((p) => p.id === projectId);
        if (projectIndex < 0) return previous;

        const project = { ...previous.projects[projectIndex] };
        project.unlockedCategoryKeys = categoryKeys;

        appendTimelineEvent(project, {
          type: "notification",
          title: "Category access updated",
          description: `Category locks adjusted. Unlocked: ${categoryKeys
            .map((k) => k.split(" - ").pop())
            .join(", ") || "none"}.`,
        });

        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const toggleProjectSelectionsLock = useCallback(
    (projectId: string, locked: boolean) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex((p) => p.id === projectId);
        if (projectIndex < 0) return previous;

        const project = { ...previous.projects[projectIndex] };
        project.projectLocked = locked;

        appendTimelineEvent(project, {
          type: "notification",
          title: locked ? "Project Selections Locked" : "Project Selections Unlocked",
          description: locked
            ? "The project selections sheet was locked by the Project Manager."
            : "The project selections sheet was unlocked by the Project Manager.",
        });

        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const toggleDecideLater = useCallback(
    (
      projectId: string,
      categoryKey: string,
      slotLabel: string,
      decideLater: boolean,
    ) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex((p) => p.id === projectId);
        if (projectIndex < 0) return previous;

        const project = { ...previous.projects[projectIndex] };
        const slotKey = `${categoryKey}::${slotLabel}`;
        let list = project.decideLaterSlots || [];

        if (decideLater) {
          if (!list.includes(slotKey)) {
            list = [...list, slotKey];
          }
        } else {
          list = list.filter((item) => item !== slotKey);
        }

        project.decideLaterSlots = list;
        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const updateProjectLastVisited = useCallback(
    (projectId: string, lastVisitedCategoryKey: string) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex((p) => p.id === projectId);
        if (projectIndex < 0) return previous;

        const project = { ...previous.projects[projectIndex], lastVisitedCategoryKey };
        project.updatedAt = new Date().toISOString();

        const projects = [...previous.projects];
        projects[projectIndex] = project;
        return { ...previous, projects };
      });
    },
    [],
  );

  const resetDemoData = useCallback(() => {
    const fresh = loadAppState();
    fresh.projects = [];
    fresh.activeProjectId = null;
    setState(fresh);
    saveAppState(fresh);
  }, []);

  const value: AppContextValue = {
    state,
    categories,
    activeProject,
    setActiveProjectId,
    addLibraryItem,
    addCategory,
    createProject,
    updateProjectSelection,
    deleteProjectSelection,
    submitProjectProposal,
    submitProjectSelections,
    unlockProjectCategories,
    toggleProjectSelectionsLock,
    toggleDecideLater,
    updateProjectLastVisited,
    createChangeOrder,
    updateChangeOrderStatus,
    resetDemoData,
    changeOrderMinimum,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
