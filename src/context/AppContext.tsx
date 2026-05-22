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
  }) => Project;
  updateProjectSelection: (
    projectId: string,
    category: string,
    libraryItem: LibraryItem,
    priceUsed: number,
  ) => void;
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
      category: string,
      libraryItem: LibraryItem,
      priceUsed: number,
    ) => {
      setState((previous) => {
        const projectIndex = previous.projects.findIndex(
          (project) => project.id === projectId,
        );
        if (projectIndex < 0) {
          return previous;
        }

        const project = { ...previous.projects[projectIndex] };
        const previousSelection = project.selections.find(
          (selection) => selection.category === category,
        );
        const previousAmount = previousSelection?.priceUsed ?? 0;

        const newSelection: ProjectSelection = {
          category,
          libraryItemId: libraryItem.id,
          manufacturer: libraryItem.manufacturer,
          model: libraryItem.model,
          product: libraryItem.product,
          priceUsed,
          level: libraryItem.level,
          imageUrl: libraryItem.imageUrl,
          finish: libraryItem.finish,
        };

        const otherSelections = project.selections.filter(
          (selection) => selection.category !== category,
        );
        project.selections = [...otherSelections, newSelection];
        const newBudget = sumSelections(project.selections);
        const budgetDelta = newBudget - project.currentBudget;

        if (budgetDelta !== 0) {
          project.currentBudget = newBudget;
          project.budgetSnapshots = [
            createBudgetSnapshot(project, "Selection change", "manual"),
            ...project.budgetSnapshots,
          ];

          appendTimelineEvent(project, {
            type: "selection_updated",
            title: `${category} updated`,
            description: `${libraryItem.manufacturer} ${libraryItem.model}`,
            amountBefore: previousAmount,
            amountAfter: priceUsed,
            category,
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
