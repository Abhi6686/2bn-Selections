// Prototype types (localStorage SPA). V2 MongoDB shapes: docs/V2_BACKEND_PLAN.md

export type SelectionLevel = "1" | "2" | "3";

export type ChangeOrderStatus = "draft" | "released" | "accepted" | "rejected";

export type TimelineEventType =
  | "project_created"
  | "initial_budget_set"
  | "selection_updated"
  | "change_order_created"
  | "change_order_released"
  | "change_order_accepted"
  | "change_order_rejected"
  | "selections_submitted"
  | "notification";

export interface LibraryItem {
  id: string;
  level: SelectionLevel;
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
  custom?: boolean;
  galleryImages?: string[];
  tags?: string[];
  specifications?: string;
  size?: string;
  vendor?: string;
}

export interface ProjectSelection {
  id: string;
  category: string; // maps to categoryKey
  libraryItemId: string;
  manufacturer: string;
  model: string;
  product: string;
  priceUsed: number;
  level: SelectionLevel;
  imageUrl?: string;
  finish?: string;
  quantity: number;
  slotLabel?: string;
  state?: "draft" | "confirmed" | "skipped";
  discountPercent?: number;
  discountFlat?: number;
}

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

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  amountBefore?: number;
  amountAfter?: number;
  category?: string;
  changeOrderId?: string;
  timestamp: string;
}

export interface BudgetSnapshot {
  id: string;
  label: string;
  total: number;
  byCategory: Record<string, number>;
  source: "initial" | "change_order" | "manual" | "selection_change";
  changeOrderId?: string;
  recordedAt: string;
}

export interface ProjectRoomSlot {
  slotKey: string;
  slotLabel?: string;
  categoryKey: string;
  required: boolean;
  allowance?: number;
}

export interface ProjectRoom {
  id: string;
  name: string;
  icon?: string;
  sortOrder: number;
  slots: ProjectRoomSlot[];
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
  proposalSigned?: boolean;
  proposalPdfUrl?: string;
  unlockedCategoryKeys?: string[];
  projectLocked?: boolean;
  decideLaterSlots?: string[];
  lastVisitedCategoryKey?: string;
  status?: "draft" | "active" | "selections_in_progress" | "selections_submitted" | "selections_complete" | "closed";
  rooms?: ProjectRoom[];
}


export interface AppState {
  libraryItems: LibraryItem[];
  customCategories: string[];
  projects: Project[];
  activeProjectId: string | null;
}

export const LEVEL_LABELS: Record<SelectionLevel, string> = {
  "1": "Level 1 — Value",
  "2": "Level 2 — Mid",
  "3": "Level 3 — Premium",
};

export const LEVEL_COLORS: Record<SelectionLevel, string> = {
  "1": "#3d6b5c",
  "2": "#9a6b14",
  "3": "#7a2d42",
};

export const PARENT_CATEGORIES = [
  "Exterior Selections",
  "Interior Finishes",
  "Kitchen Selections",
  "Bathroom Selections",
  "Electrical & Technology",
  "HVAC & Comfort",
  "Fireplace Selections",
  "Storage & Organization",
  "Laundry Room",
  "Specialty Items",
  "Final Detail Items",
  "Project-Wide Details",
  "Ordering & Tracking",
] as const;

export type ParentCategory = (typeof PARENT_CATEGORIES)[number];
