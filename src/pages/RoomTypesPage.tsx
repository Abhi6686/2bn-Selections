import { useState, useMemo, useEffect } from "react";
import {
  useRoomTypes,
  useCreateRoomType,
  useUpdateRoomType,
  useDeleteRoomType,
  useMasterCategories,
} from "../api/hooks";
import { Button } from "../components/ui/button";
import {
  Trash2,
  FolderPlus,
  CheckSquare,
  Square,
  ChevronDown,
  Zap,
  X,
  Plus,
  Layers,
  Settings,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { ROOM_PRESETS, findPresetByName } from "../data/roomPresets";

function getDefaultImageForName(name: string): string {
  const preset = findPresetByName(name);
  return preset?.imageUrl ?? "/rooms/master-bedroom.png";
}

interface DeleteConfirmModalProps {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}
function DeleteConfirmModal({ name, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
            <Trash2 size={18} className="text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Delete Room Template</h3>
            <p className="text-xs text-muted-foreground">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Are you sure you want to delete <strong className="text-foreground">"{name}"</strong>? All configured slots will be lost.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-destructive text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoomTypesPage() {
  const { data: roomTypes = [], isLoading: roomTypesLoading } = useRoomTypes();
  const { data: categoriesData } = useMasterCategories();
  const createMutation = useCreateRoomType();
  const updateMutation = useUpdateRoomType();
  const deleteMutation = useDeleteRoomType();

  const [activeRoomTypeId, setActiveRoomTypeId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomIcon, setNewRoomIcon] = useState("🏠");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const emojiOptions = ["🏠","🍳","🛁","🛏️","🧺","🛋️","🚪","🪜","💡","🌳","🚗","🧸","📺","🍽️","🔥","💼","🚿","🌸","🚀","🎮"];
  const sections = ((categoriesData?.sections as any[]) || []).filter((s: any) => s.groups?.length > 0);

  const activeRoomType = useMemo(
    () => roomTypes.find((r) => r.id === activeRoomTypeId) ?? null,
    [roomTypes, activeRoomTypeId]
  );

  const activeSlotsMap = useMemo(() => {
    const map: Record<string, any> = {};
    activeRoomType?.slots.forEach((slot) => { map[slot.categoryKey] = slot; });
    return map;
  }, [activeRoomType]);

  // Auto-expand configured sections and groups when room type changes
  useEffect(() => {
    if (!activeRoomType) return;
    const newExpandedSecs = { ...expandedSections };
    const newExpandedGrps = { ...expandedGroups };
    let changed = false;

    sections.forEach((sec: any) => {
      let hasActiveInSec = false;
      sec.groups?.forEach((grp: any) => {
        const isGrpActive = grp.categoryKey && activeSlotsMap[grp.categoryKey];
        let hasActiveInGrp = isGrpActive;

        grp.subgroups?.forEach((sub: any) => {
          if (sub.categoryKey && activeSlotsMap[sub.categoryKey]) {
            hasActiveInGrp = true;
          }
        });

        if (hasActiveInGrp) {
          hasActiveInSec = true;
          if (!expandedGroups[grp.name]) {
            newExpandedGrps[grp.name] = true;
            changed = true;
          }
        }
      });

      if (hasActiveInSec) {
        if (!expandedSections[sec.name]) {
          newExpandedSecs[sec.name] = true;
          changed = true;
        }
      }
    });

    if (changed) {
      setExpandedSections(newExpandedSecs);
      setExpandedGroups(newExpandedGrps);
    }
  }, [activeRoomTypeId]);

  const filteredRoomTypes = useMemo(() => {
    if (!searchQuery.trim()) return roomTypes;
    return roomTypes.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [roomTypes, searchQuery]);

  const sectionActiveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!activeRoomType) return counts;
    sections.forEach((sec: any) => {
      let count = 0;
      sec.groups?.forEach((grp: any) => {
        if (grp.categoryKey && activeSlotsMap[grp.categoryKey]) count++;
        grp.subgroups?.forEach((sub: any) => { if (sub.categoryKey && activeSlotsMap[sub.categoryKey]) count++; });
      });
      counts[sec.name] = count;
    });
    return counts;
  }, [activeRoomType, sections, activeSlotsMap]);

  const handleCreateRoomType = async () => {
    if (!newRoomName.trim()) return;
    const preset = findPresetByName(newRoomName.trim());
    try {
      const res = await createMutation.mutateAsync({
        name: newRoomName.trim(),
        icon: newRoomIcon,
        slots: preset
          ? preset.defaultCategoryKeys.map((ck) => ({ categoryKey: ck, slotLabel: ck.split(" - ").pop() ?? ck, required: true }))
          : [],
      });
      toast.success(`✨ "${newRoomName}" created!`);
      setActiveRoomTypeId(res.roomType.id);
      setNewRoomName("");
      setNewRoomIcon("🏠");
      setShowCreatePanel(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create room template");
    }
  };

  const handleApplyPreset = async (preset: typeof ROOM_PRESETS[0]) => {
    if (!activeRoomType) return;
    const newSlots = preset.defaultCategoryKeys.map((ck) => ({
      categoryKey: ck,
      slotLabel: ck.split(" - ").pop() ?? ck,
      required: true,
    }));
    try {
      await updateMutation.mutateAsync({ id: activeRoomType.id, body: { slots: newSlots } });
      toast.success(`Preset applied!`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to apply preset");
    }
  };

  const handleSeedPresets = async () => {
    let created = 0;
    for (const preset of ROOM_PRESETS) {
      const exists = roomTypes.find((r) => r.name.toLowerCase() === preset.name.toLowerCase());
      if (!exists) {
        await createMutation.mutateAsync({
          name: preset.name,
          icon: preset.icon,
          slots: preset.defaultCategoryKeys.map((ck) => ({ categoryKey: ck, slotLabel: ck.split(" - ").pop() ?? ck, required: true })),
        });
        created++;
      }
    }
    toast.success(created > 0 ? `Created ${created} preset room templates!` : "All presets already exist");
  };

  const handleDeleteRoomType = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Template deleted");
      if (activeRoomTypeId === deleteTarget.id) setActiveRoomTypeId(roomTypes[0]?.id ?? null);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete template");
    }
  };

  const handleToggleCategory = async (categoryKey: string, defaultLabel: string) => {
    if (!activeRoomType) return;
    let updatedSlots = [...activeRoomType.slots];
    if (activeSlotsMap[categoryKey]) {
      updatedSlots = updatedSlots.filter((s) => s.categoryKey !== categoryKey);
    } else {
      updatedSlots.push({ categoryKey, slotLabel: defaultLabel, required: true });
    }
    try {
      await updateMutation.mutateAsync({ id: activeRoomType.id, body: { slots: updatedSlots } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update slots");
    }
  };

  const handleToggleAllInSection = async (section: any) => {
    if (!activeRoomType) return;
    const allKeys: string[] = [];
    section.groups?.forEach((g: any) => {
      if (g.categoryKey) allKeys.push(g.categoryKey);
      g.subgroups?.forEach((s: any) => { if (s.categoryKey) allKeys.push(s.categoryKey); });
    });
    const allActive = allKeys.length > 0 && allKeys.every((k) => activeSlotsMap[k]);
    let updatedSlots = [...activeRoomType.slots];
    if (allActive) {
      updatedSlots = updatedSlots.filter((s) => !allKeys.includes(s.categoryKey));
    } else {
      const existing = new Set(updatedSlots.map((s) => s.categoryKey));
      allKeys.forEach((k) => {
        if (!existing.has(k)) {
          updatedSlots.push({ categoryKey: k, slotLabel: k.split(" - ").pop() ?? k, required: true });
        }
      });
    }
    try {
      await updateMutation.mutateAsync({ id: activeRoomType.id, body: { slots: updatedSlots } });
      toast.success(allActive ? "Section cleared" : "Section added");
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  };

  const handleUpdateSlotProperty = async (categoryKey: string, updates: Partial<{ slotLabel: string; required: boolean; allowance: number }>) => {
    if (!activeRoomType) return;
    const updatedSlots = activeRoomType.slots.map((slot) =>
      slot.categoryKey !== categoryKey ? slot : { ...slot, ...updates }
    );
    try {
      await updateMutation.mutateAsync({ id: activeRoomType.id, body: { slots: updatedSlots } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  };

  const toggleSection = (name: string) => setExpandedSections((p) => ({ ...p, [name]: !p[name] }));
  const toggleGroup = (name: string) => setExpandedGroups((p) => ({ ...p, [name]: !p[name] }));

  const roomImage = activeRoomType ? getDefaultImageForName(activeRoomType.name) : null;

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden bg-background">
      <Toaster position="top-right" />
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          loading={deleteMutation.isPending}
          onConfirm={handleDeleteRoomType}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* LEFT SIDEBAR */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border bg-card/50 overflow-hidden">
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Room Configurator</p>
              <h1 className="text-lg font-extrabold text-foreground font-serif">Room Library</h1>
            </div>
            <button
              onClick={() => setShowCreatePanel((v) => !v)}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-all cursor-pointer shadow-sm"
            >
              <Plus size={16} />
            </button>
          </div>
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            placeholder="Search rooms…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {showCreatePanel && (
          <div className="p-4 border-b border-border bg-primary/5 shrink-0 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">New Room Type</h3>
              <button onClick={() => setShowCreatePanel(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14} /></button>
            </div>
            <input
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Master Bedroom"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateRoomType()}
            />
            <div className="flex gap-1 flex-wrap">
              {emojiOptions.map((emoji) => (
                <button key={emoji} type="button" onClick={() => setNewRoomIcon(emoji)}
                  className={`w-7 h-7 rounded-md border flex items-center justify-center text-sm transition-all cursor-pointer ${newRoomIcon === emoji ? "border-primary bg-primary/10 scale-105" : "border-border hover:bg-muted"}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <Button onClick={handleCreateRoomType} disabled={!newRoomName.trim() || createMutation.isPending} className="w-full text-xs font-bold h-8 gap-1.5">
              <FolderPlus size={13} /> Create
            </Button>
          </div>
        )}

        {roomTypes.length === 0 && !roomTypesLoading && (
          <div className="p-4 border-b border-border shrink-0">
            <button onClick={handleSeedPresets}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-primary/90 to-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-sm">
              <Zap size={13} /> Load Default Room Presets
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">Creates 10 standard room templates</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filteredRoomTypes.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2">🏗️</div>
              <p className="text-xs text-muted-foreground">No rooms yet.<br />Create your first template above.</p>
            </div>
          )}
          {filteredRoomTypes.map((rt) => {
            const isActive = rt.id === activeRoomTypeId;
            const img = getDefaultImageForName(rt.name);
            return (
              <div key={rt.id}
                onClick={() => setActiveRoomTypeId(rt.id)}
                className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${isActive ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm hover:ring-1 hover:ring-border"}`}>
                <div className="h-20 relative">
                  <img src={img} alt={rt.name} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 transition-all duration-200 ${isActive ? "bg-black/35" : "bg-black/55 group-hover:bg-black/40"}`} />
                  <div className="absolute inset-0 p-3 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <span className="text-lg drop-shadow-lg">{rt.icon}</span>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: rt.id, name: rt.name }); }}
                        className="w-6 h-6 rounded-md bg-white/15 hover:bg-destructive/80 flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold drop-shadow-lg leading-tight">{rt.name}</p>
                      <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{rt.slots.length} categories</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {roomTypes.length > 0 && (
          <div className="p-3 border-t border-border shrink-0">
            <button onClick={handleSeedPresets}
              className="w-full py-2 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Zap size={12} /> Load All Default Presets
            </button>
          </div>
        )}
      </div>

      {/* MAIN PANEL */}
      {activeRoomType ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Room Banner */}
          <div className="relative h-48 shrink-0 overflow-hidden">
            {roomImage && <img src={roomImage} alt={activeRoomType.name} className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl drop-shadow-xl">{activeRoomType.icon}</span>
                  <h2 className="text-2xl font-extrabold text-white font-serif drop-shadow-lg">{activeRoomType.name}</h2>
                </div>
                <p className="text-white/70 text-xs font-semibold">
                  {activeRoomType.slots.length} categories configured · {activeRoomType.slots.filter((s) => s.required).length} required
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {ROOM_PRESETS.filter((preset) => {
                  const activeWords = activeRoomType.name.toLowerCase().split(/\s+/);
                  const presetWords = preset.name.toLowerCase().split(/\s+/);
                  return activeWords.some((w) => presetWords.includes(w) && w.length > 3);
                }).slice(0, 2).map((preset) => (
                  <button key={preset.name} onClick={() => handleApplyPreset(preset)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-sm border border-white/20 transition-all cursor-pointer">
                    <Zap size={12} /> Apply Preset
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Category Tree */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Layers size={15} className="text-primary" /> Select Default Categories
                </h3>
                <span className="text-xs text-muted-foreground bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full">
                  {activeRoomType.slots.length} selected
                </span>
              </div>

              {sections.map((section: any) => {
                const isSecExpanded = !!expandedSections[section.name];
                const activeCount = sectionActiveCounts[section.name] ?? 0;
                let totalCount = 0;
                section.groups?.forEach((g: any) => {
                  if (g.categoryKey) totalCount++;
                  g.subgroups?.forEach((s: any) => { if (s.categoryKey) totalCount++; });
                });
                const allActive = totalCount > 0 && activeCount === totalCount;

                return (
                  <div key={section.name} className="rounded-xl border border-border overflow-hidden shadow-sm">
                    <div
                      className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors ${isSecExpanded ? "bg-primary/5 border-b border-border" : "bg-card hover:bg-muted/30"}`}
                      onClick={() => toggleSection(section.name)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors text-xs font-bold ${activeCount > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {activeCount}
                        </div>
                        <span className="text-sm font-bold text-foreground">{section.name}</span>
                        {activeCount > 0 && (
                          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                            {activeCount}/{totalCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleAllInSection(section); }}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${allActive ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                        >
                          {allActive ? "Clear All" : "Select All"}
                        </button>
                        <ChevronDown size={15} className={`text-muted-foreground transition-transform duration-200 ${isSecExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {isSecExpanded && (
                      <div className="bg-muted/5 divide-y divide-border/50">
                        {section.groups?.map((group: any) => {
                          const hasSubgroups = group.subgroups?.length > 0;
                          const isGrpExpanded = !!expandedGroups[group.name];
                          const isGroupActive = !!activeSlotsMap[group.categoryKey];

                          return (
                            <div key={group.name}>
                              <div className="flex items-center gap-3 px-5 py-3">
                                <button type="button" onClick={() => handleToggleCategory(group.categoryKey, group.name)}
                                  className="text-primary focus:outline-none shrink-0 cursor-pointer hover:scale-110 transition-transform">
                                  {isGroupActive
                                    ? <CheckSquare size={17} className="fill-primary text-primary-foreground" />
                                    : <Square size={17} className="text-muted-foreground" />}
                                </button>
                                <div
                                  className={`flex-1 flex items-center justify-between ${hasSubgroups ? "cursor-pointer" : ""}`}
                                  onClick={() => hasSubgroups && toggleGroup(group.name)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-semibold ${isGroupActive ? "text-foreground" : "text-muted-foreground"}`}>{group.name}</span>
                                    {hasSubgroups && (
                                      <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider scale-90">
                                        Option B: Entire Group
                                      </span>
                                    )}
                                    {group.items?.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{group.items.length} items</span>
                                    )}
                                  </div>
                                  {hasSubgroups && (
                                    <ChevronDown size={13} className={`text-muted-foreground transition-transform ${isGrpExpanded ? "rotate-180" : ""}`} />
                                  )}
                                </div>
                              </div>

                              {!hasSubgroups && isGroupActive && group.items?.length > 0 && (
                                <div className="px-14 pb-3 flex flex-wrap gap-1.5">
                                  {(group.items as string[]).slice(0, 6).map((item: string) => (
                                    <span key={item} className="text-[10px] bg-primary/8 text-primary/70 px-2 py-0.5 rounded-full border border-primary/15">{item}</span>
                                  ))}
                                  {group.items.length > 6 && (
                                    <span className="text-[10px] text-muted-foreground px-2 py-0.5">+{group.items.length - 6} more</span>
                                  )}
                                </div>
                              )}

                              {hasSubgroups && isGrpExpanded && (
                                <div className="pl-10 pr-4 pb-3 space-y-1 border-t border-border/40 bg-muted/5">
                                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-2.5 pb-1 pl-1">
                                    Option A: Granular Sub-categories
                                  </div>
                                  {group.subgroups.map((sub: any) => {
                                    const isSubActive = !!activeSlotsMap[sub.categoryKey];
                                    return (
                                      <div key={sub.name}>
                                        <div className="flex items-center gap-3 py-2">
                                          <button type="button" onClick={() => handleToggleCategory(sub.categoryKey, sub.name)}
                                            className="text-primary focus:outline-none shrink-0 cursor-pointer hover:scale-110 transition-transform">
                                            {isSubActive
                                              ? <CheckSquare size={15} className="fill-primary text-primary-foreground" />
                                              : <Square size={15} className="text-muted-foreground" />}
                                          </button>
                                          <span className={`text-xs font-medium ${isSubActive ? "text-foreground" : "text-muted-foreground"}`}>{sub.name}</span>
                                          {sub.items?.length > 0 && (
                                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-auto">{sub.items.length} items</span>
                                          )}
                                        </div>
                                        {isSubActive && sub.items?.length > 0 && (
                                          <div className="pl-8 pb-2 flex flex-wrap gap-1.5">
                                            {(sub.items as string[]).slice(0, 5).map((item: string) => (
                                              <span key={item} className="text-[10px] bg-primary/8 text-primary/70 px-2 py-0.5 rounded-full border border-primary/15">{item}</span>
                                            ))}
                                            {sub.items.length > 5 && (
                                              <span className="text-[10px] text-muted-foreground">+{sub.items.length - 5}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Slots Config Panel */}
            {activeRoomType.slots.length > 0 && (
              <div className="w-80 shrink-0 border-l border-border overflow-y-auto bg-card/30">
                <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <Settings size={14} className="text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">Slot Config</span>
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{activeRoomType.slots.length}</span>
                </div>
                <div className="p-3 space-y-2">
                  {activeRoomType.slots.map((slot) => (
                    <div key={slot.categoryKey}
                      className="p-3 border border-border/80 bg-card rounded-xl space-y-2.5 group hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full tracking-wide uppercase truncate block w-fit max-w-full">
                            {slot.categoryKey.split(" - ").slice(-1)[0]}
                          </span>
                          <input
                            className="text-xs font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none mt-1.5 w-full"
                            value={slot.slotLabel}
                            onChange={(e) => handleUpdateSlotProperty(slot.categoryKey, { slotLabel: e.target.value })}
                            placeholder="Label…"
                          />
                        </div>
                        <button onClick={() => handleToggleCategory(slot.categoryKey, slot.slotLabel)}
                          className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 mt-1">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={slot.required}
                            onChange={(e) => handleUpdateSlotProperty(slot.categoryKey, { required: e.target.checked })}
                            className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary" />
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Required</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-semibold">$</span>
                          <input type="number" value={slot.allowance ?? ""}
                            onChange={(e) => handleUpdateSlotProperty(slot.categoryKey, { allowance: parseFloat(e.target.value) || undefined })}
                            placeholder="Allowance"
                            className="px-1.5 py-1 border border-input rounded-md bg-background text-[10px] w-20 focus:outline-none focus:ring-1 focus:ring-primary/40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🏠</span>
            </div>
            <h2 className="text-xl font-bold text-foreground font-serif mb-2">No Room Selected</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Select a room template from the left panel to configure its categories and slots.
            </p>
            {roomTypes.length === 0 && (
              <button onClick={handleSeedPresets}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all cursor-pointer flex items-center gap-2 mx-auto">
                <Zap size={15} /> Load Default Room Presets
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
