import type {
  ChangeOrderStatus,
  ProjectMemberRole,
  ProjectStatus,
  SelectionLevel,
  SelectionState,
  UserRole,
} from "./enums.js";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId?: string;
  status: string;
  hasPassword?: boolean;
  lastLoginAt?: string;
}

export interface ApiProjectRoomSlot {
  slotKey: string;
  slotLabel?: string;
  categoryKey: string;
  required: boolean;
  allowance?: number;
}

export interface ApiProjectRoom {
  id: string;
  name: string;
  icon?: string;
  sortOrder: number;
  slots: ApiProjectRoomSlot[];
}

export interface ApiProject {
  id: string;
  orgId: string;
  name: string;
  clientName: string;
  address: string;
  status: ProjectStatus;
  themeId?: string;
  requiresDualApproval: boolean;
  initialBudget: number;
  currentBudget: number;
  lastVisitedCategoryKey?: string;
  ownerClientId: string;
  endUserIds: string[];
  createdAt: string;
  updatedAt: string;
  proposalSigned?: boolean;
  proposalPdfUrl?: string;
  unlockedCategoryKeys?: string[];
  projectLocked?: boolean;
  showPrices?: boolean;
  decideLaterSlots?: string[];
  rooms?: ApiProjectRoom[];
  deleted?: boolean;
  deletedAt?: string;
  proposalSignedAt?: string;
  proposalSignedBy?: string;
  proposalSignatureType?: string;
  proposalTypedName?: string;
  proposalSignatureIp?: string;
  proposalSignatureGeo?: {
    latitude?: number;
    longitude?: number;
  };
  proposalEmailStatus?: "pending" | "sending" | "sent" | "failed";
  proposalEmailError?: string;
}



export interface ApiLibraryItem {
  id: string;
  orgId: string;
  category: string;
  categoryKey: string;
  selectionSlot?: string;
  manufacturer: string;
  model: string;
  product: string;
  finish?: string;
  priceMin: number;
  priceMax: number;
  level: SelectionLevel;
  imageUrl?: string;
  tags: string[];
  vendor?: string;
  active: boolean;
  custom: boolean;
  recommendationScore?: number;
  specifications?: string;
  size?: string;
  dimensionsImageUrl?: string;
  isDeleted?: boolean;
  galleryImages?: string[];
}

export interface ApiProjectSelection {
  id: string;
  projectId: string;
  categoryKey: string;
  state: SelectionState;
  libraryItemId?: string;
  manufacturer?: string;
  model?: string;
  product?: string;
  priceUsed?: number;
  level?: SelectionLevel;
  finish?: string;
  imageUrl?: string;
  selectedBy?: string;
  quantity?: number;
  slotLabel?: string;
  version: number;
  updatedAt: string;
  discountPercent?: number;
  discountFlat?: number;
}

export interface ApiChangeOrderLine {
  category: string;
  description: string;
  previousAmount: number;
  newAmount: number;
  delta: number;
}

export interface ApiChangeOrder {
  id: string;
  projectId: string;
  number: number;
  title: string;
  status: ChangeOrderStatus;
  lines: ApiChangeOrderLine[];
  totalDelta: number;
  notes: string;
  pdfUrl?: string;
  createdAt: string;
  releasedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  approvalCount: number;
  requiredApprovals: number;
}

export interface ApiTheme {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  tagWeights: Record<string, number>;
  active: boolean;
}

export interface ApiTimelineEvent {
  id: string;
  projectId: string;
  type: string;
  title: string;
  description?: string;
  amountBefore?: number;
  amountAfter?: number;
  category?: string;
  changeOrderId?: string;
  createdAt: string;
}

export interface ApiBudgetSnapshot {
  id: string;
  projectId: string;
  label: string;
  total: number;
  byCategory: Record<string, number>;
  source: string;
  changeOrderId?: string;
  recordedAt: string;
}

export interface ApiProjectMember {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  name: string;
  role: ProjectMemberRole;
  canSelect: boolean;
  canApproveChangeOrders: boolean;
  invitedAt: string;
  acceptedAt?: string;
}

export interface ApiMasterCategorySection {
  order: number;
  name: string;
  slug: string;
  groups: Array<{
    name: string;
    slug: string;
    categoryKey: string;
    items: string[];
    subgroups?: Array<{
      name: string;
      slug: string;
      categoryKey: string;
      items: string[];
    }>;
  }>;
}

/** Multi-select: a single selection entry with optional quantity */
export interface ApiMultiSelection {
  id: string;
  projectId: string;
  categoryKey: string;
  state: SelectionState;
  libraryItemId?: string;
  manufacturer?: string;
  model?: string;
  product?: string;
  priceUsed?: number;
  level?: SelectionLevel;
  finish?: string;
  imageUrl?: string;
  selectedBy?: string;
  quantity: number;
  slotLabel?: string;
  version: number;
  updatedAt: string;
  discountPercent?: number;
  discountFlat?: number;
}

/** Selection Template — pre-built selection profiles */
export interface ApiSelectionTemplate {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  visibility: "org" | "project" | "personal";
  createdBy: string;
  createdByName?: string;
  /** Map of categoryKey → array of pre-selected items */
  selections: Record<
    string,
    Array<{
      libraryItemId: string;
      quantity: number;
      priceUsed?: number;
      slotLabel?: string;
    }>
  >;
  /** Which sections/groups this template covers (slugs) */
  coveredSections: string[];
  /** Tags for filtering (e.g. "Modern", "Budget-friendly") */
  tags: string[];
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRoomTypeSlot {
  categoryKey: string;
  slotLabel: string;
  required: boolean;
  allowance?: number;
}

export interface ApiRoomType {
  id: string;
  orgId: string;
  name: string;
  icon: string;
  description?: string;
  imageUrl?: string;
  slots: ApiRoomTypeSlot[];
  createdAt: string;
  updatedAt: string;
}



