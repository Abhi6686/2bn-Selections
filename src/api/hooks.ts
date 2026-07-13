import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as projectsApi from "./projects";
import * as usersApi from "./users";
import * as settingsApi from "./settings";
import type { ApiLibraryItem, ApiSelectionTemplate, ApiRoomType } from "@2bn/shared";




export const queryKeys = {
  me: ["auth", "me"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  selections: (id: string) => ["projects", id, "selections"] as const,
  library: (params?: string) => ["library", params ?? "all"] as const,
  themes: ["themes"] as const,
  changeOrders: (id: string) => ["projects", id, "change-orders"] as const,
  timeline: (id: string) => ["projects", id, "timeline"] as const,
  budgetSnapshots: (id: string) => ["projects", id, "budget-snapshots"] as const,
  masterCategories: ["master-categories"] as const,
  selectionTemplates: ["selection-templates"] as const,
  selectionTemplate: (id: string) => ["selection-templates", id] as const,
  roomTypes: ["room-types"] as const,
  users: ["users"] as const,
  activities: ["users", "activities"] as const,
  settings: ["settings"] as const,
};


export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.fetchProjects().then((response) => response.projects),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ""),
    queryFn: () => projectsApi.fetchProject(projectId!).then((response) => response.project),
    enabled: Boolean(projectId),
  });
}

export function useProjectSelections(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.selections(projectId ?? ""),
    queryFn: () =>
      projectsApi.fetchProjectSelections(projectId!).then((response) => response.selections),
    enabled: Boolean(projectId),
  });
}

export function useLibrary(
  params?: { categoryKey?: string; projectId?: string; showDeleted?: boolean } | string,
  projectIdParam?: string
) {
  let categoryKey: string | undefined;
  let projectId: string | undefined;
  let showDeleted: boolean | undefined;

  if (typeof params === "string") {
    categoryKey = params;
    projectId = projectIdParam;
  } else if (params) {
    categoryKey = params.categoryKey;
    projectId = params.projectId;
    showDeleted = params.showDeleted;
  }

  const key = `${categoryKey ?? "all"}-${projectId ?? ""}-${showDeleted ? "deleted" : "active"}`;
  return useQuery({
    queryKey: queryKeys.library(key),
    queryFn: () =>
      projectsApi
        .fetchLibrary({ categoryKey, projectId, showDeleted })
        .then((response) => response.items),
  });
}

export function useCreateLibraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createLibraryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useUpdateLibraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; body: Partial<ApiLibraryItem> }) =>
      projectsApi.updateLibraryItem(variables.id, variables.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useDeleteLibraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.deleteLibraryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useRestoreLibraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.restoreLibraryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useThemes() {
  return useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => projectsApi.fetchThemes().then((response) => response.themes),
  });
}

export function useChangeOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.changeOrders(projectId ?? ""),
    queryFn: () =>
      projectsApi.fetchChangeOrders(projectId!).then((response) => response.changeOrders),
    enabled: Boolean(projectId),
  });
}

export function useTimeline(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.timeline(projectId ?? ""),
    queryFn: () => projectsApi.fetchTimeline(projectId!).then((response) => response.events),
    enabled: Boolean(projectId),
  });
}

export function useBudgetSnapshots(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.budgetSnapshots(projectId ?? ""),
    queryFn: () =>
      projectsApi.fetchBudgetSnapshots(projectId!).then((response) => response.snapshots),
    enabled: Boolean(projectId),
  });
}

export function usePatchSelection(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.patchProjectSelection.bind(null, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.selections(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetSnapshots(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useMasterCategories() {
  return useQuery({
    queryKey: queryKeys.masterCategories,
    queryFn: () => projectsApi.fetchMasterCategories(),
  });
}

export function useCreateCategorySection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createCategorySection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masterCategories });
    },
  });
}

export function useUpdateCategorySection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; body: { name?: string; order?: number; groups?: any[] } }) =>
      projectsApi.updateCategorySection(variables.id, variables.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masterCategories });
    },
  });
}

export function useDeleteCategorySection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.deleteCategorySection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masterCategories });
    },
  });
}

export function useSelectionTemplates() {
  return useQuery({
    queryKey: queryKeys.selectionTemplates,
    queryFn: () => projectsApi.fetchSelectionTemplates().then((response) => response.templates),
  });
}

export function useSelectionTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.selectionTemplate(templateId ?? ""),
    queryFn: () => projectsApi.fetchSelectionTemplate(templateId!),
    enabled: Boolean(templateId),
  });
}

export function useCreateSelectionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createSelectionTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.selectionTemplates });
    },
  });
}

export function useUpdateSelectionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; body: Partial<ApiSelectionTemplate> }) =>
      projectsApi.updateSelectionTemplate(variables.id, variables.body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.selectionTemplates });
      queryClient.invalidateQueries({ queryKey: queryKeys.selectionTemplate(variables.id) });
    },
  });
}

export function useDeleteSelectionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.deleteSelectionTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.selectionTemplates });
    },
  });
}

export function useApplySelectionTemplate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { templateId: string; categoryKeys?: string[] }) =>
      projectsApi.applySelectionTemplate(projectId, variables.templateId, variables.categoryKeys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.selections(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetSnapshots(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
    },
  });
}

export function useSubmitProposal(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      signatureType: "drawn" | "typed";
      typedName?: string;
      signatureImageBase64?: string;
    }) => projectsApi.submitProjectProposal(projectId, variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.selections(projectId) });
    },
  });
}

export function useSubmitSelections(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.submitProjectSelections(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
    },
  });
}

export function useResendSignedProposal(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsApi.resendSignedProposal(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useUnlockCategories(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryKeys: string[]) => projectsApi.unlockProjectCategories(projectId, categoryKeys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
    },
  });
}

export function useToggleProjectLock(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locked: boolean) => projectsApi.toggleProjectLock(projectId, locked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
    },
  });
}

export function useToggleDecideLater(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { categoryKey: string; slotLabel: string; decideLater: boolean }) =>
      projectsApi.toggleDecideLater(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.selections(projectId) });
    },
  });
}

export function useUpdateProjectLastVisited(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryKey: string) => projectsApi.patchProjectLastVisited(projectId, categoryKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useRoomTypes() {
  return useQuery({
    queryKey: queryKeys.roomTypes,
    queryFn: () => projectsApi.fetchRoomTypes().then((res) => res.roomTypes),
  });
}

export function useCreateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createRoomType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roomTypes });
    },
  });
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; body: Partial<ApiRoomType> }) =>
      projectsApi.updateRoomType(variables.id, variables.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roomTypes });
    },
  });
}

export function useDeleteRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.deleteRoomType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roomTypes });
    },
  });
}

export function useRecycleBin() {
  return useQuery({
    queryKey: ["projects", "recycle-bin"],
    queryFn: () => projectsApi.fetchRecycleBin().then((res) => res.projects),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, permanent }: { projectId: string; permanent?: boolean }) =>
      projectsApi.deleteProject(projectId, permanent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", "recycle-bin"] });
    },
  });
}

export function useRestoreProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.restoreProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", "recycle-bin"] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<import("@2bn/shared").ApiProject>) => projectsApi.updateProject(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: usersApi.fetchUsers,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useActivities() {
  return useQuery({
    queryKey: queryKeys.activities,
    queryFn: usersApi.fetchActivities,
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.restoreUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function usePermanentlyDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.permanentlyDeleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useSetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      usersApi.setUserPassword(userId, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useSendResetLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.sendResetLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.resendInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useOrgSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.fetchOrgSettings,
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateOrgSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: settingsApi.testSmtp,
  });
}

export function useTestResend() {
  return useMutation({
    mutationFn: settingsApi.testResend,
  });
}



