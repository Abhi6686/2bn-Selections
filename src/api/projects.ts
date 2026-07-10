import type {
  ApiBudgetSnapshot,
  ApiChangeOrder,
  ApiLibraryItem,
  ApiProject,
  ApiProjectMember,
  ApiProjectSelection,
  ApiTheme,
  ApiTimelineEvent,
  ApiSelectionTemplate,
  ApiRoomType,
} from "@2bn/shared";

import { apiFetch } from "./client";

export async function fetchProjects(): Promise<{ projects: ApiProject[] }> {
  return apiFetch("/api/projects");
}

export async function fetchProject(projectId: string): Promise<{ project: ApiProject }> {
  return apiFetch(`/api/projects/${projectId}`);
}

export async function createProject(input: {
  name: string;
  clientName: string;
  address?: string;
  themeId?: string;
  requiresDualApproval?: boolean;
  primaryHomeownerEmail?: string;
  secondaryHomeownerEmail?: string;
  rooms?: any[];
}): Promise<{ project: ApiProject }> {
  return apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchProjectSelections(
  projectId: string,
): Promise<{ selections: ApiProjectSelection[] }> {
  return apiFetch(`/api/projects/${projectId}/selections`);
}

export async function patchProjectSelection(
  projectId: string,
  body: {
    id?: string;
    categoryKey: string;
    state: "draft" | "confirmed" | "skipped";
    libraryItemId?: string;
    priceUsed?: number;
    quantity?: number;
    slotLabel?: string;
    version?: number;
  },
): Promise<{ selection: ApiProjectSelection }> {
  return apiFetch(`/api/projects/${projectId}/selections`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteProjectSelection(
  projectId: string,
  selectionId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/api/projects/${projectId}/selections/${selectionId}`, {
    method: "DELETE",
  });
}

export async function fetchLibrary(params?: {
  categoryKey?: string;
  level?: string;
  projectId?: string;
  showDeleted?: boolean;
}): Promise<{ items: ApiLibraryItem[] }> {
  const search = new URLSearchParams();
  if (params?.categoryKey) search.set("categoryKey", params.categoryKey);
  if (params?.level) search.set("level", params.level);
  if (params?.projectId) search.set("projectId", params.projectId);
  if (params?.showDeleted) search.set("showDeleted", "true");
  const query = search.toString();
  return apiFetch(`/api/library${query ? `?${query}` : ""}`);
}

export async function createLibraryItem(body: Partial<ApiLibraryItem>): Promise<{ item: ApiLibraryItem }> {
  return apiFetch("/api/library", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateLibraryItem(itemId: string, body: Partial<ApiLibraryItem>): Promise<{ item: ApiLibraryItem }> {
  return apiFetch(`/api/library/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteLibraryItem(itemId: string): Promise<{ deleted: boolean; permanent: boolean; item?: ApiLibraryItem }> {
  return apiFetch(`/api/library/${itemId}`, {
    method: "DELETE",
  });
}

export async function restoreLibraryItem(itemId: string): Promise<{ restored: boolean; item: ApiLibraryItem }> {
  return apiFetch(`/api/library/${itemId}/restore`, {
    method: "POST",
  });
}

export async function fetchThemes(): Promise<{ themes: ApiTheme[] }> {
  return apiFetch("/api/themes");
}

export async function fetchChangeOrders(
  projectId: string,
): Promise<{ changeOrders: ApiChangeOrder[] }> {
  return apiFetch(`/api/projects/${projectId}/change-orders`);
}

export async function createChangeOrder(
  projectId: string,
  body: {
    title: string;
    notes?: string;
    lines: Array<{
      category: string;
      description: string;
      previousAmount: number;
      newAmount: number;
    }>;
  },
): Promise<{ changeOrder: { id: string; number: number; status: string; totalDelta: number } }> {
  return apiFetch(`/api/projects/${projectId}/change-orders`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function releaseChangeOrder(
  projectId: string,
  changeOrderId: string,
): Promise<{ changeOrder: { id: string; status: string; pdfUrl?: string; approvalLink?: string } }> {
  return apiFetch(`/api/projects/${projectId}/change-orders/${changeOrderId}/release`, {
    method: "POST",
  });
}

export async function rejectChangeOrder(
  projectId: string,
  changeOrderId: string,
): Promise<{ ok: boolean; status: string }> {
  return apiFetch(`/api/projects/${projectId}/change-orders/${changeOrderId}/reject`, {
    method: "POST",
  });
}

export async function approveProjectChangeOrder(
  projectId: string,
  changeOrderId: string,
  body: {
    signatureType: "drawn" | "typed" | "both";
    typedName?: string;
    signatureImageBase64?: string;
    geoLatitude?: number;
    geoLongitude?: number;
    geoConsent?: boolean;
  }
): Promise<{ ok: boolean; status: string; approvalCount: number; requiredApprovals: number }> {
  return apiFetch(`/api/projects/${projectId}/change-orders/${changeOrderId}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyChangeOrder(input: {
  token: string;
  changeOrderId: string;
}): Promise<{
  changeOrder: {
    id: string;
    number: number;
    title: string;
    status: string;
    lines: Array<{
      category: string;
      description: string;
      previousAmount: number;
      newAmount: number;
      delta: number;
    }>;
    totalDelta: number;
    notes?: string;
    projectName: string;
    clientName: string;
    approvalCount: number;
    requiredApprovals: number;
  };
}> {
  return apiFetch(
    `/api/change-orders/verify?token=${encodeURIComponent(input.token)}&id=${encodeURIComponent(input.changeOrderId)}`,
  );
}

export async function approveChangeOrder(input: {
  token: string;
  changeOrderId: string;
  signatureType: "drawn" | "typed" | "both";
  typedName?: string;
  signatureImageBase64?: string;
  geoLatitude?: number;
  geoLongitude?: number;
  geoConsent?: boolean;
}): Promise<{
  ok: boolean;
  status: string;
  approvalCount: number;
  requiredApprovals: number;
}> {
  const { token, changeOrderId, ...body } = input;
  return apiFetch(
    `/api/change-orders/approve?token=${encodeURIComponent(token)}&id=${encodeURIComponent(changeOrderId)}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchTimeline(
  projectId: string,
): Promise<{ events: ApiTimelineEvent[] }> {
  return apiFetch(`/api/projects/${projectId}/timeline`);
}

export async function fetchBudgetSnapshots(
  projectId: string,
): Promise<{ snapshots: ApiBudgetSnapshot[] }> {
  return apiFetch(`/api/projects/${projectId}/budget-snapshots`);
}

export async function inviteHomeowner(
  projectId: string,
  email: string,
  role: "primary_homeowner" | "secondary_homeowner" = "primary_homeowner",
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/projects/${projectId}/invite`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function fetchProjectMembers(
  projectId: string,
): Promise<{ members: ApiProjectMember[] }> {
  return apiFetch(`/api/projects/${projectId}/members`);
}

export async function fetchMasterCategories(): Promise<{
  sections: any[];
  flatCategories: string[];
  styleThemes: string[];
}> {
  return apiFetch("/api/master-categories");
}

export async function uploadBase64(fileName: string, base64: string): Promise<{ url: string }> {
  return apiFetch("/api/upload", {
    method: "POST",
    body: JSON.stringify({ fileName, base64 }),
  });
}

export async function createCategorySection(body: { name: string; order?: number; groups?: any[] }): Promise<{ section: any }> {
  return apiFetch("/api/master-categories/sections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCategorySection(id: string, body: { name?: string; order?: number; groups?: any[] }): Promise<{ section: any }> {
  return apiFetch(`/api/master-categories/sections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteCategorySection(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/master-categories/sections/${id}`, {
    method: "DELETE",
  });
}

export async function fetchSelectionTemplates(): Promise<{ templates: ApiSelectionTemplate[] }> {
  return apiFetch("/api/selection-templates");
}

export async function fetchSelectionTemplate(templateId: string): Promise<{ template: ApiSelectionTemplate; libraryItems: ApiLibraryItem[] }> {
  return apiFetch(`/api/selection-templates/${templateId}`);
}

export async function createSelectionTemplate(body: Partial<ApiSelectionTemplate>): Promise<{ template: ApiSelectionTemplate }> {
  return apiFetch("/api/selection-templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSelectionTemplate(templateId: string, body: Partial<ApiSelectionTemplate>): Promise<{ template: ApiSelectionTemplate }> {
  return apiFetch(`/api/selection-templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSelectionTemplate(templateId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/selection-templates/${templateId}`, {
    method: "DELETE",
  });
}

export async function applySelectionTemplate(projectId: string, templateId: string, categoryKeys?: string[]): Promise<{ success: boolean; count: number }> {
  return apiFetch(`/api/projects/${projectId}/selections/apply-template`, {
    method: "POST",
    body: JSON.stringify({ templateId, categoryKeys }),
  });
}

export async function submitProjectProposal(
  projectId: string,
  body: {
    signatureType: "drawn" | "typed";
    typedName?: string;
    signatureImageBase64?: string;
    geo?: { latitude: number; longitude: number };
  },
): Promise<{ success: boolean; proposalPdfUrl: string; status: string }> {
  return apiFetch(`/api/projects/${projectId}/submit-proposal`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function submitProjectSelections(
  projectId: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/api/projects/${projectId}/submit-selections`, {
    method: "POST",
  });
}

export async function unlockProjectCategories(

  projectId: string,
  categoryKeys: string[],
): Promise<{ success: boolean; unlockedCategoryKeys: string[] }> {
  return apiFetch(`/api/projects/${projectId}/unlock-categories`, {
    method: "POST",
    body: JSON.stringify({ unlockedCategoryKeys: categoryKeys }),
  });
}

export async function toggleProjectLock(
  projectId: string,
  locked: boolean,
): Promise<{ success: boolean; projectLocked: boolean }> {
  return apiFetch(`/api/projects/${projectId}/toggle-lock`, {
    method: "POST",
    body: JSON.stringify({ locked }),
  });
}


export async function toggleDecideLater(
  projectId: string,
  body: { categoryKey: string; slotLabel: string; decideLater: boolean },
): Promise<{ success: boolean; decideLaterSlots: string[] }> {
  return apiFetch(`/api/projects/${projectId}/toggle-decide-later`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchProjectLastVisited(
  projectId: string,
  categoryKey: string,
): Promise<{ success: boolean }> {
  return apiFetch(`/api/projects/${projectId}/last-visited`, {
    method: "PATCH",
    body: JSON.stringify({ lastVisitedCategoryKey: categoryKey }),
  });
}

export async function fetchRoomTypes(): Promise<{ roomTypes: ApiRoomType[] }> {
  return apiFetch("/api/room-types");
}

export async function createRoomType(body: Partial<ApiRoomType>): Promise<{ roomType: ApiRoomType }> {
  return apiFetch("/api/room-types", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRoomType(id: string, body: Partial<ApiRoomType>): Promise<{ roomType: ApiRoomType }> {
  return apiFetch(`/api/room-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteRoomType(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/room-types/${id}`, {
    method: "DELETE",
  });
}

export async function fetchRecycleBin(): Promise<{ projects: ApiProject[] }> {
  return apiFetch("/api/projects/recycle-bin");
}

export async function deleteProject(projectId: string, permanent?: boolean): Promise<{ success: boolean; permanent: boolean }> {
  return apiFetch(`/api/projects/${projectId}${permanent ? "?permanent=true" : ""}`, {
    method: "DELETE",
  });
}

export async function restoreProject(projectId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/projects/${projectId}/restore`, {
    method: "POST",
  });
}

export async function updateProject(
  projectId: string,
  body: Partial<ApiProject>,
): Promise<{ project: ApiProject }> {
  return apiFetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}



