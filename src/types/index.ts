export type SelectionLevel = "1" | "2" | "3";

export interface LibraryItem {
  id: string;
  category: string;
  manufacturer: string;
  model: string;
  product: string;
  finish: string;
  priceMin: number;
  priceMax: number;
  level: SelectionLevel;
  group?: string;
  optional?: boolean;
  custom?: boolean;
  imageUrl?: string;
}

export interface ProjectSelection {
  category: string;
  libraryItemId: string;
  manufacturer: string;
  model: string;
  product: string;
  priceUsed: number;
  level: SelectionLevel;
  imageUrl?: string;
  finish?: string;
}

export type ChangeOrderStatus =
  | "draft"
  | "released"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface ChangeOrderLine {
  id: string;
  category: string;
  description: string;
  previousAmount: number;
  newAmount: number;
  delta: number;
}

export interface ChangeOrder {
  id: string;
  number: number;
  title: string;
  status: ChangeOrderStatus;
  lines: ChangeOrderLine[];
  totalDelta: number;
  notes: string;
  createdAt: string;
  releasedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
}

export type TimelineEventType =
  | "project_created"
  | "initial_budget_set"
  | "selection_updated"
  | "change_order_created"
  | "change_order_released"
  | "change_order_accepted"
  | "change_order_rejected"
  | "budget_adjusted"
  | "notification";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description: string;
  amountBefore?: number;
  amountAfter?: number;
  category?: string;
  changeOrderId?: string;
  metadata?: Record<string, string | number>;
}

export interface BudgetSnapshot {
  id: string;
  label: string;
  total: number;
  byCategory: Record<string, number>;
  recordedAt: string;
  source: "initial" | "change_order" | "manual";
  changeOrderId?: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  address: string;
  defaultLevel: SelectionLevel;
  selections: ProjectSelection[];
  initialBudget: number;
  currentBudget: number;
  budgetSnapshots: BudgetSnapshot[];
  changeOrders: ChangeOrder[];
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  libraryItems: LibraryItem[];
  customCategories: string[];
  projects: Project[];
  activeProjectId: string | null;
}
