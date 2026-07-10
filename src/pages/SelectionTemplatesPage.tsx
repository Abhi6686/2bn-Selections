import { useState, useMemo } from "react";
import {
  useSelectionTemplates,
  useCreateSelectionTemplate,
  useUpdateSelectionTemplate,
  useDeleteSelectionTemplate,
  useMasterCategories,
  useLibrary,
  useProjects,
  useApplySelectionTemplate,
} from "../api/hooks";
import { formatCurrency } from "../utils/format";
import { LevelBadge } from "../components/LevelBadge";
import { ProductImage } from "../components/ProductImage";
import { useAuth } from "../context/AuthContext";
import {
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  X,
  FolderOpen

} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface TemplateSelectionItem {
  libraryItemId: string;
  quantity: number;
  priceUsed?: number;
  slotLabel?: string;
}

export function SelectionTemplatesPage() {
  const { role } = useAuth();
  const isBuilder = role === "admin" || role === "project_manager" || role === "client";

  const { data: templates = [], isLoading: templatesLoading } = useSelectionTemplates();
  const createTemplateMutation = useCreateSelectionTemplate();
  const updateTemplateMutation = useUpdateSelectionTemplate();
  const deleteTemplateMutation = useDeleteSelectionTemplate();
  const masterCatsQuery = useMasterCategories();
  const libraryQuery = useLibrary();
  const { data: projects = [] } = useProjects();

  const sections = (masterCatsQuery.data?.sections as any[]) ?? [];
  const libraryItems = libraryQuery.data ?? [];

  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<{ templateId: string; templateName: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"org" | "project" | "personal">("org");
  const [tags, setTags] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [active, setActive] = useState(true);
  
  const [formSelections, setFormSelections] = useState<Record<string, TemplateSelectionItem[]>>({});
  const [activeFormSectionIndex, setActiveFormSectionIndex] = useState(0);
  const [activeFormCategoryKey, setActiveFormCategoryKey] = useState<string | null>(null);

  const applyTemplateMutation = useApplySelectionTemplate(selectedProjectId);

  const categoryLibraryItems = useMemo(() => {
    if (!activeFormCategoryKey) return [];
    return libraryItems.filter((item) => item.categoryKey === activeFormCategoryKey);
  }, [libraryItems, activeFormCategoryKey]);

  function handleAddClick() {
    setName("");
    setDescription("");
    setVisibility("org");
    setTags("");
    setIsDefault(false);
    setActive(true);
    setFormSelections({});
    setEditingTemplate(null);
    setIsFormOpen(true);
    
    if (sections.length > 0) {
      setActiveFormSectionIndex(0);
      const firstGroup = sections[0].groups?.[0];
      if (firstGroup) {
        if (firstGroup.subgroups && firstGroup.subgroups.length > 0) {
          setActiveFormCategoryKey(firstGroup.subgroups[0].categoryKey);
        } else {
          setActiveFormCategoryKey(firstGroup.categoryKey);
        }
      }
    }
  }

  function handleEditClick(template: any) {
    setName(template.name);
    setDescription(template.description || "");
    setVisibility(template.visibility);
    setTags(template.tags?.join(", ") || "");
    setIsDefault(template.isDefault);
    setActive(template.active);
    setFormSelections(template.selections || {});
    setEditingTemplate(template);
    setIsFormOpen(true);

    if (sections.length > 0) {
      setActiveFormSectionIndex(0);
      const firstGroup = sections[0].groups?.[0];
      if (firstGroup) {
        if (firstGroup.subgroups && firstGroup.subgroups.length > 0) {
          setActiveFormCategoryKey(firstGroup.subgroups[0].categoryKey);
        } else {
          setActiveFormCategoryKey(firstGroup.categoryKey);
        }
      }
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }

    const tagsArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      visibility,
      selections: formSelections,
      coveredSections: sections
        .filter((sec) => 
          sec.groups.some((group: any) => {
            const hasGroupSel = formSelections[group.categoryKey]?.length > 0;
            const hasSubSel = group.subgroups?.some((sub: any) => formSelections[sub.categoryKey]?.length > 0);
            return hasGroupSel || hasSubSel;
          })
        )
        .map((sec) => sec.slug),
      tags: tagsArray,
      isDefault,
      active,
    };

    try {
      if (editingTemplate) {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          body: payload,
        });
        toast.success("Template updated successfully!");
      } else {
        await createTemplateMutation.mutateAsync(payload);
        toast.success("Template created successfully!");
      }
      setIsFormOpen(false);
      setEditingTemplate(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save template.");
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm("Are you sure you want to archive this template?")) return;
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
      toast.success("Template archived successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template.");
    }
  }

  function handleAddLibraryItemToTemplate(item: any) {
    if (!activeFormCategoryKey) return;
    
    const existingSelections = formSelections[activeFormCategoryKey] || [];
    if (existingSelections.some((s) => s.libraryItemId === item.id)) {
      toast.error("Item already selected for this slot.");
      return;
    }

    const newItem: TemplateSelectionItem = {
      libraryItemId: item.id,
      quantity: 1,
      priceUsed: item.priceMin,
      slotLabel: "",
    };

    setFormSelections((prev) => ({
      ...prev,
      [activeFormCategoryKey]: [...existingSelections, newItem],
    }));
  }

  function handleRemoveLibraryItemFromTemplate(itemId: string) {
    if (!activeFormCategoryKey) return;
    const existingSelections = formSelections[activeFormCategoryKey] || [];
    setFormSelections((prev) => ({
      ...prev,
      [activeFormCategoryKey]: existingSelections.filter((s) => s.libraryItemId !== itemId),
    }));
  }

  function handleUpdateTemplateSelection(itemId: string, updates: Partial<TemplateSelectionItem>) {
    if (!activeFormCategoryKey) return;
    const existingSelections = formSelections[activeFormCategoryKey] || [];
    setFormSelections((prev) => ({
      ...prev,
      [activeFormCategoryKey]: existingSelections.map((s) =>
        s.libraryItemId === itemId ? { ...s, ...updates } : s
      ),
    }));
  }

  async function handleApplyTemplate() {
    if (!applyTarget || !selectedProjectId) return;
    try {
      await applyTemplateMutation.mutateAsync({
        templateId: applyTarget.templateId,
      });
      toast.success(`Applied template "${applyTarget.templateName}" successfully!`);
      setApplyTarget(null);
      setSelectedProjectId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to apply template.");
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6 animate-in fade-in duration-300">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">Selection Templates & Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pre-configure specifications or packages (e.g. Modern Level 1, Farmhouse Value) to apply instantly to client projects.
          </p>
        </div>
        {isBuilder && !isFormOpen && (
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            onClick={handleAddClick}
          >
            <Plus size={16} /> Create Template
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {templatesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-card border border-border rounded-2xl h-56 animate-pulse" />
          ))}
        </div>
      ) : isFormOpen ? (
        /* TEMPLATE CREATE / EDIT WORKSPACE */
        <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-8 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h2 className="text-xl font-bold text-foreground">{editingTemplate ? `Edit Template: ${editingTemplate.name}` : "Create Selection Template"}</h2>
            <div className="flex gap-3">
              <button type="button" className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer" onClick={() => setIsFormOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all cursor-pointer">
                Save Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Template Name</label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all duration-200"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Contemporary Contemporary Tier"
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Visibility Profile</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all duration-200 cursor-pointer"
                value={visibility}
                onChange={(e: any) => setVisibility(e.target.value)}
              >
                <option value="org">Organization Wide (All PMs / Builders)</option>
                <option value="project">Project Specific (Link to a plan type)</option>
                <option value="personal">Personal Draft (Only visible to you)</option>
              </select>
            </div>
            <div className="flex flex-col md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all duration-200"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this design profile (e.g. Minimalist appliances, black steel finish for modern homes)."
                rows={3}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Tags (Comma separated)</label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all duration-200"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. Modern, Farmhouse, Luxury, Mid-Tier"
              />
            </div>
            <div className="flex items-center gap-6 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground font-semibold">Set as Organization Default Template</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground font-semibold">Active</span>
              </label>
            </div>
          </div>

          {/* Slot selection editor */}
          <div className="border-t border-border pt-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Pre-Select Library Items</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              {/* Category Tree Navigation inside Form */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border h-[450px] overflow-y-auto space-y-3">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Select Category</h4>
                {sections.map((section, secIdx) => {
                  const isSecActive = activeFormSectionIndex === secIdx;
                  return (
                    <div key={section.slug} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setActiveFormSectionIndex(secIdx)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSecActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {section.name}
                      </button>
                      
                      {isSecActive && (
                        <div className="pl-3 mt-1 flex flex-col gap-1 border-l border-border/80 ml-2">
                          {section.groups.map((group: any) => {
                            if (group.subgroups && group.subgroups.length > 0) {
                              return (
                                <div key={group.slug} className="space-y-1 py-1">
                                  <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider px-2">
                                    {group.name}
                                  </div>
                                  {group.subgroups.map((sub: any) => {
                                    const isCatActive = activeFormCategoryKey === sub.categoryKey;
                                    const selCount = formSelections[sub.categoryKey]?.length || 0;
                                    return (
                                      <button
                                        key={sub.slug}
                                        type="button"
                                        onClick={() => setActiveFormCategoryKey(sub.categoryKey)}
                                        className={`w-full text-left px-2 py-1 rounded-md text-xs transition-all flex justify-between items-center cursor-pointer ${
                                          isCatActive ? "bg-primary/5 text-primary font-bold" : "text-muted-foreground hover:bg-muted/50"
                                        }`}
                                      >
                                        <span className="truncate">{sub.name}</span>
                                        {selCount > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{selCount}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            } else {
                              const isCatActive = activeFormCategoryKey === group.categoryKey;
                              const selCount = formSelections[group.categoryKey]?.length || 0;
                              return (
                                <button
                                  key={group.slug}
                                  type="button"
                                  onClick={() => setActiveFormCategoryKey(group.categoryKey)}
                                  className={`w-full text-left px-2 py-1 rounded-md text-xs transition-all flex justify-between items-center cursor-pointer ${
                                    isCatActive ? "bg-primary/5 text-primary font-bold" : "text-muted-foreground hover:bg-muted/50"
                                  }`}
                                >
                                  <span className="truncate">{group.name}</span>
                                  {selCount > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{selCount}</span>}
                                </button>
                              );
                            }
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selection slots right panel */}
              <div className="space-y-6">
                {activeFormCategoryKey ? (
                  <>
                    <div className="bg-muted/30 border border-border p-6 rounded-xl space-y-4">
                      <h4 className="text-sm font-bold text-foreground">Current selections for <span className="text-primary">{activeFormCategoryKey}</span></h4>
                      
                      {(!formSelections[activeFormCategoryKey] || formSelections[activeFormCategoryKey].length === 0) ? (
                        <p className="text-xs text-muted-foreground italic">No items chosen yet for this category.</p>
                      ) : (
                        <div className="space-y-3">
                          {formSelections[activeFormCategoryKey].map((sel) => {
                            const libraryItem = libraryItems.find((li) => li.id === sel.libraryItemId);
                            if (!libraryItem) return null;

                            return (
                              <div key={sel.libraryItemId} className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border border-border items-start sm:items-center">
                                <div className="w-12 h-12 shrink-0 bg-white border border-border rounded-lg overflow-hidden p-0.5">
                                  <ProductImage imageUrl={libraryItem.imageUrl} alt={libraryItem.product} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <LevelBadge level={libraryItem.level} />
                                    <span className="font-bold text-xs text-foreground truncate">{libraryItem.manufacturer} {libraryItem.model}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground block truncate mt-0.5">{libraryItem.product}</span>
                                </div>
                                
                                <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
                                  <div className="flex flex-col">
                                    <label className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Slot/Location Label</label>
                                    <input
                                      type="text"
                                      value={sel.slotLabel || ""}
                                      onChange={(e) => handleUpdateTemplateSelection(sel.libraryItemId, { slotLabel: e.target.value })}
                                      placeholder="e.g. Kitchen, Laundry Room"
                                      className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs w-40"
                                    />
                                  </div>

                                  <div className="flex flex-col">
                                    <label className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Qty</label>
                                    <input
                                      type="number"
                                      value={sel.quantity}
                                      onChange={(e) => handleUpdateTemplateSelection(sel.libraryItemId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                      min={1}
                                      className="px-2 py-1.5 rounded-lg border border-input bg-background text-xs w-16"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLibraryItemFromTemplate(sel.libraryItemId)}
                                    className="p-2 text-destructive hover:bg-destructive/5 rounded-lg transition-colors cursor-pointer mt-3"
                                    title="Remove from template"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Catalog for slot selections */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Available Catalog Options to Add</h4>
                      {categoryLibraryItems.length === 0 ? (
                        <div className="bg-muted/10 border border-dashed border-border p-8 text-center rounded-xl text-xs text-muted-foreground">No items found in Material Library for this category. Add items first.</div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[320px] overflow-y-auto pr-2">
                          {categoryLibraryItems.map((item) => {
                            const isAlreadySelected = (formSelections[activeFormCategoryKey] || []).some(
                              (s) => s.libraryItemId === item.id
                            );
                            return (
                              <div
                                key={item.id}
                                className={`bg-card rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-all hover:border-primary/40 ${
                                  isAlreadySelected ? "border-primary/20 bg-primary/5" : "border-border"
                                }`}
                              >
                                <div className="flex gap-3">
                                  <div className="w-12 h-12 bg-white border border-border rounded-lg p-0.5 shrink-0 flex items-center justify-center">
                                    <ProductImage imageUrl={item.imageUrl} alt={item.product} />
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-xs text-foreground truncate">{item.manufacturer} {item.model}</h5>
                                    <span className="text-[10px] text-muted-foreground block truncate mt-0.5">{item.product}</span>
                                    <div className="mt-1"><LevelBadge level={item.level} /></div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-border/60 pt-2.5 mt-1">
                                  <span className="text-xs font-extrabold text-primary">{formatCurrency(item.priceMin)}</span>
                                  <button
                                    type="button"
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      isAlreadySelected ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
                                    }`}
                                    disabled={isAlreadySelected}
                                    onClick={() => handleAddLibraryItemToTemplate(item)}
                                  >
                                    {isAlreadySelected ? "Added" : "+ Add"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col justify-center items-center h-full text-center border border-dashed border-border rounded-xl p-12 bg-muted/10 text-muted-foreground text-sm">
                    <FolderOpen size={36} className="mb-2 text-muted-foreground/55" />
                    Select a category from the tree to add selection slots.
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* TEMPLATES LIST GRID */
        <>
          {templates.length === 0 ? (
            <div className="bg-card border border-border p-12 text-center rounded-2xl shadow-sm space-y-4 max-w-md mx-auto mt-12 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl mx-auto">📁</div>
              <h2 className="text-lg font-bold text-foreground">No templates configured</h2>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">Create your first selection template profile to standardise client options.</p>
              {isBuilder && (
                <button type="button" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer" onClick={handleAddClick}>
                  Create First Template
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
              {templates.map((template) => {
                const selectionsCount = Object.values(template.selections || {}).reduce(
                  (sum: number, list: any) => sum + (list?.length || 0),
                  0
                );

                return (
                  <div key={template.id} className="bg-card border border-border rounded-2xl p-6 relative flex flex-col justify-between transition-all hover:shadow-md hover:border-border/80">
                    {template.isDefault && (
                      <span className="absolute top-4 right-4 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Sparkles size={10} /> Default
                      </span>
                    )}

                    <div className="space-y-4">
                      <div className="pr-16">
                        <h3 className="font-serif text-lg font-semibold text-foreground leading-tight truncate">{template.name}</h3>
                      </div>
                      
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-[10px] bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          {template.visibility}
                        </span>
                        {template.tags?.map((t) => (
                          <span key={t} className="text-[10px] bg-muted border border-border px-2 py-0.5 rounded-md font-medium text-muted-foreground">
                            #{t}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 min-h-[54px]">
                        {template.description || "No description provided."}
                      </p>

                      <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                        Pre-selected items: <strong className="text-foreground">{selectionsCount} items</strong>
                      </div>
                    </div>

                    {isBuilder && (
                      <div className="flex justify-between items-center border-t border-border/60 pt-4 mt-6">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer"
                          onClick={() => handleEditClick(template)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            onClick={() => setApplyTarget({ templateId: template.id, templateName: template.name })}
                          >
                            Apply to Project
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDelete(template.id)}
                            className="p-1.5 text-destructive hover:bg-destructive/5 rounded-lg transition-colors cursor-pointer"
                            title="Delete template"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* APPLY TEMPLATE MODAL */}
      {applyTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setApplyTarget(null); setSelectedProjectId(""); }} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-foreground text-base">Apply Selection Template</h3>
              <button
                type="button"
                onClick={() => { setApplyTarget(null); setSelectedProjectId(""); }}
                className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Choose a project below. Applying the template "<strong>{applyTarget.templateName}</strong>" will overwrite existing selections in this project for the covered categories.
            </p>

            <div className="flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Select Project</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all duration-200 cursor-pointer"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">-- Choose project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.clientName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-border">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer"
                onClick={() => { setApplyTarget(null); setSelectedProjectId(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedProjectId || applyTemplateMutation.isPending}
                onClick={handleApplyTemplate}
              >
                {applyTemplateMutation.isPending ? "Applying..." : "Apply Template"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}



