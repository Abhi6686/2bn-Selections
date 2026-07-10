import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  useBudgetSnapshots,
  useChangeOrders,
  useLibrary,
  usePatchSelection,
  useProject,
  useProjectSelections,
  useTimeline,
  useMasterCategories,
  useThemes,
  queryKeys,
  useToggleDecideLater,
  useUpdateProjectLastVisited,
  useSubmitProposal,
  useSubmitSelections,
  useUnlockCategories,
  useResendSignedProposal,
} from "../api/hooks";
import * as projectsApi from "../api/projects";
import { apiFetch } from "../api/client";
import { LevelBadge } from "../components/LevelBadge";
import { ProductImage } from "../components/ProductImage";
import { ItemDetailModal } from "../components/ItemDetailModal";
import { HomeownerSelectionsTab } from "../components/HomeownerSelectionsTab";
import { ProjectRoomsSetupTab } from "../components/ProjectRoomsSetupTab";
import { buildCategoryTree, getWizardStepsFromTree, getCompletionStats } from "../utils/categoryTree";
import type { ApiProjectSelection } from "@2bn/shared";
import { useAuth } from "../context/AuthContext";
import { changeOrderMinimum } from "../store/library";
import { formatCurrency, formatDateTime } from "../utils/format";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import toast from "react-hot-toast";

type DetailTab = "dashboard" | "selections" | "budget" | "change-orders" | "timeline" | "members" | "rooms";


export function ApiProjectDetailPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const signatureRef = useRef<SignatureCanvas>(null);

  // Role flags
  const isBuilder = role === "admin" || role === "project_manager" || role === "client";
  const isHomeowner = role === "end_user";

  // State
  const [activeTab, setActiveTab] = useState<DetailTab>(isHomeowner ? "selections" : "dashboard");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [comparedItems, setComparedItems] = useState<any[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [zoomDimensionsUrl, setZoomDimensionsUrl] = useState<string | null>(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>("");
  const [decideLaterKeys, setDecideLaterKeys] = useState<Set<string>>(new Set());
  const [homeownerActiveSlotKey, setHomeownerActiveSlotKey] = useState<string | undefined>();


  // Direct Change Order Signing State
  const [activeSigningCo, setActiveSigningCo] = useState<any | null>(null);
  const [typedSignatureName, setTypedSignatureName] = useState("");
  const [signatureTypeSelection, setSignatureTypeSelection] = useState<"typed" | "drawn">("typed");
  const [geoConsentChecked, setGeoConsentChecked] = useState(false);
  const [signingError, setSigningError] = useState("");
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);

  // Change Order Form State (Builders only)
  const [coTitle, setCoTitle] = useState("");
  const [coNotes, setCoNotes] = useState("");
  const [coLines, setCoLines] = useState<Array<{ category: string; description: string; previousAmount: number; newAmount: number }>>([
    { category: "", description: "", previousAmount: 0, newAmount: 0 }
  ]);

  // Invite Form State (Builders only)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"primary_homeowner" | "secondary_homeowner">("primary_homeowner");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Edit Project Theme State
  const [themeId, setThemeId] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // Queries
  const projectQuery = useProject(projectId);
  const selectionsQuery = useProjectSelections(projectId);
  const libraryQuery = useLibrary({ projectId });
  const changeOrdersQuery = useChangeOrders(projectId);
  const timelineQuery = useTimeline(projectId);
  const budgetQuery = useBudgetSnapshots(projectId);
  const masterCatsQuery = useMasterCategories();
  const themesQuery = useThemes();
  const patchSelection = usePatchSelection(projectId);
  const toggleDecideLater = useToggleDecideLater(projectId);
  const updateProjectLastVisited = useUpdateProjectLastVisited(projectId);
  const submitProposalMutation = useSubmitProposal(projectId);
  const submitSelectionsMutation = useSubmitSelections(projectId);
  const unlockCategoriesMutation = useUnlockCategories(projectId);
  const resendProposalMutation = useResendSignedProposal(projectId);

  const project = projectQuery.data;
  const selections = selectionsQuery.data ?? [];
  const libraryItems = libraryQuery.data ?? [];
  const sections = (masterCatsQuery.data?.sections as any[]) ?? [];
  const themes = themesQuery.data ?? [];

  // Initialize homeownerActiveSlotKey and decideLaterKeys from project load
  useEffect(() => {
    if (project?.lastVisitedCategoryKey && homeownerActiveSlotKey === undefined) {
      setHomeownerActiveSlotKey(project.lastVisitedCategoryKey);
    }
  }, [project?.lastVisitedCategoryKey]);

  useEffect(() => {
    if (project?.decideLaterSlots) {
      const keys = new Set<string>();
      project.decideLaterSlots.forEach((s) => {
        const parts = s.split("::");
        keys.add(parts[0]);
      });
      setDecideLaterKeys(keys);
    }
  }, [project?.decideLaterSlots]);

  // Auto-redirect from pricing tabs if showPrices is disabled
  useEffect(() => {
    if (isHomeowner && project && !project.showPrices && (activeTab === "budget" || activeTab === "change-orders" || activeTab === "dashboard")) {
      setActiveTab("selections");
    }
  }, [isHomeowner, project?.showPrices, activeTab]);

  async function handleToggleDecideLater(slotKey: string, decideLater: boolean) {
    try {
      await toggleDecideLater.mutateAsync({
        categoryKey: slotKey,
        slotLabel: "",
        decideLater,
      });
      setDecideLaterKeys((prev) => {
        const next = new Set(prev);
        if (decideLater) next.add(slotKey);
        else next.delete(slotKey);
        return next;
      });
    } catch {
      alert("Failed to update Decide Later status.");
    }
  }

  function handleVisitSlot(slotKey: string) {
    setHomeownerActiveSlotKey(slotKey);
    updateProjectLastVisited.mutate(slotKey);
  }

  // Update theme state on project load
  useEffect(() => {
    if (project?.themeId) {
      setThemeId(project.themeId);
    }
  }, [project?.themeId]);

  // Initialize category tree
  const categoryTree = useMemo(() => {
    return buildCategoryTree(sections);
  }, [sections]);



  // Set default active category key
  useEffect(() => {
    if (project?.lastVisitedCategoryKey) {
      setActiveCategoryKey(project.lastVisitedCategoryKey);
    } else if (sections.length > 0 && !activeCategoryKey) {
      const selectable = getWizardStepsFromTree(categoryTree);
      if (selectable.length > 0) {
        setActiveCategoryKey(selectable[0].categoryKey);
      }
    }
  }, [project?.lastVisitedCategoryKey, sections, categoryTree]);

  // Active completed/skipped category keys for sidebar tracking
  const activeCompletedCategoryKeys = useMemo(() => {
    return new Set(selections.filter((s) => s.state === "confirmed").map((s) => s.categoryKey));
  }, [selections]);

  const activeSkippedCategoryKeys = useMemo(() => {
    return new Set(selections.filter((s) => s.state === "skipped").map((s) => s.categoryKey));
  }, [selections]);

  // Group selections by category key
  const selectionsByCategoryKey = useMemo(() => {
    const map = new Map<string, ApiProjectSelection[]>();
    selections.forEach((s) => {
      const list = map.get(s.categoryKey) || [];
      list.push(s);
      map.set(s.categoryKey, list);
    });
    return map;
  }, [selections]);

  // ── Hierarchical category key matching ─────────────────────────────────────
  // Room Configurator saves slots at the parent level (e.g. "Kitchen - Appliances"),
  // but library items use leaf-level keys (e.g. "Kitchen - Appliances - Refrigerator").
  // This helper matches both exact keys AND any descendant (child) keys.
  function matchesSlotCategory(itemCategoryKey: string, slotCategoryKey: string): boolean {
    return (
      itemCategoryKey === slotCategoryKey ||
      itemCategoryKey.startsWith(slotCategoryKey + " - ")
    );
  }

  // Returns all selections whose categoryKey exactly matches OR is a descendant of slotCategoryKey.
  // This is needed when Room Configurator uses a parent-level key like "Kitchen - Appliances"
  // but selections are stored under leaf-level keys like "Kitchen - Appliances - Refrigerator".
  function getSelectionsForSlot(slotCategoryKey: string): typeof selections {
    // Fast path: exact match (covers 3-level leaf keys stored by leaf-level slots)
    const exact = selectionsByCategoryKey.get(slotCategoryKey) || [];
    if (exact.length > 0) return exact;
    // Prefix match: collect all selections whose categoryKey is a descendant
    const result: typeof selections = [];
    selectionsByCategoryKey.forEach((sels, key) => {
      if (key !== slotCategoryKey && key.startsWith(slotCategoryKey + " - ")) {
        result.push(...sels);
      }
    });
    return result;
  }

  // Map theme names for display
  const activeThemeName = useMemo(() => {
    if (!project?.themeId) return "No Theme Selected";
    const matched = themes.find((t) => t.id === project.themeId);
    return matched ? matched.name : "Custom Theme";
  }, [project?.themeId, themes]);

  // Calculate overall progress stats based on either rooms configuration slots or Master categories
  const overallProgress = useMemo(() => {
    if (project?.rooms && project.rooms.length > 0) {
      const allSlots = project.rooms.flatMap((r: any) => r.slots);
      const total = allSlots.length;
      if (total === 0) return { completed: 0, total: 0, percent: 0 };
      const completed = allSlots.filter((slot: any) => {
        // Use prefix-aware lookup so parent-level slots (e.g. "Kitchen - Appliances")
        // correctly count selections stored at leaf level.
        const categorySelections = getSelectionsForSlot(slot.categoryKey);
        return categorySelections.some((s) => s.state === "confirmed" || s.state === "skipped");
      }).length;
      return {
        completed,
        total,
        percent: Math.round((completed / total) * 100),
      };
    }
    const stats = getCompletionStats(categoryTree, activeCompletedCategoryKeys, activeSkippedCategoryKeys);
    return {
      completed: stats.completed,
      total: stats.total,
      percent: stats.percentage,
    };
  }, [project?.rooms, categoryTree, activeCompletedCategoryKeys, activeSkippedCategoryKeys, selectionsByCategoryKey]);


  // ── Homeowner Sections ────────────────────────────────────────────────────
  // Build the HOSection[] that HomeownerSelectionsTab expects from the tree +
  // current selections + library items.
  // (matchesSlotCategory and getSelectionsForSlot are defined above overallProgress)

  const hoSections = useMemo(() => {
    // If project has configured rooms, map them directly!
    if (project?.rooms && project.rooms.length > 0) {
      return project.rooms.map((room: any) => {
        return {
          key: room.id,
          title: room.name,
          icon: room.icon || "🏠",
          slots: room.slots.map((slot: any) => {
            // Use hierarchical selection lookup so parent-level slots (e.g. "Kitchen - Appliances")
            // also pick up selections stored under leaf keys.
            const categorySelections = getSelectionsForSlot(slot.categoryKey);
            const stepSelections = categorySelections.filter((s) => s.state === "confirmed");
            const skippedSel = categorySelections.find((s) => s.state === "skipped");
            const latestSel = stepSelections[stepSelections.length - 1];

            // Use prefix-aware library item matching
            const libItem = latestSel
              ? libraryItems.find((i) => i.id === latestSel.libraryItemId)
              : libraryItems.find((i) => matchesSlotCategory(i.categoryKey, slot.categoryKey) && !!i.imageUrl);

            // Collect ALL library items that belong to this slot (exact or descendant)
            const stepLibraryItems = libraryItems.filter((i) => matchesSlotCategory(i.categoryKey, slot.categoryKey));

            const selectedItems = stepSelections.map((sel) => {
              const matchingLibItem = libraryItems.find((i) => i.id === sel.libraryItemId);
              return {
                selectionId: sel.id,
                libraryItemId: sel.libraryItemId || "",
                quantity: sel.quantity || 1,
                priceUsed: sel.priceUsed || matchingLibItem?.priceMin || 0,
                manufacturer: matchingLibItem?.manufacturer,
                model: matchingLibItem?.model,
                product: matchingLibItem?.product,
                level: matchingLibItem?.level,
                finish: matchingLibItem?.finish,
                size: matchingLibItem?.size,
                vendor: matchingLibItem?.vendor,
                imageUrl: sel.imageUrl || matchingLibItem?.imageUrl,
                specifications: matchingLibItem?.specifications,
              };
            });

            const parts = slot.categoryKey.split(" - ");
            const subsectionTitle = parts.length > 2 ? parts[1].trim() : undefined;

            return {
              slotKey: slot.categoryKey,
              slotLabel: slot.slotLabel || slot.categoryKey.split(" - ").pop() || slot.categoryKey,
              subsectionTitle,
              categoryKey: slot.categoryKey,
              sectionTitle: room.name,
              selectionId: latestSel?.id || skippedSel?.id,
              libraryItemId: latestSel?.libraryItemId,
              state: latestSel ? latestSel.state : (skippedSel ? "skipped" : undefined),
              isSkipped: !!skippedSel,
              manufacturer: libItem?.manufacturer,
              model: libItem?.model,
              product: libItem?.product,
              finish: libItem?.finish,
              size: libItem?.size,
              vendor: libItem?.vendor,
              specifications: libItem?.specifications,
              tags: libItem?.tags,
              level: libItem?.level,
              priceMin: libItem?.priceMin,
              priceMax: libItem?.priceMax,
              imageUrl: latestSel?.imageUrl || libItem?.imageUrl,
              galleryImages: (libItem as any)?.galleryImages,
              isDecideLater: decideLaterKeys.has(slot.categoryKey) || decideLaterKeys.has(`${slot.categoryKey}::`),
              selectedItems,
              availableItems: stepLibraryItems.map((item) => ({
                id: item.id,
                categoryKey: item.categoryKey,
                manufacturer: item.manufacturer,
                model: item.model,
                product: item.product,
                imageUrl: item.imageUrl,
                priceMin: item.priceMin,
                priceMax: item.priceMax,
                level: item.level,
                tags: item.tags,
                galleryImages: (item as any).galleryImages,
                specifications: item.specifications,
                finish: item.finish,
                size: item.size,
                vendor: item.vendor,
              })),
            };
          }),
        };
      }).filter((s: any) => s.slots.length > 0);
    }

    // Fallback to traditional category tree structure if no rooms configured
    return categoryTree.map((sectionNode) => ({
      key: sectionNode.id,
      title: sectionNode.label,
      icon: sectionNode.icon || "📁",
      slots: getWizardStepsFromTree([sectionNode]).map((step) => {
        const categorySelections = getSelectionsForSlot(step.categoryKey);
        const stepSelections = categorySelections.filter((s) => s.state === "confirmed");
        const skippedSel = categorySelections.find((s) => s.state === "skipped");
        const latestSel = stepSelections[stepSelections.length - 1];
        // Find the library item for this selection (prefix-aware)
        const libItem = latestSel
          ? libraryItems.find((i) => i.id === latestSel.libraryItemId)
          : libraryItems.find((i) => matchesSlotCategory(i.categoryKey, step.categoryKey) && !!i.imageUrl);
        // Find all library items for this slot (prefix-aware)
        const stepLibraryItems = libraryItems.filter((i) => matchesSlotCategory(i.categoryKey, step.categoryKey));
        
        // Build multi-selection items
        const selectedItems = stepSelections.map((sel) => {
          const matchingLibItem = libraryItems.find((i) => i.id === sel.libraryItemId);
          return {
            selectionId: sel.id,
            libraryItemId: sel.libraryItemId || "",
            quantity: sel.quantity || 1,
            priceUsed: sel.priceUsed || matchingLibItem?.priceMin || 0,
            manufacturer: matchingLibItem?.manufacturer,
            model: matchingLibItem?.model,
            product: matchingLibItem?.product,
            level: matchingLibItem?.level,
            finish: matchingLibItem?.finish,
            size: matchingLibItem?.size,
            vendor: matchingLibItem?.vendor,
            imageUrl: sel.imageUrl || matchingLibItem?.imageUrl,
            specifications: matchingLibItem?.specifications,
          };
        });

        const parts = step.categoryKey.split(" - ");
        const subsectionTitle = parts.length > 2 ? parts[1].trim() : undefined;

        return {
          slotKey: step.categoryKey,
          slotLabel: step.label || step.categoryKey.split(" - ").pop() || step.categoryKey,
          subsectionTitle,
          categoryKey: step.categoryKey,
          sectionTitle: sectionNode.label,
          selectionId: latestSel?.id || skippedSel?.id,
          libraryItemId: latestSel?.libraryItemId,
          state: latestSel ? latestSel.state : (skippedSel ? "skipped" : undefined),
          isSkipped: !!skippedSel,
          manufacturer: libItem?.manufacturer,
          model: libItem?.model,
          product: libItem?.product,
          finish: libItem?.finish,
          size: libItem?.size,
          vendor: libItem?.vendor,
          specifications: libItem?.specifications,
          tags: libItem?.tags,
          level: libItem?.level,
          priceMin: libItem?.priceMin,
          priceMax: libItem?.priceMax,
          imageUrl: latestSel?.imageUrl || libItem?.imageUrl,
          galleryImages: (libItem as any)?.galleryImages,
          isDecideLater: decideLaterKeys.has(step.categoryKey) || decideLaterKeys.has(`${step.categoryKey}::`),
          selectedItems,
          availableItems: stepLibraryItems.map((item) => ({
            id: item.id,
            categoryKey: item.categoryKey,
            manufacturer: item.manufacturer,
            model: item.model,
            product: item.product,
            imageUrl: item.imageUrl,
            priceMin: item.priceMin,
            priceMax: item.priceMax,
            level: item.level,
            tags: item.tags,
            galleryImages: (item as any).galleryImages,
            specifications: item.specifications,
            finish: item.finish,
            size: item.size,
            vendor: item.vendor,
          })),
        };
      }),
    })).filter((s) => s.slots.length > 0);
  }, [project?.rooms, categoryTree, selectionsByCategoryKey, libraryItems, decideLaterKeys]);

  // Handlers
  const updateSelectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSelectItem(categoryKey: string, libraryItemId: string, priceUsed: number, quantity?: number) {
    setSaveStatus("saving" as any);
    try {
      await patchSelection.mutateAsync({
        categoryKey,
        state: "confirmed",
        libraryItemId,
        priceUsed,
        quantity: quantity ?? 1,
        slotLabel: libraryItemId,
      });
      setSaveStatus("saved" as any);
      setTimeout(() => setSaveStatus("idle" as any), 3000);
    } catch {
      setSaveStatus("idle" as any);
    }
  }

  async function handleUpdateSelectionProperty(selectionId: string, categoryKey: string, updates: { quantity?: number; slotLabel?: string }) {
    setSaveStatus("saving" as any);
    if (updateSelectionTimer.current) {
      clearTimeout(updateSelectionTimer.current);
    }
    updateSelectionTimer.current = setTimeout(async () => {
      try {
        await patchSelection.mutateAsync({
          id: selectionId,
          categoryKey,
          state: "confirmed",
          ...updates,
        });
        setSaveStatus("saved" as any);
        setTimeout(() => setSaveStatus("idle" as any), 3000);
      } catch {
        setSaveStatus("idle" as any);
      }
    }, 500);
  }

  async function handleDeleteSelectionSlot(selectionId: string) {
    setSaveStatus("saving" as any);
    try {
      await projectsApi.deleteProjectSelection(projectId, selectionId);
      queryClient.invalidateQueries({ queryKey: queryKeys.selections(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetSnapshots(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
      setSaveStatus("saved" as any);
      setTimeout(() => setSaveStatus("idle" as any), 3000);
    } catch {
      setSaveStatus("idle" as any);
    }
  }

  async function handleSkipCategory(categoryKey: string, version?: number) {
    setSaveStatus("saving" as any);
    try {
      await patchSelection.mutateAsync({
        categoryKey,
        state: "skipped",
        version,
      });
      setSaveStatus("saved" as any);
      setTimeout(() => setSaveStatus("idle" as any), 3000);
    } catch {
      setSaveStatus("idle" as any);
    }
  }

  async function handleReleaseChangeOrder(changeOrderId: string) {
    try {
      await projectsApi.releaseChangeOrder(projectId, changeOrderId);
      queryClient.invalidateQueries({ queryKey: queryKeys.changeOrders(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
    } catch (err) {
      alert("Error releasing change order.");
    }
  }

  async function handleApproveChangeOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!activeSigningCo) return;

    setIsSubmittingSignature(true);
    setSigningError("");

    let geoLatitude: number | undefined;
    let geoLongitude: number | undefined;

    if (geoConsentChecked && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        geoLatitude = position.coords.latitude;
        geoLongitude = position.coords.longitude;
      } catch (err) {
        console.warn("Geolocation skipped/failed:", err);
      }
    }

    const signatureImageBase64 =
      signatureTypeSelection !== "typed" ? signatureRef.current?.toDataURL("image/png") : undefined;

    try {
      const result = await projectsApi.approveProjectChangeOrder(projectId, activeSigningCo.id, {
        signatureType: signatureTypeSelection,
        typedName: typedSignatureName || undefined,
        signatureImageBase64,
        geoLatitude,
        geoLongitude,
        geoConsent: geoConsentChecked,
      });

      if (result.ok) {
        setActiveSigningCo(null);
        setTypedSignatureName("");
        setGeoConsentChecked(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.changeOrders(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.budgetSnapshots(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
      } else {
        setSigningError(result.status || "Failed to submit signature.");
      }
    } catch (err: any) {
      setSigningError(err.message || "Failed to submit signature.");
    } finally {
      setIsSubmittingSignature(false);
    }
  }

  async function handleCreateChangeOrder(event: React.FormEvent) {
    event.preventDefault();
    const validLines = coLines.filter((l) => l.category && l.newAmount !== l.previousAmount);
    if (validLines.length === 0) return;

    try {
      await projectsApi.createChangeOrder(projectId, {
        title: coTitle || "Selections adjustment change order",
        notes: coNotes || undefined,
        lines: validLines,
      });
      setCoTitle("");
      setCoNotes("");
      setCoLines([{ category: "", description: "", previousAmount: 0, newAmount: 0 }]);
      queryClient.invalidateQueries({ queryKey: queryKeys.changeOrders(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(projectId) });
      setActiveTab("change-orders");
    } catch (err: any) {
      alert(err.message || "Failed to draft change order.");
    }
  }

  async function handleInviteHomeowner(event: React.FormEvent) {
    event.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    if (!inviteEmail.trim()) return;

    try {
      await projectsApi.inviteHomeowner(projectId, inviteEmail.trim(), inviteRole);
      setInviteSuccess(`Invitation successfully queued for ${inviteEmail.trim()}! Check server logs for magic link.`);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite homeowner.");
    }
  }

  async function handleThemeChange(newThemeId: string) {
    setThemeId(newThemeId);
    try {
      await projectsApi.createProject(projectId as any); // fallback mapping or edit endpoint
      // We will hit patchProject endpoint
      await apiPatchProject({ themeId: newThemeId });
    } catch {
      // ignore silently, let state refresh
    }
  }

  async function apiPatchProject(body: { 
    name?: string;
    clientName?: string;
    address?: string;
    themeId?: string; 
    requiresDualApproval?: boolean; 
    projectLocked?: boolean; 
    status?: string; 
    rooms?: any[];
    primaryHomeownerEmail?: string;
    secondaryHomeownerEmail?: string;
    showPrices?: boolean;
  }) {
    await apiFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.library() });
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
  }


  function handleResumeSelections() {
    if (!project?.lastVisitedCategoryKey) return;
    const categoryKey = project.lastVisitedCategoryKey;

    if (isHomeowner) {
      setHomeownerActiveSlotKey(categoryKey);
    } else {
      // Find section containing categoryKey
      const matchedSection = sections.find((sec: any) => {
        let found = false;
        sec.groups.forEach((g: any) => {
          if (g.subgroups) {
            g.subgroups.forEach((s: any) => {
              if (s.categoryKey === categoryKey) found = true;
            });
          } else if (g.categoryKey === categoryKey) {
            found = true;
          }
        });
        return found;
      });

      if (matchedSection) {
        setActiveCategoryKey(categoryKey);
        setActiveTab("selections");
        setTimeout(() => {
          const el = document.getElementById(categoryKey);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("pulse-highlight");
            setTimeout(() => el.classList.remove("pulse-highlight"), 2000);
          }
        }, 300);
      }
    }
  }

  // Comparison Handlers
  function toggleCompare(item: any) {
    const isMatched = comparedItems.some((i) => i.id === item.id);
    if (isMatched) {
      setComparedItems(comparedItems.filter((i) => i.id !== item.id));
    } else {
      // Must be same category to compare
      if (comparedItems.length > 0 && comparedItems[0].categoryKey !== item.categoryKey) {
        setComparedItems([item]);
      } else {
        if (comparedItems.length >= 3) {
          alert("You can compare up to 3 items side-by-side.");
          return;
        }
        setComparedItems([...comparedItems, item]);
      }
    }
  }

  const projectMembersQuery = useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => projectsApi.fetchProjectMembers(projectId).then((r) => r.members),
    enabled: isBuilder && Boolean(projectId),
  });

  if (projectQuery.isLoading || masterCatsQuery.isLoading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="save-status-dot" style={{ animation: "pulse 1s infinite alternate", width: 24, height: 24, background: "var(--accent)" }} />
          <p style={{ marginTop: 16 }}>Loading project workstation…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card empty-state">
        <h2>Project not found</h2>
        <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  const budgetDelta = project.currentBudget - project.initialBudget;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xs font-bold uppercase tracking-widest text-secondary hover:underline">
              ← Back to Dashboard
            </Link>
            {isBuilder && (
              <button
                onClick={async () => {
                  const typed = prompt(`Are you sure you want to delete "${project.name}"? This will move the project to the Recycle Bin. Please type CONFIRM in capital letters to proceed:`);
                  if (typed === "CONFIRM") {
                    try {
                      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
                      toast.success("Project moved to Recycle Bin.");
                      navigate("/");
                    } catch (err: any) {
                      alert(err.message || "Failed to delete project");
                    }
                  } else if (typed !== null) {
                    alert("Confirmation mismatch. Project was not deleted.");
                  }
                }}
                 className="text-xs font-bold uppercase tracking-widest text-destructive hover:underline mr-4"
              >
                🗑️ Delete Project
              </button>
            )}
            {isBuilder && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
              >
                ✏️ Edit Details
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl font-extrabold font-serif text-foreground">{project.name}</h1>
            <Badge variant="secondary" className="font-semibold text-xs">
              {activeThemeName}
            </Badge>
            {(role === "admin" || role === "project_manager") && (
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold select-none">
                <span>Show Prices to Homeowner:</span>
                <button
                  onClick={async () => {
                    try {
                      await apiPatchProject({ showPrices: !project.showPrices });
                      toast.success(project.showPrices ? "Prices hidden from homeowner" : "Prices visible to homeowner");
                    } catch (err: any) {
                      toast.error("Failed to update price visibility");
                    }
                  }}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                    project.showPrices ? "bg-primary" : "bg-muted-foreground"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                      project.showPrices ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Client: <strong className="text-foreground">{project.clientName}</strong> · Site: <strong className="text-foreground">{project.address || "TBD"}</strong>
          </p>
        </div>


        {/* Live Autosave Status & Budget Summary */}
        <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
          {(!project.showPrices && isHomeowner) ? null : (
            <div className="text-3xl font-extrabold text-foreground">
              {formatCurrency(project.currentBudget)}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {saveStatus !== "idle" && (
              <div className={`save-status-chip ${saveStatus}`}>
                <span className="save-status-dot" />
                {saveStatus === "saving" ? "Saving selections..." : "All changes saved"}
              </div>
            )}
            {project.proposalSigned && (!project.showPrices && isHomeowner ? null : (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Variance: <strong style={{ color: budgetDelta > 0 ? "var(--warning)" : budgetDelta < 0 ? "var(--success)" : "inherit" }}>
                  {budgetDelta >= 0 ? "+" : ""}{formatCurrency(budgetDelta)}
                </strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <Card className="shadow-sm border border-border">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-semibold mb-2">
            <span className="text-foreground">Project Selection Progress</span>
            <span className="text-muted-foreground">{overallProgress.completed} of {overallProgress.total} completed ({overallProgress.percent}%)</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${overallProgress.percent}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Resume Selections Banner */}
      {project.lastVisitedCategoryKey && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-secondary/10 border border-secondary/20">
          <div className="text-sm font-medium text-foreground">
            👋 Welcome back! Resume your selections sheet choices at <strong className="text-secondary-foreground">{project.lastVisitedCategoryKey.split(" - ").slice(-1)[0]}</strong>.
          </div>
          <Button size="sm" variant="default" onClick={handleResumeSelections} className="shrink-0">
            Resume Selections
          </Button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex bg-muted p-1 rounded-xl border border-border w-fit flex-wrap gap-1">
        {isBuilder && (
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === "dashboard" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dashboard
          </button>
        )}
        <button
          onClick={() => setActiveTab("selections")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeTab === "selections" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Selection Sheet
        </button>
        {(!isHomeowner || project.showPrices) && (
          <button
            onClick={() => setActiveTab("budget")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === "budget" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Budget Snapshots
          </button>
        )}
        {(!isHomeowner || project.showPrices) && (
          <button
            onClick={() => setActiveTab("change-orders")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === "change-orders" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Change Orders
          </button>
        )}
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeTab === "timeline" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Timeline
        </button>
        {isBuilder && (
          <button
            onClick={() => setActiveTab("rooms")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === "rooms" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rooms Setup
          </button>
        )}
        {isBuilder && (
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              activeTab === "members" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Project Members
          </button>
        )}
      </div>


      {/* --- DASHBOARD TAB (BUILDER ONLY) --- */}
      {activeTab === "dashboard" && isBuilder && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-muted hover:shadow-md">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Selections Budget</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{formatCurrency(project.initialBudget)}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary hover:shadow-md">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Budget (Variance Included)</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">{formatCurrency(project.currentBudget)}</p>
              </CardContent>
            </Card>

            <Card className={`border-l-4 hover:shadow-md ${budgetDelta > 0 ? "border-l-destructive" : "border-l-emerald-600"}`}>
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Variance Overage</p>
                <p className={`text-2xl font-extrabold mt-1 ${budgetDelta > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {budgetDelta >= 0 ? "+" : ""}{formatCurrency(budgetDelta)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Theme Settings & Access Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-border">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-foreground">Project Style Theme</h3>
                <p className="text-sm text-muted-foreground">
                  Setting a theme applies weight modifiers to library assets, recommending modern/farmhouse options to the client at the top of their page.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Style Theme Selection</label>
                  <select
                    value={themeId}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">No Theme / Unassigned</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-foreground">Homeowner Access Status</h3>
                <p className="text-sm text-muted-foreground">
                  Dual approval mode requires both partners (spouses) to sign off on released change orders. Check status under the Members tab.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dual Spouse Approval Required</label>
                  <select
                    value={project.requiresDualApproval ? "true" : "false"}
                    onChange={(e) => apiPatchProject({ requiresDualApproval: e.target.value === "true" })}
                    className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="false">Single Sign-off (Primary Homeowner only)</option>
                    <option value="true">Dual Sign-off Required (Both spouses must sign)</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- SELECTIONS WORKSPACE TAB --- */}
      {activeTab === "selections" && (
        <HomeownerSelectionsTab
          sections={hoSections}
          proposalSigned={!!project?.proposalSigned}
          unlockedCategoryKeys={project?.unlockedCategoryKeys || []}
          onSelectItem={handleSelectItem}
          onRemoveSelection={(slotKey) => {
            const catSels = selectionsByCategoryKey.get(slotKey) || [];
            catSels.forEach((s) => handleDeleteSelectionSlot(s.id));
          }}
          onToggleDecideLater={handleToggleDecideLater}
          decideLaterKeys={decideLaterKeys}
          lastVisitedCategoryKey={homeownerActiveSlotKey || activeCategoryKey}
          onVisitSlot={handleVisitSlot}
          onSkipCategory={handleSkipCategory}
          onRemoveSelectionItem={handleDeleteSelectionSlot}
          onUpdateQuantity={(selectionId, slotKey, quantity) => 
            handleUpdateSelectionProperty(selectionId, slotKey, { quantity })
          }
          onSubmitSelections={async () => {
            await submitSelectionsMutation.mutateAsync();
          }}
          onSubmitProposal={async (body) => {
            await submitProposalMutation.mutateAsync(body);
          }}
          onResendSignedProposal={async () => {
            await resendProposalMutation.mutateAsync();
          }}
          proposalPdfUrl={project?.proposalPdfUrl}
          projectStatus={project?.status}
          proposalEmailStatus={project?.proposalEmailStatus}
          proposalEmailError={project?.proposalEmailError}
          proposalSignedAt={project?.proposalSignedAt}
          proposalSignedBy={project?.proposalSignedBy}
          proposalSignatureType={project?.proposalSignatureType}
          proposalTypedName={project?.proposalTypedName}
          proposalSignatureIp={project?.proposalSignatureIp}
          proposalSignatureGeo={project?.proposalSignatureGeo}
          
          // PM/Admin Props
          isAdmin={!isHomeowner}
          projectLocked={project?.projectLocked}
          onUnlockCategory={async (slotKey, isUnlocked) => {
            const current = project?.unlockedCategoryKeys || [];
            const updated = isUnlocked 
              ? [...current, slotKey] 
              : current.filter(k => k !== slotKey);
            await unlockCategoriesMutation.mutateAsync(updated);
          }}
          onToggleProjectLock={async (locked) => {
            await apiPatchProject({ projectLocked: locked });
          }}
          onUpdateProjectStatus={async (newStatus) => {
            await apiPatchProject({ status: newStatus });
          }}
          onSaveRooms={async (updatedRooms) => {
            await apiPatchProject({ rooms: updatedRooms });
          }}
          availableCategories={
            sections.flatMap((sec: any) =>
              sec.groups.flatMap((group: any) => {
                if (group.subgroups && group.subgroups.length > 0) {
                  return group.subgroups.map((sub: any) => ({
                    categoryKey: sub.categoryKey,
                    label: `${sec.name} › ${group.name} › ${sub.name}`,
                  }));
                }
                return [{
                  categoryKey: group.categoryKey,
                  label: `${sec.name} › ${group.name}`,
                }];
              })
            )
          }
          projectId={projectId}
          showPrices={project?.showPrices}
        />

      )}

      {/* --- BUDGET SNAPSHOTS TAB --- */}
      {activeTab === "budget" && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Project Budget Snapshot Trail</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Below are audit snapshots of the total selections budget taken over the project lifecycle, automatically recorded at creation, selection modifications, and signed change orders.
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Record Date</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Snapshot Description</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Event</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Running Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(budgetQuery.data ?? []).map((snapshot) => (
                    <tr key={snapshot.id} className="border-b border-border/60 hover:bg-muted/10 transition-colors">
                      <td className="p-3 text-muted-foreground font-medium">{formatDateTime(snapshot.recordedAt)}</td>
                      <td className="p-3 text-foreground font-semibold">{snapshot.label}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="capitalize text-[10px] py-0.5 px-2 font-bold">
                          {snapshot.source.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-extrabold text-foreground">{formatCurrency(snapshot.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- CHANGE ORDERS TAB --- */}
      {activeTab === "change-orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Builder change order form */}
          {isBuilder && (
            <div className="card">
              <h3>Draft Selection Change Order</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                Add lines below to draft a change order. Minimum total delta is <strong>{formatCurrency(changeOrderMinimum)}</strong>.
              </p>
              <form onSubmit={handleCreateChangeOrder} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>CO Title</label>
                    <input value={coTitle} onChange={(e) => setCoTitle(e.target.value)} placeholder="e.g. Upgrade Kitchen Appliance Package" required />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Internal / Client Notes</label>
                    <input value={coNotes} onChange={(e) => setCoNotes(e.target.value)} placeholder="Reasoning and specifications details..." />
                  </div>
                </div>

                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Change Lines</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setCoLines([...coLines, { category: "", description: "", previousAmount: 0, newAmount: 0 }])}
                    >
                      + Add Line
                    </button>
                  </div>

                  {coLines.map((line, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 40px", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <input
                        placeholder="Category (e.g. Kitchen - Appliances)"
                        value={line.category}
                        onChange={(e) => {
                          const newLines = [...coLines];
                          newLines[idx].category = e.target.value;
                          setCoLines(newLines);
                        }}
                        required
                      />
                      <input
                        placeholder="Description of swap"
                        value={line.description}
                        onChange={(e) => {
                          const newLines = [...coLines];
                          newLines[idx].description = e.target.value;
                          setCoLines(newLines);
                        }}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Was ($)"
                        value={line.previousAmount || ""}
                        onChange={(e) => {
                          const newLines = [...coLines];
                          newLines[idx].previousAmount = parseFloat(e.target.value) || 0;
                          setCoLines(newLines);
                        }}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Now ($)"
                        value={line.newAmount || ""}
                        onChange={(e) => {
                          const newLines = [...coLines];
                          newLines[idx].newAmount = parseFloat(e.target.value) || 0;
                          setCoLines(newLines);
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ height: "100%", padding: 0 }}
                        onClick={() => setCoLines(coLines.filter((_, i) => i !== idx))}
                        disabled={coLines.length === 1}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-end" }}>
                  Draft Change Order
                </button>
              </form>
            </div>
          )}

          {/* List of existing change orders */}
          <div>
            <h3>Change Order Log</h3>
            {(changeOrdersQuery.data ?? []).length === 0 ? (
              <div className="card empty-state">
                <h2>No change orders drafted yet.</h2>
                <p>Changes over the initial budget minimum trigger change order alerts here.</p>
              </div>
            ) : (
              (changeOrdersQuery.data ?? []).map((order) => {
                const totalText = `${order.totalDelta >= 0 ? "+" : ""}${formatCurrency(order.totalDelta)}`;
                return (
                  <article key={order.id} className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <h4 style={{ fontSize: "1.3rem", margin: 0 }}>CO #{order.number}: {order.title}</h4>
                          <span className={`status-pill ${order.status}`}>{order.status}</span>
                        </div>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          Created {formatDateTime(order.createdAt)}
                          {order.releasedAt && ` · Released ${formatDateTime(order.releasedAt)}`}
                          {order.approvedAt && ` · Signed ${formatDateTime(order.approvedAt)}`}
                        </p>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: order.totalDelta > 0 ? "var(--warning)" : "var(--success)" }}>
                          {totalText}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Signatures: {order.approvalCount} of {order.requiredApprovals}
                        </div>
                      </div>
                    </div>

                    <table className="table" style={{ margin: "1rem 0" }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Swap Details</th>
                          <th style={{ textAlign: "right" }}>Previous</th>
                          <th style={{ textAlign: "right" }}>New</th>
                          <th style={{ textAlign: "right" }}>Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ fontSize: "0.75rem", background: "var(--emerald-soft)", color: "var(--primary-emerald)", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
                                {line.category.split(" - ").slice(-1)[0]}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontWeight: 500 }}>{line.description}</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                  Audit: {formatCurrency(line.previousAmount)} → {formatCurrency(line.newAmount)}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>{formatCurrency(line.previousAmount)}</td>
                            <td style={{ textAlign: "right" }}>{formatCurrency(line.newAmount)}</td>
                            <td style={{ textAlign: "right", color: line.delta > 0 ? "var(--warning)" : "var(--success)", fontWeight: 600 }}>
                              {line.delta >= 0 ? "+" : ""}{formatCurrency(line.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {order.notes && (
                      <p style={{ fontSize: "0.85rem", background: "var(--bg)", padding: "0.5rem 0.85rem", borderRadius: "var(--radius-sm)", color: "var(--text-muted)", margin: "0 0 1rem" }}>
                        <strong>Notes:</strong> {order.notes}
                      </p>
                    )}

                    {/* Stepper progress & Action Panel */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", marginTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Approval Progress:</span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {Array.from({ length: order.requiredApprovals }).map((_, i) => {
                            const isSigned = order.approvalCount > i;
                            return (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: isSigned ? "var(--emerald-soft)" : "var(--bg)",
                                  border: `1px solid ${isSigned ? "var(--success)" : "var(--border)"}`,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                }}
                              >
                                <span style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  background: isSigned ? "var(--success)" : "var(--text-muted)",
                                  color: "#fff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 8,
                                  fontWeight: "bold"
                                }}>
                                  {isSigned ? "✓" : i + 1}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: isSigned ? "var(--success)" : "var(--text-muted)", fontWeight: 500 }}>
                                  {isSigned ? `Signer ${i + 1} Approved` : `Signer ${i + 1} Pending`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        {order.pdfUrl && (
                          <a href={`http://localhost:3001${order.pdfUrl}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            📄 View PDF Spec
                          </a>
                        )}

                        {/* Builder Action buttons */}
                        {isBuilder && order.status === "draft" && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleReleaseChangeOrder(order.id)}>
                            Release for Signatures
                          </button>
                        )}

                        {/* Homeowner Action messages */}
                        {isHomeowner && order.status === "released" && (
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, background: "var(--accent-glow)", padding: "0.4rem 1rem", borderRadius: "var(--radius-sm)", border: "1px dashed var(--accent)" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
                              ✍️ Signature Required.
                            </span>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setActiveSigningCo(order);
                                setTypedSignatureName(project.clientName || "");
                                setSigningError("");
                              }}
                            >
                              Sign Change Order
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- TIMELINE TAB --- */}
      {activeTab === "timeline" && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Project Audit Logs & Selection History</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Chronological log of selections updates, change order releases, and approval events.
              </p>
            </div>
            <div className="relative border-l border-border pl-6 ml-3 space-y-6 py-2">
              {(timelineQuery.data ?? []).map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[31px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary border-4 border-background" />
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{formatDateTime(event.createdAt)}</div>
                  <div className="mt-1">
                    <strong className="text-sm text-foreground">{event.title}</strong>
                    {event.description && <span className="text-xs text-muted-foreground"> — {event.description}</span>}
                    {event.amountBefore !== undefined && event.amountAfter !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1 bg-muted/40 px-2 py-1 rounded inline-block">
                        Price Adjustment: {formatCurrency(event.amountBefore)} → {formatCurrency(event.amountAfter)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- ROOMS SETUP TAB (BUILDER ONLY) --- */}
      {activeTab === "rooms" && isBuilder && (
        <ProjectRoomsSetupTab
          project={project}
          sections={sections}
          onSaveRooms={async (updatedRooms) => {
            await apiPatchProject({ rooms: updatedRooms });
            toast.success("Room configuration saved successfully!");
          }}
        />
      )}

      {/* --- MEMBERS TAB (BUILDER ONLY) --- */}

      {activeTab === "members" && isBuilder && (
        <div className="space-y-6">
          {/* Invite Homeowner */}
          <Card className="border border-border">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Invite Homeowners & Spouse</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Send secure magic links to homeowners. You can assign up to two spouse emails to co-author selections and approvals.
                </p>
              </div>

              <form onSubmit={handleInviteHomeowner} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="spouse@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="w-full sm:w-64 space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e: any) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="primary_homeowner">Primary Spouse Signer</option>
                    <option value="secondary_homeowner">Secondary Spouse Signer</option>
                  </select>
                </div>
                <Button type="submit" variant="default" className="w-full sm:w-auto font-semibold">
                  Send Invitation Link
                </Button>
              </form>
              {inviteError && <p className="text-xs font-semibold text-destructive mt-1">{inviteError}</p>}
              {inviteSuccess && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{inviteSuccess}</p>}
            </CardContent>
          </Card>

          {/* Members List */}
          <Card className="border border-border">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Active Project Partners</h3>
                <p className="text-sm text-muted-foreground mt-1">Spouse signers authorized to sign change orders and review choices.</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Signing Access</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Invite Date</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sign-in Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(projectMembersQuery.data ?? []).map((m: any) => (
                      <tr key={m.id} className="border-b border-border/60 hover:bg-muted/10 transition-colors">
                        <td className="p-3 text-foreground font-semibold">{m.name}</td>
                        <td className="p-3 text-muted-foreground">{m.email}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize text-[10px] font-bold">
                            {m.role.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDateTime(m.invitedAt)}</td>
                        <td className="p-3">
                          {m.acceptedAt ? (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Active (Joined)</span>
                          ) : (
                            <span className="text-xs font-bold text-amber-500">Pending Sign-in</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- FLOATING COMPARE BAR/DRAWER --- */}
      {comparedItems.length > 0 && (
        <>
          <button type="button" className="comparison-drawer-trigger" onClick={() => setIsComparisonOpen(!isComparisonOpen)}>
            ⚖️ Compare Selections ({comparedItems.length}/3)
          </button>

          <div className={`comparison-drawer ${isComparisonOpen ? "open" : ""}`}>
            <div className="comparison-header">
              <h3 style={{ margin: 0, fontFamily: "DM Sans", fontWeight: 700, fontSize: "1.1rem" }}>
                Compare Options Side-by-Side — {comparedItems[0].categoryKey.split(" - ").slice(-1)[0]}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsComparisonOpen(false)}>
                Minimize Comparison
              </button>
            </div>
            <div className="comparison-grid">
              {comparedItems.map((item) => {
                return (
                  <div key={item.id} className="comparison-item-card">
                    <button type="button" className="comparison-remove" onClick={() => toggleCompare(item)}>
                      ✕
                    </button>
                    <div style={{ height: 110, display: "flex", justifyContent: "center" }}>
                      <ProductImage imageUrl={item.imageUrl} alt={item.product} />
                    </div>
                    <h4>{item.manufacturer} {item.model}</h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0.25rem 0 0.5rem" }}>{item.product}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: "0.5rem", fontSize: "0.85rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Level:</span> <LevelBadge level={item.level} /></div>
                      {item.finish && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Finish:</span> <strong>{item.finish}</strong></div>}
                      {item.size && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Size:</span> <strong>{item.size}</strong></div>}
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Price:</span> <strong>{formatCurrency(item.priceMin)}</strong></div>
                      {item.recommendationScore !== undefined && item.recommendationScore > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-hover)" }}>
                          <span>Theme Match:</span>
                          <strong>✨ High ({item.recommendationScore})</strong>
                        </div>
                      )}
                      {(item.tagSlugs || item.tags || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                          {(item.tagSlugs || item.tags).map((t: string) => (
                            <span key={t} style={{ fontSize: "0.65rem", background: "var(--border)", padding: "1px 4px", borderRadius: 3, textTransform: "capitalize" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.specifications && (
                        <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, fontSize: "0.75rem", color: "var(--text-muted)", maxHeight: 85, overflowY: "auto" }}>
                          <strong>Specs:</strong> {item.specifications}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ width: "100%", marginTop: "1rem" }}
                      onClick={() => {
                        handleSelectItem(item.categoryKey, item.id, item.priceMin);
                        setComparedItems([]);
                        setIsComparisonOpen(false);
                      }}
                    >
                      Choose this Item
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* --- DIMENSIONS ZOOM LIGHTBOX --- */}
      {zoomDimensionsUrl && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "2rem" }} onClick={() => setZoomDimensionsUrl(null)}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }} onClick={(e) => e.stopPropagation()}>
            <img src={zoomDimensionsUrl} alt="Dimension Drawing" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", objectFit: "contain" }} />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setZoomDimensionsUrl(null)}
              style={{ position: "absolute", top: -40, right: 0, color: "#fff", background: "rgba(255,255,255,0.15)", border: "none" }}
            >
              ✕ Close Window
            </button>
          </div>
        </div>
      )}

      {/* --- IN-APP CHANGE ORDER SIGNING MODAL OVERLAY --- */}
      {activeSigningCo && (
        <div className="modal-overlay" onClick={() => setActiveSigningCo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontFamily: "Playfair Display, serif" }}>Sign Selection Change Order</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveSigningCo(null)}
                style={{ padding: "0.25rem 0.6rem" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleApproveChangeOrder}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Please review the selections adjustment terms below and provide your digital authorization signature.
                </p>

                {/* Change Order Summary Card */}
                <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <strong style={{ fontSize: "1.1rem", display: "block" }}>CO #{activeSigningCo.number}: {activeSigningCo.title}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Released {formatDateTime(activeSigningCo.releasedAt || activeSigningCo.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: activeSigningCo.totalDelta > 0 ? "var(--warning)" : "var(--success)" }}>
                      {activeSigningCo.totalDelta >= 0 ? "+" : ""}{formatCurrency(activeSigningCo.totalDelta)}
                    </div>
                  </div>

                  <table className="table" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSigningCo.lines.map((line: any, idx: number) => (
                        <tr key={idx}>
                          <td>{line.category.split(" - ").slice(-1)[0]}</td>
                          <td>{line.description}</td>
                          <td style={{ color: line.delta > 0 ? "var(--warning)" : "var(--success)", fontWeight: 600 }}>
                            {line.delta >= 0 ? "+" : ""}{formatCurrency(line.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {activeSigningCo.notes && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)", background: "var(--bg)", padding: "0.4rem 0.6rem", borderRadius: 4 }}>
                      <strong>Notes:</strong> {activeSigningCo.notes}
                    </p>
                  )}
                </div>

                {/* Full Legal Name */}
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="modalTypedName">Full Legal Name</label>
                  <input
                    id="modalTypedName"
                    value={typedSignatureName}
                    onChange={(e) => setTypedSignatureName(e.target.value)}
                    placeholder="e.g. John H. Doe"
                    required
                  />
                </div>

                {/* Signature Mode */}
                <div className="field" style={{ margin: 0 }}>
                  <label>Signature Method</label>
                  <select
                    value={signatureTypeSelection}
                    onChange={(e) => setSignatureTypeSelection(e.target.value as "drawn" | "typed")}
                  >
                    <option value="drawn">Draw Signature (Canvas)</option>
                    <option value="typed">Type Name only (Digital Seal)</option>
                  </select>
                </div>

                {/* Signature Canvas */}
                {signatureTypeSelection === "drawn" && (
                  <div className="field" style={{ margin: 0 }}>
                    <label>Draw Signature</label>
                    <div className="signature-canvas-container" style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: "0.5rem", background: "#fff" }}>
                      <SignatureCanvas
                        ref={signatureRef}
                        penColor="#0B2214"
                        canvasProps={{ width: 560, height: 140, className: "signature-canvas" }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ alignSelf: "flex-end", marginTop: 8 }}
                      onClick={() => signatureRef.current?.clear()}
                    >
                      Clear Pad
                    </button>
                  </div>
                )}

                {/* Cursive Typed Preview */}
                {signatureTypeSelection === "typed" && typedSignatureName && (
                  <div style={{ padding: "1rem", border: "1px dashed var(--accent)", borderRadius: "var(--radius-sm)", background: "var(--bg)", textAlign: "center" }}>
                    <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: "2rem", color: "var(--accent-hover)", fontStyle: "italic" }}>
                      {typedSignatureName}
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>Electronic Seal Signature</div>
                  </div>
                )}

                {/* Geolocation Log */}
                <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={geoConsentChecked}
                    onChange={(e) => setGeoConsentChecked(e.target.checked)}
                  />
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Include approximate device location in audit trail</span>
                </label>

                {signingError && <p className="login-error" style={{ margin: 0 }}>{signingError}</p>}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveSigningCo(null)}
                  disabled={isSubmittingSignature}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingSignature}
                >
                  {isSubmittingSignature ? "Signing..." : "Authorize Change Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Item Detail Modal overlay */}
      {detailItem && (() => {
        const latestItem = libraryItems.find((i) => i.id === detailItem.id) || detailItem;
        const categorySelections = selectionsByCategoryKey.get(latestItem.categoryKey) || [];
        const isSelected = categorySelections.some((s) => s.libraryItemId === latestItem.id);
        const selectedQuantity = categorySelections
          .filter((s) => s.libraryItemId === latestItem.id)
          .reduce((sum, s) => sum + (s.quantity || 1), 0);

        const isDetailLocked = isHomeowner && (
          !!project.projectLocked ||
          (!(project.unlockedCategoryKeys || []).includes(latestItem.categoryKey) &&
           !(project.unlockedCategoryKeys || []).some((key: string) => latestItem.categoryKey.startsWith(key + " - ")) && (
             !!project.proposalSigned ||
             project.status === "selections_submitted" ||
             project.status === "selections_complete"
           ))
        );

        return (
          <ItemDetailModal
            item={latestItem}
            isSelected={isSelected}
            selectedQuantity={selectedQuantity}
            onSelect={() => handleSelectItem(latestItem.categoryKey, latestItem.id, latestItem.priceMin)}
            onDeselect={() => {
              const itemSelections = categorySelections.filter((s) => s.libraryItemId === latestItem.id);
              itemSelections.forEach((s) => handleDeleteSelectionSlot(s.id));
            }}
            onQuantityChange={(newQty) => {
              const itemSelections = categorySelections.filter((s) => s.libraryItemId === latestItem.id);
              if (itemSelections.length > 0) {
                handleUpdateSelectionProperty(itemSelections[0].id, latestItem.categoryKey, { quantity: newQty });
              }
            }}
            multiSelect={true}
            onClose={() => setDetailItem(null)}
            isAdmin={role === "admin" || role === "client"}
            isLocked={isDetailLocked}
          />
        );
      })()}
      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
        themes={themes}
        initialPrimaryEmail={(projectMembersQuery.data || []).find((m: any) => m.role === "primary_homeowner")?.email || ""}
        initialSecondaryEmail={(projectMembersQuery.data || []).find((m: any) => m.role === "secondary_homeowner")?.email || ""}
        onSave={apiPatchProject}
      />
    </div>
  );
}

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  themes: any[];
  initialPrimaryEmail: string;
  initialSecondaryEmail: string;
  onSave: (body: any) => Promise<void>;
}

export function EditProjectModal({ isOpen, onClose, project, themes, initialPrimaryEmail, initialSecondaryEmail, onSave }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.clientName);
  const [address, setAddress] = useState(project.address || "");
  const [themeId, setThemeId] = useState(project.themeId || "");
  const [primaryEmail, setPrimaryEmail] = useState(initialPrimaryEmail);
  const [secondaryEmail, setSecondaryEmail] = useState(initialSecondaryEmail);
  const [requiresDualApproval, setRequiresDualApproval] = useState(project.requiresDualApproval || false);
  const [saving, setSaving] = useState(false);

  // Sync state if initial props change
  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setClientName(project.clientName);
      setAddress(project.address || "");
      setThemeId(project.themeId || "");
      setPrimaryEmail(initialPrimaryEmail);
      setSecondaryEmail(initialSecondaryEmail);
      setRequiresDualApproval(project.requiresDualApproval || false);
    }
  }, [isOpen, project, initialPrimaryEmail, initialSecondaryEmail]);

  if (!isOpen) return null;

  const handleSaveClick = async () => {
    if (!name.trim()) return alert("Project name is required.");
    if (!clientName.trim()) return alert("Client name is required.");
    setSaving(true);
    try {
      await onSave({
        name,
        clientName,
        address,
        themeId: themeId || undefined,
        primaryHomeownerEmail: primaryEmail || undefined,
        secondaryHomeownerEmail: secondaryEmail || undefined,
        requiresDualApproval,
      });
      onClose();
    } catch (err) {
      // toast error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col p-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
            <h3 className="text-lg font-bold text-foreground">✏️ Edit Project Details</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-colors">
              ✕
            </button>
          </div>

          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Project name</label>
                <input className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client</label>
                <input className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Address</label>
                <input className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Project Style Theme</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all cursor-pointer" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
                  <option value="">No Theme / Unassigned</option>
                  {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Primary Homeowner Email</label>
                <input className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" type="email" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} placeholder="homeowner@email.com" />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Spouse Email (Secondary Signer)</label>
                <input className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} placeholder="spouse@email.com" />
              </div>
              <label className="flex items-center gap-3 md:col-span-2 cursor-pointer p-1 rounded-lg hover:bg-muted/50 transition-colors">
                <input type="checkbox" checked={requiresDualApproval} onChange={(e) => setRequiresDualApproval(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="text-xs text-muted-foreground font-semibold">Require dual spouse signatures for Change Orders</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveClick} disabled={saving} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
