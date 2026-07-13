import { z } from "zod";
import {
  CHANGE_ORDER_STATUSES,
  PROJECT_STATUSES,
  SELECTION_LEVELS,
  SELECTION_STATES,
  TEMPLATE_VISIBILITIES,
  USER_ROLES,
} from "./enums.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

export const projectRoomSlotSchema = z.object({
  slotKey: z.string().min(1),
  slotLabel: z.string().optional(),
  categoryKey: z.string().min(1),
  required: z.boolean().default(true),
  allowance: z.number().optional(),
});

export const projectRoomSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0),
  slots: z.array(projectRoomSlotSchema),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().min(1).max(200),
  address: z.string().max(500).optional().default(""),
  themeId: z.string().optional(),
  requiresDualApproval: z.boolean().optional().default(false),
  primaryHomeownerEmail: z.string().email().optional(),
  secondaryHomeownerEmail: z.string().email().optional(),
  rooms: z.array(projectRoomSchema).optional(),
  showPrices: z.boolean().optional().default(true),
});

export const updateProjectSchema = createProjectSchema.partial();


export const patchSelectionSchema = z.object({
  id: z.string().optional(),
  categoryKey: z.string().min(1),
  state: z.enum(SELECTION_STATES),
  libraryItemId: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  product: z.string().optional(),
  priceUsed: z.number().optional(),
  level: z.enum(SELECTION_LEVELS).optional(),
  finish: z.string().optional(),
  imageUrl: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  slotLabel: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  discountPercent: z.number().nonnegative().optional(),
  discountFlat: z.number().nonnegative().optional(),
});

export const createChangeOrderSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(2000).optional().default(""),
  lines: z
    .array(
      z.object({
        category: z.string().min(1),
        description: z.string().min(1),
        previousAmount: z.number(),
        newAmount: z.number(),
      }),
    )
    .min(1),
});

export const approveChangeOrderSchema = z.object({
  signatureType: z.enum(["drawn", "typed", "both"]),
  typedName: z.string().min(1).max(200).optional(),
  signatureImageBase64: z.string().optional(),
  geoLatitude: z.number().optional(),
  geoLongitude: z.number().optional(),
  geoConsent: z.boolean().optional(),
});

export const inviteHomeownerSchema = z.object({
  email: z.string().email(),
  role: z.enum(["primary_homeowner", "secondary_homeowner"]).default("primary_homeowner"),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.enum(["admin", "project_manager"]),
  sendEmail: z.boolean().optional(),
  temporaryPassword: z.string().min(8).max(100).optional(),
});

export const createThemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tagWeights: z.record(z.string(), z.number()).optional(),
  active: z.boolean().optional().default(true),
});

export const createLibraryItemSchema = z.object({
  category: z.string().min(1),
  categoryKey: z.string().optional(),
  selectionSlot: z.string().optional(),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  product: z.string().min(1),
  finish: z.string().optional(),
  priceMin: z.number().nonnegative(),
  priceMax: z.number().nonnegative(),
  level: z.enum(SELECTION_LEVELS),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  vendor: z.string().optional(),
  specifications: z.string().optional(),
  size: z.string().optional(),
  dimensionsImageUrl: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

export const updateLibraryItemSchema = createLibraryItemSchema.partial();

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const changeOrderStatusSchema = z.enum(CHANGE_ORDER_STATUSES);
export const userRoleSchema = z.enum(USER_ROLES);

export const createSelectionTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  visibility: z.enum(TEMPLATE_VISIBILITIES).default("org"),
  selections: z.record(
    z.string(),
    z.array(
      z.object({
        libraryItemId: z.string(),
        quantity: z.number().int().positive().default(1),
        priceUsed: z.number().optional(),
        slotLabel: z.string().optional(),
      })
    )
  ),
  coveredSections: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
});

export const updateSelectionTemplateSchema = createSelectionTemplateSchema.partial();

export const roomTypeSlotSchema = z.object({
  categoryKey: z.string().min(1),
  slotLabel: z.string().min(1),
  required: z.boolean().default(true),
  allowance: z.number().optional(),
});

export const createRoomTypeSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().default("🏠"),
  slots: z.array(roomTypeSlotSchema).default([]),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial();


