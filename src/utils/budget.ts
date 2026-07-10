import type {
  BudgetSnapshot,
  ChangeOrder,
  Project,
  ProjectSelection,
  TimelineEvent,
} from "../types";
import { generateId } from "./format";

export function sumSelections(selections: ProjectSelection[]): number {
  return selections.reduce(
    (total, selection) => total + (selection.priceUsed * (selection.quantity || 1)),
    0
  );
}

export function groupByCategory(
  selections: ProjectSelection[],
): Record<string, number> {
  return selections.reduce<Record<string, number>>((accumulator, selection) => {
    accumulator[selection.category] =
      (accumulator[selection.category] ?? 0) + (selection.priceUsed * (selection.quantity || 1));
    return accumulator;
  }, {});
}

export function createBudgetSnapshot(
  project: Project,
  label: string,
  source: BudgetSnapshot["source"],
  changeOrderId?: string,
): BudgetSnapshot {
  return {
    id: generateId(),
    label,
    total: project.currentBudget,
    byCategory: groupByCategory(project.selections),
    recordedAt: new Date().toISOString(),
    source,
    changeOrderId,
  };
}

export function appendTimelineEvent(
  project: Project,
  event: Omit<TimelineEvent, "id" | "timestamp">,
): TimelineEvent {
  const timelineEvent: TimelineEvent = {
    ...event,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
  project.timeline.unshift(timelineEvent);
  return timelineEvent;
}

export function nextChangeOrderNumber(project: Project): number {
  if (project.changeOrders.length === 0) {
    return 1;
  }
  return Math.max(...project.changeOrders.map((order) => order.number)) + 1;
}

export function applyAcceptedChangeOrder(
  project: Project,
  changeOrder: ChangeOrder,
): void {
  project.currentBudget += changeOrder.totalDelta;
  project.budgetSnapshots.unshift(
    createBudgetSnapshot(
      project,
      `CO #${changeOrder.number} accepted`,
      "change_order",
      changeOrder.id,
    ),
  );
}

export function countBudgetChanges(project: Project): {
  totalChanges: number;
  fromInitial: number;
  acceptedChangeOrders: number;
} {
  const acceptedChangeOrders = project.changeOrders.filter(
    (order) => order.status === "accepted",
  ).length;
  const fromInitial = project.budgetSnapshots.length - 1;
  return {
    totalChanges: fromInitial + acceptedChangeOrders,
    fromInitial: Math.max(0, fromInitial),
    acceptedChangeOrders,
  };
}
