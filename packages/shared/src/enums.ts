export const USER_ROLES = ["admin", "project_manager", "client", "end_user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SELECTION_LEVELS = ["1", "2", "3"] as const;
export type SelectionLevel = (typeof SELECTION_LEVELS)[number];

export const PROJECT_STATUSES = [
  "draft",
  "active",
  "selections_in_progress",
  "selections_submitted",
  "selections_complete",
  "closed",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const SELECTION_STATES = ["draft", "confirmed", "skipped"] as const;
export type SelectionState = (typeof SELECTION_STATES)[number];

export const CHANGE_ORDER_STATUSES = [
  "draft",
  "released",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export const MEMBER_ROLES = ["primary_homeowner", "secondary_homeowner"] as const;
export type ProjectMemberRole = (typeof MEMBER_ROLES)[number];

export const TEMPLATE_VISIBILITIES = ["org", "project", "personal"] as const;
export type TemplateVisibility = (typeof TEMPLATE_VISIBILITIES)[number];
