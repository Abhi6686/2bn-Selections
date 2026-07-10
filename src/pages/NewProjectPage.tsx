import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProject, useThemes, useRoomTypes } from "../api/hooks";
import * as projectsApi from "../api/projects";
import { isApiMode } from "../config/api";
import { useApp } from "../context/AppContext";
import { ArrowLeft, ArrowRight, Plus, Minus, Check, Home, Copy } from "lucide-react";
import { findPresetByName } from "../data/roomPresets";
import type { ApiRoomType } from "@2bn/shared";

// ─── Step 0: Project Details ────────────────────────────────────────────────
// ─── Step 1: Room Configuration ─────────────────────────────────────────────
// ─── Step 2+: Selection Wizard ───────────────────────────────────────────────

interface SelectedRoom {
  roomTypeId: string;
  customName: string;
  instanceKey: string; // unique per instance (roomTypeId + index)
}

function getImageForRoomType(rt: ApiRoomType): string {
  const preset = findPresetByName(rt.name);
  return preset?.imageUrl ?? "/rooms/master-bedroom.png";
}

// ─── Room card for the visual picker ─────────────────────────────────────────
interface RoomPickerCardProps {
  roomType: ApiRoomType;
  instances: SelectedRoom[];
  onAdd: () => void;
  onRemove: (instanceKey: string) => void;
  onDuplicate: (instanceKey: string) => void;
}
function RoomPickerCard({ roomType, instances, onAdd, onRemove, onDuplicate }: RoomPickerCardProps) {
  const count = instances.length;
  const img = getImageForRoomType(roomType);

  return (
    <div className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-200 group ${count > 0 ? "border-primary shadow-lg shadow-primary/10" : "border-transparent hover:border-border"}`}>
      {/* Background image */}
      <div className="h-44 relative overflow-hidden">
        <img src={img} alt={roomType.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className={`absolute inset-0 transition-all duration-200 ${count > 0 ? "bg-black/40" : "bg-black/55 group-hover:bg-black/45"}`} />

        {/* Selected checkmark badge */}
        {count > 0 && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
            <Check size={14} className="text-white" strokeWidth={3} />
          </div>
        )}

        {/* Room count badge */}
        {count > 1 && (
          <div className="absolute top-3 left-3 bg-primary/90 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
            ×{count}
          </div>
        )}

        {/* Room info */}
        <div className="absolute bottom-0 inset-x-0 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl drop-shadow-lg">{roomType.icon}</span>
            <div>
              <p className="text-white font-bold text-sm drop-shadow-lg leading-tight">{roomType.name}</p>
              <p className="text-white/60 text-[10px] font-semibold">{roomType.slots.length} selection slots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-card p-3 space-y-2">
        {count === 0 ? (
          <button onClick={onAdd}
            className="w-full py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-primary/20 hover:border-primary/40">
            <Plus size={13} /> Add Room
          </button>
        ) : (
          <div className="space-y-1.5">
            {instances.map((inst, idx) => (
              <div key={inst.instanceKey} className="flex items-center justify-between bg-primary/5 rounded-lg px-2.5 py-1.5 border border-primary/15">
                <span className="text-xs font-semibold text-foreground truncate flex-1 mr-2">
                  {count > 1 ? `${roomType.name} ${idx + 1}` : roomType.name}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => onDuplicate(inst.instanceKey)}
                    className="w-5 h-5 rounded-md bg-muted hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    title="Duplicate (add another of this room)">
                    <Copy size={10} />
                  </button>
                  <button onClick={() => onRemove(inst.instanceKey)}
                    className="w-5 h-5 rounded-md bg-muted hover:bg-destructive/20 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all cursor-pointer">
                    <Minus size={10} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={onAdd}
              className="w-full py-1.5 rounded-lg border border-dashed border-primary/30 text-primary/70 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer hover:border-primary hover:text-primary">
              <Plus size={11} /> Add Another {roomType.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function NewProjectPage() {
  const navigate = useNavigate();
  const { createProject } = useApp();
  const themesQuery = useThemes();
  const createProjectMutation = useCreateProject();
  const roomTypesQuery = useRoomTypes();

  const [step, setStep] = useState(0); // 0=details, 1=rooms
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [themeId, setThemeId] = useState("");
  const [requiresDualApproval, setRequiresDualApproval] = useState(false);
  const [primaryHomeownerEmail, setPrimaryHomeownerEmail] = useState("");
  const [secondaryHomeownerEmail, setSecondaryHomeownerEmail] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>([]);

  const roomTypes: ApiRoomType[] = roomTypesQuery.data ?? [];

  const applyDefaultTemplate = async (projectId: string) => {
    try {
      const templates = await projectsApi.fetchSelectionTemplates();
      const defaultTemplate = templates.templates.find((t: any) => t.isDefault && t.active);
      if (defaultTemplate) {
        await projectsApi.applySelectionTemplate(projectId, defaultTemplate.id);
      }
    } catch {}
  };

  // Room selection handlers
  const handleAddRoom = (rt: ApiRoomType) => {
    const existingCount = selectedRooms.filter((r) => r.roomTypeId === rt.id).length;
    setSelectedRooms((prev) => [
      ...prev,
      { roomTypeId: rt.id, customName: existingCount > 0 ? `${rt.name} ${existingCount + 1}` : rt.name, instanceKey: `${rt.id}-${Date.now()}` },
    ]);
  };

  const handleRemoveRoom = (instanceKey: string) => {
    setSelectedRooms((prev) => prev.filter((r) => r.instanceKey !== instanceKey));
  };

  const handleDuplicateRoom = (instanceKey: string) => {
    const original = selectedRooms.find((r) => r.instanceKey === instanceKey);
    if (!original) return;
    const rt = roomTypes.find((r) => r.id === original.roomTypeId);
    if (!rt) return;
    handleAddRoom(rt);
  };

  async function handleCreateProject(withRooms: boolean) {
    const roomsToSave = withRooms
      ? selectedRooms.map((inst, index) => {
          const rt = roomTypes.find((r) => r.id === inst.roomTypeId);
          return {
            id: inst.instanceKey,
            name: inst.customName,
            icon: rt?.icon || "🏠",
            sortOrder: index,
            slots: rt
              ? rt.slots.map((s) => ({
                  slotKey: `${inst.instanceKey}::${s.categoryKey}`,
                  slotLabel: s.slotLabel || s.categoryKey.split(" - ").pop() || s.categoryKey,
                  categoryKey: s.categoryKey,
                  required: s.required,
                  allowance: s.allowance,
                }))
              : [],
          };
        })
      : [];

    try {
      if (isApiMode) {
        const response = await createProjectMutation.mutateAsync({
          name: name || "Untitled Project",
          clientName: clientName || "Client",
          address,
          themeId: themeId || undefined,
          requiresDualApproval,
          primaryHomeownerEmail: primaryHomeownerEmail || undefined,
          secondaryHomeownerEmail: secondaryHomeownerEmail || undefined,
          rooms: roomsToSave,
        });

        await applyDefaultTemplate(response.project.id);
        navigate(`/projects/${response.project.id}`);
      } else {
        const project = createProject({
          name: name || "Untitled Project",
          clientName,
          address,
          selections: [],
          rooms: roomsToSave as any,
        });
        navigate(`/projects/${project.id}`);
      }
    } catch (err) {
      alert("Failed to create project. Please try again.");
    }
  }

  function handleNext() {
    if (step === 0) {
      setStep(1);
    }
  }

  const canProceed = step === 0 ? name.trim().length > 0 : true;
  const totalSlots = selectedRooms.reduce((sum, inst) => {
    const rt = roomTypes.find((r) => r.id === inst.roomTypeId);
    return sum + (rt?.slots.length ?? 0);
  }, 0);

  // ── STEP 0: Project Details ──
  if (step === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-8 text-center">
          <p className="text-xs uppercase tracking-widest text-primary font-bold mb-2">New project</p>
          <h1 className="font-serif text-3xl text-foreground font-semibold">Project Details & Plan Type</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto font-sans leading-relaxed">
            Enter client information and apply a plan theme. You can also configure homeowner emails for onboarding.
          </p>
        </header>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["Project Details", "Configure Rooms"].map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${idx === 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${idx === 0 ? "border-primary bg-primary text-white" : "border-border"}`}>
                  {idx + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{label}</span>
              </div>
              {idx < 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Project name</label>
              <input className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AMC Residence" required />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client</label>
              <input className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or homeowner name" />
            </div>
            <div className="flex flex-col md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Address</label>
              <input className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Project site address" />
            </div>
            {isApiMode && (
              <>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Project Style Theme</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all cursor-pointer" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
                    <option value="">No Theme / Unassigned</option>
                    {(themesQuery.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Primary Homeowner Email</label>
                  <input className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" type="email" value={primaryHomeownerEmail} onChange={(e) => setPrimaryHomeownerEmail(e.target.value)} placeholder="homeowner@email.com" />
                </div>
                <div className="flex flex-col md:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Spouse Email (Secondary Signer)</label>
                  <input className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all" type="email" value={secondaryHomeownerEmail} onChange={(e) => setSecondaryHomeownerEmail(e.target.value)} placeholder="spouse@email.com" />
                </div>
                <label className="flex items-center gap-3 md:col-span-2 cursor-pointer p-1 rounded-lg hover:bg-muted/50 transition-colors">
                  <input type="checkbox" checked={requiresDualApproval} onChange={(e) => setRequiresDualApproval(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="text-xs text-muted-foreground font-semibold">Require dual spouse signatures for Change Orders</span>
                </label>
              </>
            )}
          </div>
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-xs text-primary leading-relaxed flex items-start gap-2.5">
            <span className="text-base shrink-0">✨</span>
            <p><strong>Default template pre-fill:</strong> The organization's default template will be applied automatically when you create the project.</p>
          </div>
          <button type="button"
            className="w-full bg-primary hover:opacity-90 active:scale-[0.99] text-primary-foreground font-bold text-sm rounded-xl py-3.5 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canProceed}
            onClick={handleNext}>
            <span>Next: Configure Rooms</span> <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 1: Room Configuration ──
  if (step === 1) {
    const groupedByType: Record<string, SelectedRoom[]> = {};
    selectedRooms.forEach((r) => {
      if (!groupedByType[r.roomTypeId]) groupedByType[r.roomTypeId] = [];
      groupedByType[r.roomTypeId].push(r);
    });

    return (
      <div className="max-w-7xl mx-auto py-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            {["Project Details", "Configure Rooms"].map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${idx === 1 ? "text-primary" : idx < 1 ? "text-primary/60" : "text-muted-foreground/40"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${idx === 1 ? "border-primary bg-primary text-white" : idx < 1 ? "border-primary/60 bg-primary/10 text-primary/60" : "border-border"}`}>
                    {idx < 1 ? <Check size={12} /> : idx + 1}
                  </div>
                  <span className="text-xs font-semibold hidden sm:block">{label}</span>
                </div>
                {idx < 1 && <div className="w-8 h-px bg-border" />}
              </div>
            ))}
          </div>
          <div className="text-center mb-2">
            <p className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Step 2 of 2</p>
            <h1 className="font-serif text-3xl text-foreground font-semibold">Configure House Rooms</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
              Select which rooms are in <strong className="text-foreground">{name || "this project"}</strong>. These rooms will be shown to the homeowner for selection.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Room Grid */}
          <div>
            {roomTypes.length === 0 ? (
              <div className="py-16 text-center bg-card border border-dashed border-border rounded-2xl">
                <Home size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-4">No room templates configured yet.</p>
                <a href="/room-configurator" className="text-primary text-sm font-semibold underline">
                  Go to Room Configurator →
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {roomTypes.map((rt) => (
                  <RoomPickerCard
                    key={rt.id}
                    roomType={rt}
                    instances={groupedByType[rt.id] ?? []}
                    onAdd={() => handleAddRoom(rt)}
                    onRemove={handleRemoveRoom}
                    onDuplicate={handleDuplicateRoom}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Summary sidebar */}
          <div className="lg:sticky lg:top-6 h-fit space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Project Summary</h3>
              <div className="text-center py-4 border border-primary/20 bg-primary/5 rounded-xl mb-4">
                <p className="text-4xl font-extrabold text-primary font-serif">{selectedRooms.length}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">Rooms Selected</p>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total Selection Slots</span>
                  <span className="font-bold text-foreground">{totalSlots}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unique Room Types</span>
                  <span className="font-bold text-foreground">{Object.keys(groupedByType).length}</span>
                </div>
              </div>
              {selectedRooms.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-border pt-4">
                  {selectedRooms.map((inst) => {
                    const rt = roomTypes.find((r) => r.id === inst.roomTypeId);
                    if (!rt) return null;
                    return (
                      <div key={inst.instanceKey} className="flex items-center gap-2 text-xs">
                        <span className="text-base">{rt.icon}</span>
                        <span className="text-foreground font-semibold truncate">{selectedRooms.filter(r => r.roomTypeId === inst.roomTypeId).length > 1 ? `${rt.name} ${selectedRooms.filter(r => r.roomTypeId === inst.roomTypeId).indexOf(inst) + 1}` : rt.name}</span>
                        <span className="ml-auto text-muted-foreground">{rt.slots.length} slots</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold leading-relaxed">
                💡 <strong>Tip:</strong> Rooms can be added or modified later inside the project. The homeowner will see these rooms in their selection view.
              </p>
            </div>
          </div>
        </div>

        {/* Footer nav */}
        <footer className="border-t border-border pt-6 mt-8 flex justify-between items-center">
          <button type="button"
            className="px-6 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer"
            onClick={() => setStep(0)}>
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            <button type="button"
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              disabled={createProjectMutation.isPending}
              onClick={() => handleCreateProject(false)}>
              Skip (configure later)
            </button>
            <button type="button"
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              disabled={createProjectMutation.isPending || selectedRooms.length === 0}
              onClick={() => handleCreateProject(true)}>
              {createProjectMutation.isPending ? "Creating Project..." : <>Create Project <ArrowRight size={16} /></>}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}

