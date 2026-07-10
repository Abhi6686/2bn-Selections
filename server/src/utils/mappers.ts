import type { ApiLibraryItem, ApiProject, ApiProjectSelection, ApiUser } from "@2bn/shared";
export function mapUser(user: {
  _id: { toString(): string };
  email: string;
  name: string;
  role: ApiUser["role"];
  orgId?: { toString(): string } | null;
  status: string;
  passwordHash?: string;
  lastLoginAt?: Date | null;
}): ApiUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.orgId?.toString(),
    status: user.status,
    hasPassword: !!user.passwordHash,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
  };
}

export function mapProject(project: {
  _id: { toString(): string };
  orgId: { toString(): string };
  name: string;
  clientName: string;
  address?: string;
  status: ApiProject["status"];
  themeId?: { toString(): string };
  requiresDualApproval?: boolean;
  initialBudget: number;
  currentBudget: number;
  lastVisitedCategoryKey?: string;
  ownerClientId: { toString(): string };
  endUserIds?: Array<{ toString(): string }>;
  createdAt: Date;
  updatedAt: Date;
  proposalSigned?: boolean;
  proposalPdfUrl?: string;
  proposalSignedAt?: Date;
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
  unlockedCategoryKeys?: string[];
  projectLocked?: boolean;
  showPrices?: boolean;
  rooms?: Array<{
    id: string;
    name: string;
    icon?: string;
    sortOrder: number;
    slots: Array<{
      slotKey: string;
      slotLabel?: string;
      categoryKey: string;
      required: boolean;
      allowance?: number;
    }>;
  }>;
  decideLaterSlots?: string[];
}): ApiProject {

  return {
    id: project._id.toString(),
    orgId: project.orgId.toString(),
    name: project.name,
    clientName: project.clientName,
    address: project.address ?? "",
    status: project.status,
    themeId: project.themeId?.toString(),
    requiresDualApproval: project.requiresDualApproval ?? false,
    initialBudget: project.initialBudget,
    currentBudget: project.currentBudget,
    lastVisitedCategoryKey: project.lastVisitedCategoryKey ?? undefined,
    ownerClientId: project.ownerClientId.toString(),
    endUserIds: (project.endUserIds ?? []).map((id) => id.toString()),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    proposalSigned: project.proposalSigned ?? false,
    proposalPdfUrl: project.proposalPdfUrl ?? undefined,
    proposalSignedAt: project.proposalSignedAt ? project.proposalSignedAt.toISOString() : undefined,
    proposalSignedBy: project.proposalSignedBy,
    proposalSignatureType: project.proposalSignatureType,
    proposalTypedName: project.proposalTypedName,
    proposalSignatureIp: project.proposalSignatureIp,
    proposalSignatureGeo: project.proposalSignatureGeo ? {
      latitude: project.proposalSignatureGeo.latitude,
      longitude: project.proposalSignatureGeo.longitude,
    } : undefined,
    proposalEmailStatus: project.proposalEmailStatus ?? "pending",
    proposalEmailError: project.proposalEmailError ?? undefined,
    unlockedCategoryKeys: project.unlockedCategoryKeys ?? [],
    projectLocked: project.projectLocked ?? false,
    showPrices: project.showPrices ?? true,
    decideLaterSlots: project.decideLaterSlots ?? [],
    rooms: project.rooms ? project.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      sortOrder: r.sortOrder,
      slots: r.slots.map((s) => ({
        slotKey: s.slotKey,
        slotLabel: s.slotLabel,
        categoryKey: s.categoryKey,
        required: s.required,
        allowance: s.allowance,
      })),
    })) : undefined,
    deleted: (project as any).deleted ?? false,
    deletedAt: (project as any).deletedAt ? (project as any).deletedAt.toISOString() : undefined,
  };
}


export function mapLibraryItem(item: {
  _id: { toString(): string };
  orgId: { toString(): string };
  category: string;
  categoryKey: string;
  selectionSlot?: string;
  manufacturer: string;
  model: string;
  product: string;
  finish?: string;
  priceMin: number;
  priceMax: number;
  level: ApiLibraryItem["level"];
  imageUrl?: string;
  tagSlugs?: string[];
  vendor?: string;
  active: boolean;
  custom: boolean;
  recommendationScore?: number;
  specifications?: string;
  size?: string;
  dimensionsImageUrl?: string;
  isDeleted?: boolean;
  galleryImages?: string[];
}): ApiLibraryItem {
  return {
    id: item._id.toString(),
    orgId: item.orgId.toString(),
    category: item.category,
    categoryKey: item.categoryKey,
    selectionSlot: item.selectionSlot ?? undefined,
    manufacturer: item.manufacturer,
    model: item.model,
    product: item.product,
    finish: item.finish ?? undefined,
    priceMin: item.priceMin,
    priceMax: item.priceMax,
    level: item.level,
    imageUrl: item.imageUrl ?? undefined,
    tags: item.tagSlugs ?? [],
    vendor: item.vendor ?? undefined,
    active: item.active,
    custom: item.custom,
    recommendationScore: item.recommendationScore,
    specifications: item.specifications ?? undefined,
    size: item.size ?? undefined,
    dimensionsImageUrl: item.dimensionsImageUrl ?? undefined,
    isDeleted: item.isDeleted ?? false,
    galleryImages: item.galleryImages ?? [],
  };
}

export function mapProjectSelection(selection: {
  _id: { toString(): string };
  projectId: { toString(): string };
  categoryKey: string;
  state: ApiProjectSelection["state"];
  libraryItemId?: { toString(): string };
  manufacturer?: string;
  model?: string;
  product?: string;
  priceUsed?: number;
  level?: ApiProjectSelection["level"];
  finish?: string;
  imageUrl?: string;
  selectedBy?: { toString(): string };
  quantity?: number;
  slotLabel?: string;
  version: number;
  updatedAt: Date;
  discountPercent?: number;
  discountFlat?: number;
}): ApiProjectSelection {
  return {
    id: selection._id.toString(),
    projectId: selection.projectId.toString(),
    categoryKey: selection.categoryKey,
    state: selection.state,
    libraryItemId: selection.libraryItemId?.toString(),
    manufacturer: selection.manufacturer ?? undefined,
    model: selection.model ?? undefined,
    product: selection.product ?? undefined,
    priceUsed: selection.priceUsed ?? undefined,
    level: selection.level ?? undefined,
    finish: selection.finish ?? undefined,
    imageUrl: selection.imageUrl ?? undefined,
    selectedBy: selection.selectedBy?.toString(),
    quantity: selection.quantity,
    slotLabel: selection.slotLabel,
    version: selection.version,
    updatedAt: selection.updatedAt.toISOString(),
    discountPercent: selection.discountPercent ?? 0,
    discountFlat: selection.discountFlat ?? 0,
  };
}
