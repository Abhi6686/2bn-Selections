import { useState, useMemo } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Copy } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useRoomTypes } from "../api/hooks";


interface ProjectRoomsSetupTabProps {
  project: any;
  sections: any[];
  onSaveRooms: (updatedRooms: any[]) => Promise<void>;
}

export function ProjectRoomsSetupTab({ project, sections, onSaveRooms }: ProjectRoomsSetupTabProps) {
  const { data: globalRoomTemplates = [] } = useRoomTypes();
  const [rooms, setRooms] = useState<any[]>(project.rooms || []);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (project.rooms || []).forEach((r: any) => {
      initial[r.id] = true;
    });
    return initial;
  });

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomIcon, setNewRoomIcon] = useState("🏠");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isSaving, setIsSaving] = useState(false);


  const availableCategories = useMemo(() => {
    const list: Array<{ categoryKey: string; label: string }> = [];
    sections.forEach((sec: any) => {
      sec.groups.forEach((group: any) => {
        if (group.subgroups && group.subgroups.length > 0) {
          group.subgroups.forEach((sub: any) => {
            list.push({
              categoryKey: sub.categoryKey,
              label: `${sec.name} › ${group.name} › ${sub.name}`,
            });
          });
        } else {
          list.push({
            categoryKey: group.categoryKey,
            label: `${sec.name} › ${group.name}`,
          });
        }
      });
    });
    return list;
  }, [sections]);

  const emojiOptions = ["🏠", "🍳", "🛁", "🛏️", "🧺", "🛋️", "🚪", "🪜", "💡", "🌳", "🚗", "🧸"];

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newRoomName.trim(),
      icon: newRoomIcon,
      sortOrder: rooms.length,
      slots: [],
    };
    setRooms([...rooms, newRoom]);
    setExpandedRooms((prev) => ({ ...prev, [newRoom.id]: true }));
    setNewRoomName("");
    setNewRoomIcon("🏠");
  };

  const handleApplyRoomTemplate = () => {
    if (!selectedTemplateId) return;
    const template = globalRoomTemplates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    const newRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      icon: template.icon,
      sortOrder: rooms.length,
      slots: template.slots.map((s: any) => ({
        slotKey: `${s.categoryKey}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        slotLabel: s.slotLabel,
        categoryKey: s.categoryKey,
        required: s.required,
        allowance: s.allowance,
      })),
    };

    setRooms([...rooms, newRoom]);
    setExpandedRooms((prev) => ({ ...prev, [newRoom.id]: true }));
    setSelectedTemplateId("");
  };


  const handleDeleteRoom = (roomId: string) => {
    setRooms(rooms.filter((r) => r.id !== roomId));
  };

  const handleToggleExpand = (roomId: string) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const handleAddSlot = (roomId: string, categoryKey: string) => {
    if (!categoryKey) return;
    const catObj = availableCategories.find((c) => c.categoryKey === categoryKey);
    if (!catObj) return;

    const label = catObj.label.split(" › ").pop() || categoryKey;

    setRooms(
      rooms.map((room) => {
        if (room.id !== roomId) return room;
        const newSlot = {
          slotKey: `${categoryKey}-${Date.now()}`,
          slotLabel: label,
          categoryKey,
          required: true,
        };
        return {
          ...room,
          slots: [...room.slots, newSlot],
        };
      })
    );
  };

  const handleDeleteSlot = (roomId: string, slotKey: string) => {
    setRooms(
      rooms.map((room) => {
        if (room.id !== roomId) return room;
        return {
          ...room,
          slots: room.slots.filter((s: any) => s.slotKey !== slotKey),
        };
      })
    );
  };

  const handleUpdateSlotProperty = (roomId: string, slotKey: string, updates: any) => {
    setRooms(
      rooms.map((room) => {
        if (room.id !== roomId) return room;
        return {
          ...room,
          slots: room.slots.map((s: any) => (s.slotKey === slotKey ? { ...s, ...updates } : s)),
        };
      })
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRooms(rooms);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                🏠 Room Configurator
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Design custom rooms and assign slot options from the catalog. Homeowners will select materials room-by-room.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto font-bold flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Room Config"} <Save size={16} />
            </Button>
          </div>

          {globalRoomTemplates.length > 0 && (
            <div className="bg-primary/5 border border-primary/15 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Copy size={16} className="text-primary" /> Apply Room Template Profile
                </h4>
                <p className="text-xs text-muted-foreground">Apply standard room profiles with preset category selections.</p>
              </div>
              <div className="flex gap-2.5 w-full sm:w-auto">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="px-3 py-2 border border-input bg-background rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-60"
                >
                  <option value="" disabled>-- Select template --</option>
                  {globalRoomTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.icon} {template.name} ({template.slots.length} slots)
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleApplyRoomTemplate}
                  disabled={!selectedTemplateId}
                  className="font-bold shrink-0 text-xs py-1.5"
                >
                  Apply Profile
                </Button>
              </div>
            </div>
          )}

          <div className="bg-muted/40 border border-border p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end">

            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Room Name
              </label>
              <input
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all"
                placeholder="e.g. Master Suite, Kitchen"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-full md:w-fit">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Room Icon
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {emojiOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewRoomIcon(emoji)}
                    className={`w-9 h-9 rounded-lg border text-base flex items-center justify-center transition-all cursor-pointer ${
                      newRoomIcon === emoji
                        ? "border-primary bg-primary/10 scale-105"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleAddRoom}
              disabled={!newRoomName.trim()}
              variant="secondary"
              className="w-full md:w-auto font-bold h-10 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} /> Add Room
            </Button>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground text-sm">
              No rooms configured yet. Create a room above to begin.
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => {
                const isExpanded = !!expandedRooms[room.id];
                return (
                  <div
                    key={room.id}
                    className="border border-border rounded-2xl overflow-hidden bg-card transition-all shadow-sm"
                  >
                    <div
                      className="p-4 flex justify-between items-center bg-muted/20 border-b border-border cursor-pointer select-none"
                      onClick={() => handleToggleExpand(room.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{room.icon}</span>
                        <h4 className="font-bold text-foreground text-sm">{room.name}</h4>
                        <span className="text-[10px] bg-muted border border-border text-muted-foreground font-bold px-2 py-0.5 rounded-full">
                          {room.slots.length} slots
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-2 text-destructive hover:bg-destructive/5 rounded-lg transition-colors cursor-pointer"
                          title="Delete room"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleExpand(room.id)}
                          className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5 space-y-4">
                        {room.slots.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No slots configured in this room.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {room.slots.map((slot: any) => (
                              <div
                                key={slot.slotKey}
                                className="flex flex-col md:flex-row gap-4 p-4 border border-border/80 rounded-xl bg-muted/10 items-start md:items-center"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary font-bold px-2 py-0.5 rounded-md truncate max-w-xs block w-fit">
                                    {slot.categoryKey.split(" - ").slice(-1)[0]}
                                  </span>
                                  <input
                                    className="text-xs font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none mt-1 w-full max-w-sm"
                                    value={slot.slotLabel}
                                    onChange={(e) =>
                                      handleUpdateSlotProperty(room.id, slot.slotKey, {
                                        slotLabel: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex flex-wrap gap-4 items-center w-full md:w-auto justify-between md:justify-end">
                                  <label className="flex items-center gap-2 cursor-pointer p-1">
                                    <input
                                      type="checkbox"
                                      checked={slot.required}
                                      onChange={(e) =>
                                        handleUpdateSlotProperty(room.id, slot.slotKey, {
                                          required: e.target.checked,
                                        })
                                      }
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                      Required
                                    </span>
                                  </label>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                      Allowance
                                    </span>
                                    <input
                                      type="number"
                                      value={slot.allowance || ""}
                                      onChange={(e) =>
                                        handleUpdateSlotProperty(room.id, slot.slotKey, {
                                          allowance: parseFloat(e.target.value) || undefined,
                                        })
                                      }
                                      placeholder="None"
                                      className="px-2 py-1 border border-input rounded-lg bg-background text-xs w-20"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleDeleteSlot(room.id, slot.slotKey)}
                                    className="p-1.5 text-destructive hover:bg-destructive/5 rounded-lg transition-colors cursor-pointer"
                                    title="Delete slot"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center gap-3">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
                            Add Slot from Catalog:
                          </label>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              handleAddSlot(room.id, e.target.value);
                              e.target.value = "";
                            }}
                            className="flex-1 w-full px-3 py-1.5 border border-input bg-background rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                          >
                            <option value="" disabled>
                              -- Select a Category --
                            </option>
                            {availableCategories.map((c) => (
                              <option key={c.categoryKey} value={c.categoryKey}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
