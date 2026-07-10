import { useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  useLibrary,
  useCreateLibraryItem,
  useUpdateLibraryItem,
  useDeleteLibraryItem,
  useRestoreLibraryItem,
  useMasterCategories,
  useCreateCategorySection,
  useUpdateCategorySection,
  useDeleteCategorySection,
} from "../api/hooks";
import { LevelBadge } from "../components/LevelBadge";
import { ProductImage } from "../components/ProductImage";
import { formatPriceRange } from "../utils/format";
import type { ApiLibraryItem } from "@2bn/shared";
import type { SelectionLevel } from "../types";
import { uploadBase64 } from "../api/projects";
import { buildCategoryTree, getSelectableNodes, findNodeById } from "../utils/categoryTree";
// lucide-react imports removed as they are unused, avoiding TS6192

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<"active" | "recycle" | "categories">("active");
  const [filterLevel, setFilterLevel] = useState<SelectionLevel | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Fetch active items, deleted items, and master categories
  const activeLibraryQuery = useLibrary({ showDeleted: false });
  const recycleLibraryQuery = useLibrary({ showDeleted: true });
  const masterCategoriesQuery = useMasterCategories();

  // Mutations
  const createItemMutation = useCreateLibraryItem();
  const updateItemMutation = useUpdateLibraryItem();
  const deleteItemMutation = useDeleteLibraryItem();
  const restoreItemMutation = useRestoreLibraryItem();

  const createSectionMutation = useCreateCategorySection();
  const updateSectionMutation = useUpdateCategorySection();
  const deleteSectionMutation = useDeleteSection();

  // UI state for modals, creation, and detail lightboxes
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiLibraryItem | null>(null);
  const [zoomDimensionsUrl, setZoomDimensionsUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  // Categories Manager column selection states
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);

  // Section inline renaming
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  // Group inline renaming
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupCategoryKey, setEditingGroupCategoryKey] = useState("");

  // Subgroup inline renaming
  const [editingSubgroupIndex, setEditingSubgroupIndex] = useState<number | null>(null);
  const [editingSubgroupName, setEditingSubgroupName] = useState("");
  const [editingSubgroupCategoryKey, setEditingSubgroupCategoryKey] = useState("");

  // Custom slots/items inline renaming
  const [editingSlotSubgroupIndex, setEditingSlotSubgroupIndex] = useState<number | null>(null);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [editingSlotName, setEditingSlotName] = useState("");

  // Creation forms states
  const [newSectionName, setNewSectionName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCategoryKey, setNewGroupCategoryKey] = useState("");
  const [newSubgroupName, setNewSubgroupName] = useState("");
  const [newSubgroupCategoryKey, setNewSubgroupCategoryKey] = useState("");
  const [newItemName, setNewItemName] = useState(""); // directly under group
  const [newSlotName, setNewSlotName] = useState(""); // inside a subgroup
  const [activeAddSlotSubgroupIndex, setActiveAddSlotSubgroupIndex] = useState<number | null>(null);

  // Material item creation forms
  const [addForm, setAddForm] = useState({
    category: "",
    level: "1" as SelectionLevel,
    manufacturer: "",
    model: "",
    product: "",
    finish: "",
    priceMin: "",
    priceMax: "",
    imageUrl: "",
    specifications: "",
    size: "",
    dimensionsImageUrl: "",
    tags: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    category: "",
    level: "1" as SelectionLevel,
    manufacturer: "",
    model: "",
    product: "",
    finish: "",
    priceMin: "",
    priceMax: "",
    imageUrl: "",
    specifications: "",
    size: "",
    dimensionsImageUrl: "",
    tags: [] as string[],
  });

  // Safe wrapper for delete section mutation
  function useDeleteSection() {
    return useDeleteCategorySection();
  }

  // Raw data from query
  const sections = useMemo(() => masterCategoriesQuery.data?.sections || [], [masterCategoriesQuery.data]);
  const activeItems = useMemo(() => activeLibraryQuery.data || [], [activeLibraryQuery.data]);
  const recycleItems = useMemo(() => recycleLibraryQuery.data || [], [recycleLibraryQuery.data]);

  // Derived Category Tree
  const categoryTree = useMemo(() => buildCategoryTree(sections), [sections]);
  const selectableLeafNodes = useMemo(() => getSelectableNodes(categoryTree), [categoryTree]);

  // Sync default category to creation form
  useMemo(() => {
    if (selectableLeafNodes.length > 0 && !addForm.category) {
      setAddForm((prev) => ({ ...prev, category: selectableLeafNodes[0].categoryKey }));
    }
  }, [selectableLeafNodes, addForm.category]);

  const selectedSection = useMemo(() => {
    if (!selectedSectionId) return null;
    return sections.find((sec: any) => sec._id === selectedSectionId || sec.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Populate options list for filtering
  const categoryOptions = useMemo(() => {
    return selectableLeafNodes.map((node) => ({
      key: node.categoryKey,
      name: node.label,
    }));
  }, [selectableLeafNodes]);

  // Filter items in active list or recycle bin
  const displayedItems = useMemo(() => {
    const list = activeTab === "active" ? activeItems : recycleItems;
    return list.filter((item) => {
      if (filterLevel !== "all" && item.level !== filterLevel) return false;
      if (filterCategory !== "all" && item.categoryKey !== filterCategory) return false;
      return true;
    });
  }, [activeTab, activeItems, recycleItems, filterLevel, filterCategory]);

  // Image Upload helper
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, field: "imageUrl" | "dimensionsImageUrl", isEdit = false) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(field);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const { url } = await uploadBase64(file.name, base64);
        if (isEdit) {
          setEditForm((prev) => ({ ...prev, [field]: url }));
        } else {
          setAddForm((prev) => ({ ...prev, [field]: url }));
        }
      } catch (err) {
        alert("Upload failed. Please verify file format and size.");
      } finally {
        setIsUploading(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceMin = parseFloat(addForm.priceMin);
    const priceMax = parseFloat(addForm.priceMax || addForm.priceMin);
    if (!addForm.manufacturer || !addForm.model || Number.isNaN(priceMin)) return;

    const matchedNode = selectableLeafNodes.find((n) => n.categoryKey === addForm.category);
    const parentNode = matchedNode && matchedNode.parentId ? findNodeById(categoryTree, matchedNode.parentId) : null;
    const category = parentNode ? parentNode.categoryKey || parentNode.label : addForm.category;
    const selectionSlot = matchedNode ? matchedNode.label : "";

    await createItemMutation.mutateAsync({
      category,
      categoryKey: addForm.category,
      selectionSlot,
      level: addForm.level,
      manufacturer: addForm.manufacturer,
      model: addForm.model,
      product: addForm.product || addForm.model,
      finish: addForm.finish || "—",
      priceMin,
      priceMax,
      imageUrl: addForm.imageUrl.trim() || undefined,
      specifications: addForm.specifications.trim() || undefined,
      size: addForm.size.trim() || undefined,
      dimensionsImageUrl: addForm.dimensionsImageUrl.trim() || undefined,
      tags: addForm.tags,
    });

    setShowAddModal(false);
    setAddForm({
      category: selectableLeafNodes[0]?.categoryKey || "",
      level: "1",
      manufacturer: "",
      model: "",
      product: "",
      finish: "",
      priceMin: "",
      priceMax: "",
      imageUrl: "",
      specifications: "",
      size: "",
      dimensionsImageUrl: "",
      tags: [],
    });
  }

  function startEdit(item: ApiLibraryItem) {
    setEditingItem(item);
    setEditForm({
      category: item.categoryKey || item.category,
      level: item.level as SelectionLevel,
      manufacturer: item.manufacturer,
      model: item.model,
      product: item.product,
      finish: item.finish ?? "",
      priceMin: item.priceMin.toString(),
      priceMax: item.priceMax.toString(),
      imageUrl: item.imageUrl ?? "",
      specifications: item.specifications ?? "",
      size: item.size ?? "",
      dimensionsImageUrl: item.dimensionsImageUrl ?? "",
      tags: item.tags ?? [],
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    const priceMin = parseFloat(editForm.priceMin);
    const priceMax = parseFloat(editForm.priceMax || editForm.priceMin);
    if (!editForm.manufacturer || !editForm.model || Number.isNaN(priceMin)) return;

    const matchedNode = selectableLeafNodes.find((n) => n.categoryKey === editForm.category);
    const parentNode = matchedNode && matchedNode.parentId ? findNodeById(categoryTree, matchedNode.parentId) : null;
    const category = parentNode ? parentNode.categoryKey || parentNode.label : editForm.category;
    const selectionSlot = matchedNode ? matchedNode.label : "";

    await updateItemMutation.mutateAsync({
      id: editingItem.id,
      body: {
        category,
        categoryKey: editForm.category,
        selectionSlot,
        level: editForm.level,
        manufacturer: editForm.manufacturer,
        model: editForm.model,
        product: editForm.product,
        finish: editForm.finish || "—",
        priceMin,
        priceMax,
        imageUrl: editForm.imageUrl.trim() || undefined,
        specifications: editForm.specifications.trim() || undefined,
        size: editForm.size.trim() || undefined,
        dimensionsImageUrl: editForm.dimensionsImageUrl.trim() || undefined,
        tags: editForm.tags,
      },
    });

    setEditingItem(null);
  }

  async function handleSoftDelete(item: ApiLibraryItem) {
    if (confirm(`Are you sure you want to delete ${item.manufacturer} ${item.model}?\nIt will be moved to the Recycle Bin.`)) {
      await deleteItemMutation.mutateAsync(item.id);
    }
  }

  async function handleHardDelete(item: ApiLibraryItem) {
    if (confirm(`WARNING: Are you sure you want to permanently delete ${item.manufacturer} ${item.model}?\nThis action CANNOT be undone.`)) {
      await deleteItemMutation.mutateAsync(item.id);
    }
  }

  async function handleRestore(item: ApiLibraryItem) {
    await restoreItemMutation.mutateAsync(item.id);
  }

  // --- CATEGORY MANAGER CRUD ACTIONS ---
  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    await createSectionMutation.mutateAsync({ name: newSectionName.trim() });
    setNewSectionName("");
  }

  async function handleRenameSection(id: string) {
    if (!editingSectionName.trim()) return;
    await updateSectionMutation.mutateAsync({ id, body: { name: editingSectionName.trim() } });
    setEditingSectionId(null);
    setEditingSectionName("");
  }

  async function handleDeleteSection(id: string) {
    if (confirm("Are you sure you want to delete this selection section? All nested groups will be removed.")) {
      await deleteSectionMutation.mutateAsync(id);
      if (selectedSectionId === id) {
        setSelectedSectionId(null);
        setSelectedGroupIndex(null);
      }
    }
  }

  async function handleMoveSection(section: any, direction: "up" | "down") {
    const idx = sections.findIndex((s: any) => s._id === section._id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const other = sections[targetIdx];
    const tempOrder = section.order;

    await updateSectionMutation.mutateAsync({ id: section._id, body: { order: other.order } });
    await updateSectionMutation.mutateAsync({ id: other._id, body: { order: tempOrder } });
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSection || !newGroupName.trim() || !newGroupCategoryKey.trim()) return;

    const newGroup = {
      name: newGroupName.trim(),
      slug: newGroupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      categoryKey: newGroupCategoryKey.trim(),
      parentGroup: selectedSection.name,
      items: [],
      subgroups: [],
    };

    const groups = [...(selectedSection.groups || []), newGroup];
    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });

    setNewGroupName("");
    setNewGroupCategoryKey("");
  }

  async function handleEditGroupSave(idx: number) {
    if (!selectedSection || !editingGroupName.trim() || !editingGroupCategoryKey.trim()) return;
    const groups = [...(selectedSection.groups || [])];
    groups[idx] = {
      ...groups[idx],
      name: editingGroupName.trim(),
      categoryKey: editingGroupCategoryKey.trim(),
    };

    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });

    setEditingGroupIndex(null);
  }

  async function handleDeleteGroup(idx: number) {
    if (!selectedSection) return;
    if (confirm("Are you sure you want to delete this group? All custom slots and subgroups inside it will be deleted.")) {
      const groups = (selectedSection.groups || []).filter((_: any, i: number) => i !== idx);
      await updateSectionMutation.mutateAsync({
        id: selectedSection._id,
        body: { groups },
      });
      if (selectedGroupIndex === idx) {
        setSelectedGroupIndex(null);
      }
    }
  }

  async function handleMoveGroup(idx: number, direction: "up" | "down") {
    if (!selectedSection) return;
    const groups = [...(selectedSection.groups || [])];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= groups.length) return;

    const temp = groups[idx];
    groups[idx] = groups[targetIdx];
    groups[targetIdx] = temp;

    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });

    if (selectedGroupIndex === idx) {
      setSelectedGroupIndex(targetIdx);
    } else if (selectedGroupIndex === targetIdx) {
      setSelectedGroupIndex(idx);
    }
  }

  // --- Subgroup actions ---
  async function handleAddSubgroup(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSection || selectedGroupIndex === null || !newSubgroupName.trim() || !newSubgroupCategoryKey.trim()) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };

    const newSub = {
      name: newSubgroupName.trim(),
      slug: newSubgroupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      categoryKey: newSubgroupCategoryKey.trim(),
      parentGroup: group.name,
      items: [],
    };

    group.subgroups = [...(group.subgroups || []), newSub];
    groups[selectedGroupIndex] = group;

    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });

    setNewSubgroupName("");
    setNewSubgroupCategoryKey("");
  }

  async function handleEditSubgroupSave(subgroupIndex: number) {
    if (!selectedSection || selectedGroupIndex === null || !editingSubgroupName.trim() || !editingSubgroupCategoryKey.trim()) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };
    const subgroups = [...(group.subgroups || [])];

    subgroups[subgroupIndex] = {
      ...subgroups[subgroupIndex],
      name: editingSubgroupName.trim(),
      categoryKey: editingSubgroupCategoryKey.trim(),
    };

    group.subgroups = subgroups;
    groups[selectedGroupIndex] = group;

    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });

    setEditingSubgroupIndex(null);
  }

  async function handleDeleteSubgroup(subgroupIndex: number) {
    if (!selectedSection || selectedGroupIndex === null) return;
    if (confirm("Are you sure you want to delete this subgroup and all its slots?")) {
      const groups = [...(selectedSection.groups || [])];
      const group = { ...groups[selectedGroupIndex] };
      group.subgroups = (group.subgroups || []).filter((_: any, idx: number) => idx !== subgroupIndex);
      groups[selectedGroupIndex] = group;

      await updateSectionMutation.mutateAsync({
        id: selectedSection._id,
        body: { groups },
      });
    }
  }

  async function handleMoveSubgroup(subgroupIndex: number, direction: "up" | "down") {
    if (!selectedSection || selectedGroupIndex === null) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };
    const subgroups = [...(group.subgroups || [])];
    const targetIdx = direction === "up" ? subgroupIndex - 1 : subgroupIndex + 1;
    if (targetIdx < 0 || targetIdx >= subgroups.length) return;

    const temp = subgroups[subgroupIndex];
    subgroups[subgroupIndex] = subgroups[targetIdx];
    subgroups[targetIdx] = temp;

    group.subgroups = subgroups;
    groups[selectedGroupIndex] = group;

    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });
  }

  async function handleMoveSlot(slotIndex: number, direction: "up" | "down", subgroupIndex: number | null = null) {
    if (!selectedSection || selectedGroupIndex === null) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };

    if (subgroupIndex === null) {
      const items = [...(group.items || [])];
      const targetIdx = direction === "up" ? slotIndex - 1 : slotIndex + 1;
      if (targetIdx < 0 || targetIdx >= items.length) return;

      const temp = items[slotIndex];
      items[slotIndex] = items[targetIdx];
      items[targetIdx] = temp;

      group.items = items;
    } else {
      const subgroups = [...(group.subgroups || [])];
      const sub = { ...subgroups[subgroupIndex] };
      const items = [...(sub.items || [])];
      const targetIdx = direction === "up" ? slotIndex - 1 : slotIndex + 1;
      if (targetIdx < 0 || targetIdx >= items.length) return;

      const temp = items[slotIndex];
      items[slotIndex] = items[targetIdx];
      items[targetIdx] = temp;

      sub.items = items;
      subgroups[subgroupIndex] = sub;
      group.subgroups = subgroups;
    }

    groups[selectedGroupIndex] = group;
    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });
  }

  async function handleEditSlotSave(slotIndex: number, subgroupIndex: number | null = null) {
    if (!selectedSection || selectedGroupIndex === null || !editingSlotName.trim()) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };

    if (subgroupIndex === null) {
      const items = [...(group.items || [])];
      items[slotIndex] = editingSlotName.trim();
      group.items = items;
    } else {
      const subgroups = [...(group.subgroups || [])];
      const sub = { ...subgroups[subgroupIndex] };
      const items = [...(sub.items || [])];
      items[slotIndex] = editingSlotName.trim();
      sub.items = items;
      subgroups[subgroupIndex] = sub;
      group.subgroups = subgroups;
    }

    groups[selectedGroupIndex] = group;
    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });

    setEditingSlotIndex(null);
    setEditingSlotSubgroupIndex(null);
    setEditingSlotName("");
  }

  async function handleDeleteSlot(slotIndex: number, subgroupIndex: number | null = null) {
    if (!selectedSection || selectedGroupIndex === null) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };

    if (subgroupIndex === null) {
      group.items = (group.items || []).filter((_: any, idx: number) => idx !== slotIndex);
    } else {
      const subgroups = [...(group.subgroups || [])];
      const sub = { ...subgroups[subgroupIndex] };
      sub.items = (sub.items || []).filter((_: any, idx: number) => idx !== slotIndex);
      subgroups[subgroupIndex] = sub;
      group.subgroups = subgroups;
    }

    groups[selectedGroupIndex] = group;
    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });
  }

  async function handleAddSlot(e: React.FormEvent, subgroupIndex: number | null = null) {
    e.preventDefault();
    if (!selectedSection || selectedGroupIndex === null) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };

    if (subgroupIndex === null) {
      if (!newItemName.trim()) return;
      group.items = [...(group.items || []), newItemName.trim()];
      setNewItemName("");
    } else {
      const nameToAdd = newSlotName.trim();
      if (!nameToAdd) return;
      const subgroups = [...(group.subgroups || [])];
      const sub = { ...subgroups[subgroupIndex] };
      sub.items = [...(sub.items || []), nameToAdd];
      subgroups[subgroupIndex] = sub;
      group.subgroups = subgroups;
      setNewSlotName("");
    }

    groups[selectedGroupIndex] = group;
    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });
  }

  async function handleConvertGroupToSubgroups() {
    if (!selectedSection || selectedGroupIndex === null) return;
    const groups = [...(selectedSection.groups || [])];
    const group = { ...groups[selectedGroupIndex] };
    if (!group.subgroups) {
      group.subgroups = [];
    }
    if (group.items && group.items.length > 0) {
      if (confirm("Move existing custom slots to a new subgroup?")) {
        const subName = prompt("Enter new subgroup name:", "General") || "General";
        group.subgroups = [
          {
            name: subName,
            slug: subName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
            categoryKey: `${group.categoryKey} - ${subName}`,
            parentGroup: group.name,
            items: [...group.items],
          }
        ];
        group.items = [];
      }
    }
    groups[selectedGroupIndex] = group;
    await updateSectionMutation.mutateAsync({
      id: selectedSection._id,
      body: { groups },
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">Material Catalog</span>
          <h1 className="text-4xl font-extrabold font-serif tracking-tight mt-1 text-foreground">Material Library</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage master selections catalog, specifications, sizing drawings, and recycle states.
          </p>
        </div>
        {activeTab !== "categories" && (
          <Button variant="default" size="lg" onClick={() => setShowAddModal(true)} className="shrink-0 bg-primary hover:bg-primary/95 text-white">
            + Add New Material
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-muted p-1 rounded-xl border border-border w-fit">
        <button
          onClick={() => { setActiveTab("active"); setFilterCategory("all"); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === "active"
              ? "bg-card text-foreground shadow-sm font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Active Assets
          <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded">
            {activeItems.length}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab("recycle"); setFilterCategory("all"); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === "recycle"
              ? "bg-card text-foreground shadow-sm font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Recycle Bin
          {recycleItems.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-destructive/10 text-destructive rounded">
              {recycleItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === "categories"
              ? "bg-card text-foreground shadow-sm font-extrabold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Category Manager
        </button>
      </div>

      {/* Tab Content: Categories Manager */}
      {activeTab === "categories" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1: Sections */}
          <Card className="shadow-sm rounded-2xl border border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  1. Sections
                </h3>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                  Level 1
                </Badge>
              </div>

              <form onSubmit={handleAddSection} className="flex gap-2">
                <Input
                  required
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="New section name..."
                  className="flex-1 text-sm h-9"
                />
                <Button type="submit" variant="default" size="sm" className="font-semibold h-9">
                  Add
                </Button>
              </form>

              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {sections.map((sec: any) => {
                  const isSelected = selectedSectionId === sec._id || selectedSectionId === sec.id;
                  return (
                    <div
                      key={sec._id || sec.id}
                      onClick={() => { setSelectedSectionId(sec._id || sec.id); setSelectedGroupIndex(null); }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {editingSectionId === sec._id ? (
                          <Input
                            autoFocus
                            value={editingSectionName}
                            onChange={(e) => setEditingSectionName(e.target.value)}
                            onBlur={() => handleRenameSection(sec._id)}
                            onKeyDown={(e) => e.key === "Enter" && handleRenameSection(sec._id)}
                            className="flex-1 text-sm h-8"
                          />
                        ) : (
                          <span className={`font-semibold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {sec.name}
                          </span>
                        )}

                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(sec, "up")}
                            className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(sec, "down")}
                            className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingSectionId(sec._id); setEditingSectionName(sec.name); }}
                            className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                            title="Rename"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(sec._id)}
                            className="text-destructive hover:text-destructive/80 text-xs p-0.5 cursor-pointer"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground block mt-1">
                        Groups: {sec.groups?.length ?? 0} | Order: {sec.order}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Column 2: Groups */}
          <Card className="shadow-sm rounded-2xl border border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-primary">2. Groups</h3>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                  Level 2 (Menu)
                </Badge>
              </div>

              {selectedSection ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Adding to Section: <strong>{selectedSection.name}</strong>
                  </p>
                  <form onSubmit={handleAddGroup} className="flex flex-col gap-2">
                    <Input
                      required
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name (e.g. Countertops)..."
                      className="text-sm h-9"
                    />
                    <Input
                      required
                      value={newGroupCategoryKey}
                      onChange={(e) => setNewGroupCategoryKey(e.target.value)}
                      placeholder="Category Key (e.g. Kitchen - Countertops)..."
                      className="text-sm h-9"
                    />
                    <Button type="submit" variant="default" size="sm" className="font-semibold h-9">
                      Add Group
                    </Button>
                  </form>

                  <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {(selectedSection.groups || []).map((group: any, idx: number) => {
                      const isSelected = selectedGroupIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedGroupIndex(idx)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-secondary bg-secondary/10"
                              : "border-border bg-card hover:bg-muted/30"
                          }`}
                        >
                          {editingGroupIndex === idx ? (
                            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                placeholder="Group Name"
                                className="text-sm h-8"
                              />
                              <Input
                                value={editingGroupCategoryKey}
                                onChange={(e) => setEditingGroupCategoryKey(e.target.value)}
                                placeholder="Category Key"
                                className="text-sm h-8"
                              />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" className="h-7 text-xs" onClick={() => handleEditGroupSave(idx)}>Save</Button>
                                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingGroupIndex(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className={`font-semibold text-sm ${isSelected ? "text-secondary-foreground font-bold" : "text-foreground"}`}>
                                  {group.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  Key: {group.categoryKey}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveGroup(idx, "up")}
                                  className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                                  title="Move Group Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveGroup(idx, "down")}
                                  className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                                  title="Move Group Down"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingGroupIndex(idx); setEditingGroupName(group.name); setEditingGroupCategoryKey(group.categoryKey); }}
                                  className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                                  title="Edit Group"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGroup(idx)}
                                  className="text-destructive hover:text-destructive/80 text-xs p-0.5 cursor-pointer"
                                  title="Delete Group"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Select a Section on the left to view nested groups.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 3: Items */}
          <Card className="shadow-sm rounded-2xl border border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-primary">3. Custom Slots / Items</h3>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                  Level 3 (Fields)
                </Badge>
              </div>

              {selectedSection && selectedGroupIndex !== null ? (
                (() => {
                  const group = selectedSection.groups[selectedGroupIndex];
                  const hasSubgroups = group?.subgroups && group.subgroups.length > 0;

                  return (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Group: <strong>{group?.name}</strong>
                      </p>

                      {hasSubgroups ? (
                        // Subgroups view
                        <div className="flex flex-col gap-6">
                          <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto pr-1">
                            {group.subgroups.map((sub: any, subIdx: number) => (
                              <div key={subIdx} className="border border-border rounded-xl p-4 bg-card">
                                {editingSubgroupIndex === subIdx ? (
                                  <div className="flex flex-col gap-2">
                                    <Input
                                      value={editingSubgroupName}
                                      onChange={(e) => setEditingSubgroupName(e.target.value)}
                                      placeholder="Subgroup Name"
                                      className="text-xs h-8"
                                    />
                                    <Input
                                      value={editingSubgroupCategoryKey}
                                      onChange={(e) => setEditingSubgroupCategoryKey(e.target.value)}
                                      placeholder="Category Key"
                                      className="text-xs h-8"
                                    />
                                    <div className="flex gap-2">
                                      <Button type="button" size="sm" className="h-7 text-xs" onClick={() => handleEditSubgroupSave(subIdx)}>Save</Button>
                                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingSubgroupIndex(null)}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/60">
                                    <div>
                                      <strong className="text-xs text-primary">{sub.name}</strong>
                                      <div className="text-[10px] text-muted-foreground">Key: {sub.categoryKey}</div>
                                    </div>
                                    <div className="flex gap-1">
                                      <button type="button" onClick={() => handleMoveSubgroup(subIdx, "up")} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer" title="Move Subgroup Up">▲</button>
                                      <button type="button" onClick={() => handleMoveSubgroup(subIdx, "down")} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer" title="Move Subgroup Down">▼</button>
                                      <button type="button" onClick={() => { setEditingSubgroupIndex(subIdx); setEditingSubgroupName(sub.name); setEditingSubgroupCategoryKey(sub.categoryKey); }} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer" title="Rename Subgroup">✏️</button>
                                      <button type="button" onClick={() => handleDeleteSubgroup(subIdx)} className="text-destructive hover:text-destructive/80 text-xs p-0.5 cursor-pointer" title="Delete Subgroup">🗑️</button>
                                    </div>
                                  </div>
                                )}

                                {/* Nested items/slots */}
                                <div className="flex flex-col gap-2 pl-3">
                                  {(sub.items || []).map((item: string, itemIdx: number) => (
                                    <div key={itemIdx} className="flex items-center justify-between gap-2 p-2 bg-muted/30 border border-border/80 rounded-lg">
                                      {editingSlotSubgroupIndex === subIdx && editingSlotIndex === itemIdx ? (
                                        <Input
                                          autoFocus
                                          value={editingSlotName}
                                          onChange={(e) => setEditingSlotName(e.target.value)}
                                          onBlur={() => handleEditSlotSave(itemIdx, subIdx)}
                                          onKeyDown={(e) => e.key === "Enter" && handleEditSlotSave(itemIdx, subIdx)}
                                          className="flex-1 text-xs h-7"
                                        />
                                      ) : (
                                        <>
                                          <span className="text-xs text-foreground font-medium">{item}</span>
                                          <div className="flex gap-1">
                                            <button type="button" onClick={() => handleMoveSlot(itemIdx, "up", subIdx)} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer">▲</button>
                                            <button type="button" onClick={() => handleMoveSlot(itemIdx, "down", subIdx)} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer">▼</button>
                                            <button type="button" onClick={() => { setEditingSlotSubgroupIndex(subIdx); setEditingSlotIndex(itemIdx); setEditingSlotName(item); }} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer">✏️</button>
                                            <button type="button" onClick={() => handleDeleteSlot(itemIdx, subIdx)} className="text-destructive hover:text-destructive/80 text-xs p-0.5 cursor-pointer">✕</button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}

                                  {/* Add Slot Inline Form */}
                                  <form onSubmit={(e) => handleAddSlot(e, subIdx)} className="flex gap-2 mt-2">
                                    <Input
                                      required
                                      value={activeAddSlotSubgroupIndex === subIdx ? newSlotName : ""}
                                      onChange={(e) => {
                                        setActiveAddSlotSubgroupIndex(subIdx);
                                        setNewSlotName(e.target.value);
                                      }}
                                      placeholder="Add slot to subgroup..."
                                      className="flex-1 text-xs h-8"
                                    />
                                    <Button type="submit" size="sm" variant="outline" className="h-8 w-8 p-0">+</Button>
                                  </form>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add New Subgroup Form */}
                          <form onSubmit={handleAddSubgroup} className="flex flex-col gap-2 pt-4 border-t border-border/80">
                            <strong className="text-xs text-muted-foreground">Add Subgroup</strong>
                            <Input
                              required
                              value={newSubgroupName}
                              onChange={(e) => setNewSubgroupName(e.target.value)}
                              placeholder="Subgroup Name (e.g. Hardwood)"
                              className="text-xs h-8"
                            />
                            <Input
                              required
                              value={newSubgroupCategoryKey}
                              onChange={(e) => setNewSubgroupCategoryKey(e.target.value)}
                              placeholder="Category Key (e.g. Interior - Hardwood)"
                              className="text-xs h-8"
                            />
                            <Button type="submit" size="sm" variant="outline" className="font-semibold h-8">Add Subgroup</Button>
                          </form>
                        </div>
                      ) : (
                        // Direct Items view
                        <>
                          <form onSubmit={(e) => handleAddSlot(e, null)} className="flex gap-2">
                            <Input
                              required
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              placeholder="New slot (e.g. Slab material)..."
                              className="flex-1 text-sm h-9"
                            />
                            <Button type="submit" variant="outline" size="sm" className="font-semibold h-9">Add</Button>
                          </form>

                          <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                            {(group?.items || []).map((item: string, idx: number) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-2"
                              >
                                {editingSlotSubgroupIndex === null && editingSlotIndex === idx ? (
                                  <Input
                                    autoFocus
                                    value={editingSlotName}
                                    onChange={(e) => setEditingSlotName(e.target.value)}
                                    onBlur={() => handleEditSlotSave(idx, null)}
                                    onKeyDown={(e) => e.key === "Enter" && handleEditSlotSave(idx, null)}
                                    className="flex-1 text-sm h-8"
                                  />
                                ) : (
                                  <>
                                    <span className="text-sm text-foreground">{item}</span>
                                    <div className="flex gap-1">
                                      <button type="button" onClick={() => handleMoveSlot(idx, "up", null)} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer">▲</button>
                                      <button type="button" onClick={() => handleMoveSlot(idx, "down", null)} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer">▼</button>
                                      <button type="button" onClick={() => { setEditingSlotSubgroupIndex(null); setEditingSlotIndex(idx); setEditingSlotName(item); }} className="text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer">✏️</button>
                                      <button type="button" onClick={() => handleDeleteSlot(idx, null)} className="text-destructive hover:text-destructive/80 text-sm p-0.5 cursor-pointer">✕</button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {(group?.items || []).length === 0 && (
                              <div className="text-center py-6 text-muted-foreground text-xs">
                                No specific slots added yet. Materials can be added directly to this category.
                              </div>
                            )}
                          </div>

                          <div className="pt-4 border-t border-border/80">
                            <Button type="button" size="sm" variant="outline" className="w-full font-semibold h-9" onClick={handleConvertGroupToSubgroups}>
                              Convert Group to Support Subgroups
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Select a Group in Column 2 to manage items/slots.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Filtering Controls */}
          <Card className="shadow-sm rounded-2xl border border-border">
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Selection Level
                </label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as SelectionLevel | "all")}
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                >
                  <option value="all">All Levels</option>
                  <option value="1">Level 1 — Value</option>
                  <option value="2">Level 2 — Mid</option>
                  <option value="3">Level 3 — Premium</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Category Group
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                >
                  <option value="all">All Categories</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Grid List */}
          {displayedItems.length === 0 ? (
            <Card className="shadow-sm rounded-2xl border border-border">
              <CardContent className="py-16 text-center">
                <h3 className="text-xl font-bold font-serif mb-2 text-foreground">No items found</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Select another level or category, or create a new library item to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayedItems.map((item) => (
                <Card
                  key={item.id}
                  className={`overflow-hidden hover:shadow-lg transition-all duration-300 bg-card border flex flex-col justify-between ${
                    activeTab === "recycle"
                      ? "border-dashed border-destructive/40"
                      : "border-border"
                  }`}
                >
                  {activeTab === "recycle" && (
                    <div className="absolute top-0 right-0 bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl z-10">
                      Archived
                    </div>
                  )}
                  <CardContent className="p-0">
                    <div className="h-48 relative bg-muted/20 border-b border-border/50 overflow-hidden">
                      <ProductImage imageUrl={item.imageUrl} alt={item.product} className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <LevelBadge level={item.level} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.category}</span>
                      </div>

                      <h3 className="text-lg font-bold font-serif leading-snug text-foreground">
                        {item.manufacturer} {item.model}
                      </h3>
                      <p className="text-xs text-muted-foreground">{item.product}</p>
                      {item.finish && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground/75">Finish:</span> {item.finish}</p>}

                      {item.size && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border/40">
                          <strong>Size:</strong> {item.size}
                        </div>
                      )}

                      {item.specifications && (
                        <div className="pt-2 border-t border-border/40">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            <strong>Specs:</strong> {item.specifications.length > 80 ? `${item.specifications.substring(0, 80)}...` : item.specifications}
                          </p>
                        </div>
                      )}

                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] font-medium border-border text-muted-foreground capitalize">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {item.dimensionsImageUrl && (
                        <button
                          type="button"
                          onClick={() => setZoomDimensionsUrl(item.dimensionsImageUrl || null)}
                          className="text-[10px] font-bold text-secondary hover:text-secondary/80 flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          View Dimensions Diagram
                        </button>
                      )}

                      <p className="text-base font-extrabold text-foreground pt-1">
                        {formatPriceRange(item.priceMin, item.priceMax)}
                      </p>
                    </div>
                  </CardContent>

                  <div className="px-5 pb-5 pt-0 flex justify-end gap-2">
                    {activeTab === "active" ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                          Edit Details
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleSoftDelete(item)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="secondary" onClick={() => handleRestore(item)}>
                          Restore Asset
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => handleHardDelete(item)}>
                          Delete Permanently
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddSubmit} className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 border border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-serif text-foreground">Add Custom Material</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowAddModal(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category Slot *</label>
                <select
                  required
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground"
                >
                  {selectableLeafNodes.map((node) => (
                    <option key={node.id} value={node.categoryKey}>
                      {node.label} ({node.categoryKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selection Level *</label>
                <select
                  required
                  value={addForm.level}
                  onChange={(e) => setAddForm({ ...addForm, level: e.target.value as SelectionLevel })}
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground"
                >
                  <option value="1">Level 1 — Value</option>
                  <option value="2">Level 2 — Mid Grade</option>
                  <option value="3">Level 3 — Premium / Luxury</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manufacturer *</label>
                <Input
                  required
                  value={addForm.manufacturer}
                  onChange={(e) => setAddForm({ ...addForm, manufacturer: e.target.value })}
                  placeholder="e.g. Sub-Zero"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Model # *</label>
                <Input
                  required
                  value={addForm.model}
                  onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                  placeholder="e.g. IT-36CI"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Description *</label>
                <Input
                  required
                  value={addForm.product}
                  onChange={(e) => setAddForm({ ...addForm, product: e.target.value })}
                  placeholder="e.g. 36-Inch Built-In French Door Refrigerator"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finish / Color</label>
                <Input
                  value={addForm.finish}
                  onChange={(e) => setAddForm({ ...addForm, finish: e.target.value })}
                  placeholder="e.g. Panel Ready, Stainless Steel"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size / Physical Dims</label>
                <Input
                  value={addForm.size}
                  onChange={(e) => setAddForm({ ...addForm, size: e.target.value })}
                  placeholder="e.g. 36W x 84H x 24D"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price Min ($) *</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={addForm.priceMin}
                  onChange={(e) => setAddForm({ ...addForm, priceMin: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price Max ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={addForm.priceMax}
                  onChange={(e) => setAddForm({ ...addForm, priceMax: e.target.value })}
                />
              </div>

              {/* Uploads */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Photo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "imageUrl")}
                    className="hidden"
                    id="product-photo-upload"
                  />
                  <label
                    htmlFor="product-photo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors shrink-0 text-foreground"
                  >
                    {isUploading === "imageUrl" ? "Uploading..." : "Upload Photo"}
                  </label>
                  <Input
                    value={addForm.imageUrl}
                    onChange={(e) => setAddForm({ ...addForm, imageUrl: e.target.value })}
                    placeholder="Or paste direct image URL (https://...)"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dimensions Drawing (3D Photo)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "dimensionsImageUrl")}
                    className="hidden"
                    id="dimensions-photo-upload"
                  />
                  <label
                    htmlFor="dimensions-photo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors shrink-0 text-foreground"
                  >
                    {isUploading === "dimensionsImageUrl" ? "Uploading..." : "Upload Diagram"}
                  </label>
                  <Input
                    value={addForm.dimensionsImageUrl}
                    onChange={(e) => setAddForm({ ...addForm, dimensionsImageUrl: e.target.value })}
                    placeholder="Or paste direct diagram URL (https://...)"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Style Recommendation Tags</label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {["Modern", "Traditional", "Farmhouse", "Transitional"].map((themeName) => {
                    const tagSlug = themeName.toLowerCase();
                    const isChecked = addForm.tags.includes(tagSlug);
                    return (
                      <label key={tagSlug} className="flex items-center gap-2 cursor-pointer font-medium text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAddForm((prev) => ({
                              ...prev,
                              tags: checked
                                ? [...prev.tags, tagSlug]
                                : prev.tags.filter((t) => t !== tagSlug),
                            }));
                          }}
                          className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary"
                        />
                        {themeName}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Specifications / Detailed Info</label>
                <textarea
                  value={addForm.specifications}
                  onChange={(e) => setAddForm({ ...addForm, specifications: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full font-semibold text-white bg-primary hover:bg-primary/95"
              disabled={createItemMutation.isPending || isUploading !== null}
            >
              {createItemMutation.isPending ? "Saving Material..." : "Save to library"}
            </Button>
          </form>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleEditSubmit} className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 border border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-serif text-foreground">Edit Material Details</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category Slot *</label>
                <select
                  required
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground"
                >
                  {selectableLeafNodes.map((node) => (
                    <option key={node.id} value={node.categoryKey}>
                      {node.label} ({node.categoryKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selection Level *</label>
                <select
                  required
                  value={editForm.level}
                  onChange={(e) => setEditForm({ ...editForm, level: e.target.value as SelectionLevel })}
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-card text-foreground"
                >
                  <option value="1">Level 1 — Value</option>
                  <option value="2">Level 2 — Mid Grade</option>
                  <option value="3">Level 3 — Premium / Luxury</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manufacturer *</label>
                <Input
                  required
                  value={editForm.manufacturer}
                  onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Model # *</label>
                <Input
                  required
                  value={editForm.model}
                  onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Description *</label>
                <Input
                  required
                  value={editForm.product}
                  onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finish / Color</label>
                <Input
                  value={editForm.finish}
                  onChange={(e) => setEditForm({ ...editForm, finish: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size / Physical Dims</label>
                <Input
                  value={editForm.size}
                  onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price Min ($) *</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={editForm.priceMin}
                  onChange={(e) => setEditForm({ ...editForm, priceMin: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price Max ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.priceMax}
                  onChange={(e) => setEditForm({ ...editForm, priceMax: e.target.value })}
                />
              </div>

              {/* Product Photo Edit Upload */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Photo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "imageUrl", true)}
                    className="hidden"
                    id="product-photo-upload-edit"
                  />
                  <label
                    htmlFor="product-photo-upload-edit"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors shrink-0 text-foreground"
                  >
                    {isUploading === "imageUrl" ? "Uploading..." : "Upload Photo"}
                  </label>
                  <Input
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    placeholder="Or paste direct image URL (https://...)"
                  />
                </div>
                {editForm.imageUrl && (
                  <div className="mt-2">
                    <img src={editForm.imageUrl} alt="Preview" className="h-16 rounded-lg border border-border object-cover" />
                  </div>
                )}
              </div>

              {/* Dimensions Image Edit Upload */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dimensions Drawing (3D Photo)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "dimensionsImageUrl", true)}
                    className="hidden"
                    id="dimensions-photo-upload-edit"
                  />
                  <label
                    htmlFor="dimensions-photo-upload-edit"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors shrink-0 text-foreground"
                  >
                    {isUploading === "dimensionsImageUrl" ? "Uploading..." : "Upload Diagram"}
                  </label>
                  <Input
                    value={editForm.dimensionsImageUrl}
                    onChange={(e) => setEditForm({ ...editForm, dimensionsImageUrl: e.target.value })}
                    placeholder="Or paste direct diagram URL (https://...)"
                  />
                </div>
                {editForm.dimensionsImageUrl && (
                  <div className="mt-2">
                    <img src={editForm.dimensionsImageUrl} alt="Preview" className="h-16 rounded-lg border border-border object-cover" />
                  </div>
                )}
              </div>

              {/* Tags Checkboxes */}
              <div className="sm:col-span-2 flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Style Recommendation Tags</label>
                <div className="flex flex-wrap gap-4">
                  {["Modern", "Traditional", "Farmhouse", "Transitional"].map((themeName) => {
                    const tagSlug = themeName.toLowerCase();
                    const isChecked = editForm.tags.includes(tagSlug);
                    return (
                      <label key={tagSlug} className="flex items-center gap-2 cursor-pointer font-medium text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditForm((prev) => ({
                              ...prev,
                              tags: checked
                                ? [...prev.tags, tagSlug]
                                : prev.tags.filter((t) => t !== tagSlug),
                            }));
                          }}
                          className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary"
                        />
                        {themeName}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Specifications / Detailed Info</label>
                <textarea
                  value={editForm.specifications}
                  onChange={(e) => setEditForm({ ...editForm, specifications: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full font-semibold text-white bg-primary hover:bg-primary/95"
              disabled={updateItemMutation.isPending || isUploading !== null}
            >
              {updateItemMutation.isPending ? "Updating Material..." : "Save Changes"}
            </Button>
          </form>
        </div>
      )}

      {/* Dimensions Zoom Lightbox */}
      {zoomDimensionsUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-8"
          onClick={() => setZoomDimensionsUrl(null)}
        >
          <div className="relative max-w-[90%] max-h-[90%]" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomDimensionsUrl}
              alt="Dimension Drawing"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain bg-white p-2"
            />
            <button
              onClick={() => setZoomDimensionsUrl(null)}
              className="absolute -top-10 right-0 text-white font-semibold text-sm hover:text-muted-foreground transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
