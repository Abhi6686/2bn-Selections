import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { apiUrl } from "../config/api";
import toast from "react-hot-toast";


// ─── Types ───────────────────────────────────────────────────────────────────

interface HoSwatchItem {
  id: string;
  categoryKey?: string;
  manufacturer?: string;
  model?: string;
  product?: string;
  imageUrl?: string;
  priceMin?: number;
  priceMax?: number;
  level?: string;
  tags?: string[];
  galleryImages?: string[];
  specifications?: string;
  finish?: string;
  size?: string;
  vendor?: string;
}

interface HoSlot {
  slotKey: string;
  slotLabel: string;
  categoryKey?: string;
  sectionTitle: string;

  subsectionTitle?: string;
  selectionId?: string;
  libraryItemId?: string;
  manufacturer?: string;
  model?: string;
  product?: string;
  finish?: string;
  size?: string;
  vendor?: string;
  specifications?: string;
  tags?: string[];
  level?: string;
  priceMin?: number;
  priceMax?: number;
  imageUrl?: string;
  galleryImages?: string[];
  state?: string;
  isDecideLater?: boolean;
  isSkipped?: boolean;
  availableItems: HoSwatchItem[];
  selectedItems?: Array<{
    selectionId: string;
    libraryItemId: string;
    quantity: number;
    priceUsed: number;
    manufacturer?: string;
    model?: string;
    product?: string;
    level?: string;
    finish?: string;
    size?: string;
    vendor?: string;
    imageUrl?: string;
    specifications?: string;
  }>;
}

interface HOSection {
  key: string;
  title: string;
  icon: string;
  slots: HoSlot[];
}

interface HomeownerSelectionsTabProps {
  sections: HOSection[];
  proposalSigned: boolean;
  unlockedCategoryKeys: string[];
  onAddToSelection?: (slotKey: string, libraryItemId?: string) => void;
  onSelectItem: (slotKey: string, libraryItemId: string, price: number, quantity?: number, selectionId?: string) => void;
  onRemoveSelection: (slotKey: string) => void;
  onToggleDecideLater: (slotKey: string, decideLater: boolean) => void;
  decideLaterKeys: Set<string>;
  lastVisitedCategoryKey?: string;
  onVisitSlot?: (slotKey: string) => void;
  onSkipCategory?: (slotKey: string) => void;
  onRemoveSelectionItem?: (selectionId: string) => void;
  onUpdateQuantity?: (selectionId: string, slotKey: string, quantity: number) => void;
  onSubmitSelections?: () => Promise<void>;
  onSubmitProposal?: (body: { signatureType: "drawn" | "typed"; typedName?: string; signatureImageBase64?: string; geo?: { latitude: number; longitude: number } }) => Promise<any>;
  proposalPdfUrl?: string;
  projectStatus?: string;
  isAdmin?: boolean;
  projectLocked?: boolean;
  onUnlockCategory?: (slotKey: string, isUnlocked: boolean) => Promise<void>;
  onToggleProjectLock?: (locked: boolean) => Promise<void>;
  onUpdateProjectStatus?: (newStatus: string) => Promise<void>;
  onSaveRooms?: (updatedRooms: any[]) => Promise<void>;
  availableCategories?: Array<{ categoryKey: string; label: string }>;
  projectId?: string;
  proposalEmailStatus?: "pending" | "sending" | "sent" | "failed";
  proposalEmailError?: string;
  proposalSignedAt?: string;
  proposalSignedBy?: string;
  proposalSignatureType?: string;
  proposalTypedName?: string;
  proposalSignatureIp?: string;
  proposalSignatureGeo?: {
    latitude?: number;
    longitude?: number;
  };
  showPrices?: boolean;
  onResendSignedProposal?: () => Promise<void>;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function getLevelBadge(level?: string) {
  if (level === "3") return { label: "Premium", className: "bg-purple-100 text-purple-800 border border-purple-200" };
  if (level === "2") return { label: "Upgrade", className: "bg-amber-100 text-amber-800 border border-amber-200" };
  return { label: "Standard", className: "bg-emerald-100 text-emerald-800 border border-emerald-200" };
}

function getSlotGroupName(slot: HoSlot): string {
  if (slot.subsectionTitle) return slot.subsectionTitle;
  const parts = slot.slotKey.split(" - ");
  if (parts.length > 1) return parts[1].trim();
  return "General";
}

function getSlotStatus(slot: HoSlot, decideLaterKeys: Set<string>): "confirmed" | "decide-later" | "skipped" | "pending" {
  if ((slot.selectedItems && slot.selectedItems.length > 0) || (slot.selectionId && slot.state === "confirmed")) return "confirmed";
  if (slot.isSkipped) return "skipped";
  if (decideLaterKeys.has(slot.slotKey)) return "decide-later";
  return "pending";
}

function isSlotLocked(
  slotKey: string,
  isAdmin: boolean,
  proposalSigned: boolean,
  unlockedCategoryKeys: string[],
  projectLocked: boolean,
  projectStatus?: string
): boolean {
  if (isAdmin) return false;
  if (projectLocked) return true;

  const isUnlocked = unlockedCategoryKeys.includes(slotKey) ||
    unlockedCategoryKeys.some(key => slotKey.startsWith(key + " - "));

  if (isUnlocked) return false;

  return (
    proposalSigned ||
    projectStatus === "selections_submitted" ||
    projectStatus === "selections_complete"
  );
}

const STATUS_STYLES = {
  confirmed: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Confirmed", bg: "bg-emerald-50 border-emerald-200" },
  "decide-later": { dot: "bg-amber-400", text: "text-amber-700", label: "Decide Later", bg: "bg-amber-50 border-amber-200" },
  skipped: { dot: "bg-gray-400", text: "text-gray-500", label: "Skipped", bg: "bg-gray-50 border-gray-200" },
  pending: { dot: "bg-gray-300", text: "text-gray-400", label: "Pending", bg: "bg-white border-border" },
};

// ─── Product Detail Modal ─────────────────────────────────────────────────────

function ProductDetailModal({
  item,
  slot,
  isLocked,
  onClose,
  onSelect,
  onRemoveSelectionItem,
  onUpdateQuantity,
  showPrices = true,
  isAdmin = false,
}: {
  item: HoSwatchItem;
  slot: HoSlot;
  isLocked: boolean;
  onClose: () => void;
  onSelect: () => void;
  onRemoveSelectionItem?: (id: string) => void;
  onUpdateQuantity?: (id: string, slotKey: string, qty: number) => void;
  showPrices?: boolean;
  isAdmin?: boolean;
}) {
  const [activeImg, setActiveImg] = useState(item.imageUrl || "");
  const isSelected = slot.selectedItems?.some(s => s.libraryItemId === item.id);
  const existingSel = slot.selectedItems?.find(s => s.libraryItemId === item.id);
  const lvl = getLevelBadge(item.level);
  const priceMin = item.priceMin || 0;
  const priceMax = item.priceMax || priceMin;
  const priceLabel = (!showPrices && !isAdmin) ? "Included" : (priceMin === priceMax || !priceMax ? formatCurrency(priceMin) : `${formatCurrency(priceMin)} – ${formatCurrency(priceMax)}`);

  const allImgs = useMemo(() => {
    const imgs: string[] = [];
    if (item.imageUrl) imgs.push(item.imageUrl);
    (item.galleryImages || []).filter(Boolean).forEach(u => { if (!imgs.includes(u)) imgs.push(u); });
    return imgs;
  }, [item]);

  useEffect(() => { setActiveImg(item.imageUrl || ""); }, [item]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[101] w-full max-w-lg bg-background shadow-2xl flex flex-col overflow-hidden border-l border-border">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border bg-card">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
              {slot.sectionTitle}{slot.subsectionTitle ? ` › ${slot.subsectionTitle}` : ""}
            </p>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              {item.manufacturer && item.model ? `${item.manufacturer} ${item.model}` : slot.slotLabel}
            </h2>
            {item.product && <p className="text-sm text-muted-foreground mt-0.5">{item.product}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Main Image */}
          <div className="relative h-64 bg-muted overflow-hidden">
            {activeImg ? (
              <img src={activeImg} alt={item.product || "Product"} className="w-full h-full object-contain bg-white p-4" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl bg-muted/20">📷</div>
            )}
            {item.level && (
              <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full ${lvl.className}`}>
                {lvl.label}
              </span>
            )}
          </div>

          {/* Thumbnail strip */}
          {allImgs.length > 1 && (
            <div className="flex gap-2 px-5 py-3 overflow-x-auto border-b border-border bg-muted/10">
              {allImgs.map((url, i) => (
                <button key={i} onClick={() => setActiveImg(url)}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all bg-white p-1 ${activeImg === url ? "border-primary" : "border-border hover:border-primary/50"}`}>
                  <img src={url} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* Price */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Price</p>
                <p className="text-2xl font-extrabold text-foreground">{priceLabel}</p>
              </div>
              {isSelected && (
                <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Selected
                </span>
              )}
            </div>

            {/* Specs grid */}
            {(item.finish || item.size || item.vendor) && (
              <div className="grid grid-cols-2 gap-3">
                {item.finish && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Finish / Color</p>
                    <p className="text-sm font-semibold text-foreground">{item.finish}</p>
                  </div>
                )}
                {item.size && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Size / Dims</p>
                    <p className="text-sm font-semibold text-foreground">{item.size}</p>
                  </div>
                )}
                {item.vendor && (
                  <div className="bg-card border border-border rounded-xl p-3 col-span-2">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Vendor / Supplier</p>
                    <p className="text-sm font-semibold text-foreground">{item.vendor}</p>
                  </div>
                )}
              </div>
            )}

            {/* Specifications */}
            {item.specifications && (
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Specifications</p>
                <p className="text-sm text-foreground bg-muted/40 rounded-xl p-3 border border-border leading-relaxed whitespace-pre-line">{item.specifications}</p>
              </div>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map(tag => (
                  <span key={tag} className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border font-medium">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-5 border-t border-border bg-card/50 space-y-3">
          {isLocked ? (
            <button disabled className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm cursor-not-allowed">🔒 Selections Locked</button>
          ) : isSelected && existingSel ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                <span className="text-sm font-bold text-emerald-700">✓ Item Selected</span>
                <div className="flex items-center gap-0 border border-border rounded-lg overflow-hidden bg-white h-8">
                  <button onClick={() => {
                    if (existingSel.quantity > 1) onUpdateQuantity?.(existingSel.selectionId, slot.slotKey, existingSel.quantity - 1);
                    else if (confirm("Remove this item?")) onRemoveSelectionItem?.(existingSel.selectionId);
                  }} className="w-8 h-8 flex items-center justify-center font-bold text-foreground hover:bg-muted transition-colors">−</button>
                  <span className="px-3 text-sm font-bold text-foreground">{existingSel.quantity}</span>
                  <button onClick={() => onUpdateQuantity?.(existingSel.selectionId, slot.slotKey, existingSel.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center font-bold text-foreground hover:bg-muted transition-colors">+</button>
                </div>
              </div>
              <button onClick={() => { if (confirm("Remove this item?")) onRemoveSelectionItem?.(existingSel.selectionId); }}
                className="w-full py-2 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors">
                Remove Selection
              </button>
            </div>
          ) : (
            <button onClick={() => { onSelect(); onClose(); }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-sm">
              ✓ Select this Option
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Compare Drawer ───────────────────────────────────────────────────────────

function CompareDrawer({
  items,
  slotKey,
  sections,
  onSelectItem,
  onToggleItem,
  onClose,
  isLocked,
  showPrices = true,
  isAdmin = false,
}: {
  items: HoSwatchItem[];
  slotKey: string | null;
  sections: HOSection[];
  onSelectItem: (slotKey: string, libId: string, price: number, qty?: number) => void;
  onToggleItem: (item: HoSwatchItem) => void;
  onClose: () => void;
  isLocked: boolean;
  showPrices?: boolean;
  isAdmin?: boolean;
}) {
  const targetSlot = sections.flatMap(s => s.slots).find(sl => sl.slotKey === slotKey);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[101] bg-background rounded-t-2xl shadow-2xl border-t border-border max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground">⚖️ Side-by-Side Comparison</h3>
            <p className="text-xs text-muted-foreground">Comparing {items.length} options</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
        </div>
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4" style={{ minWidth: items.length * 260 }}>
            {items.map(item => {
              const isConfirmed = targetSlot?.selectedItems?.some(s => s.libraryItemId === item.id);
              const lvl = getLevelBadge(item.level);
              return (
                <div key={item.id} className="w-60 shrink-0 bg-card border border-border rounded-2xl overflow-hidden relative flex flex-col">
                  <button onClick={() => onToggleItem(item)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground text-xs z-10 hover:bg-destructive/10 hover:text-destructive transition-colors">✕</button>
                  <div className="h-44 bg-white border-b border-border overflow-hidden flex items-center justify-center p-2">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="max-w-full max-h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-4xl">🏠</div>}
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.manufacturer || "Standard"}</p>
                      <h4 className="font-bold text-foreground text-sm leading-tight">{item.product || item.model}</h4>
                      <p className="text-lg font-extrabold text-primary mt-1">{(!showPrices && !isAdmin) ? "Included" : formatCurrency(item.priceMin || 0)}</p>
                      {item.level && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lvl.className}`}>{lvl.label}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
                      {item.finish && <div><strong className="text-foreground">Finish:</strong> {item.finish}</div>}
                      {item.size && <div><strong className="text-foreground">Size:</strong> {item.size}</div>}
                      {item.vendor && <div><strong className="text-foreground">Vendor:</strong> {item.vendor}</div>}
                    </div>
                    <div className="mt-auto pt-2">
                      {isLocked ? (
                        <button disabled className="w-full py-2 rounded-lg bg-muted text-muted-foreground text-xs font-bold">🔒 Locked</button>
                      ) : isConfirmed ? (
                        <div className="w-full py-2 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold text-center border border-emerald-200">✓ Selected</div>
                      ) : (
                        <button onClick={() => { if (slotKey) onSelectItem(slotKey, item.id, item.priceMin || 0, 1); onClose(); }}
                          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
                          Choose This
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Review & Submit Panel ────────────────────────────────────────────────────

function ReviewSubmitPanel({
  sections,
  decideLaterKeys,
  projectStatus,
  proposalSigned,
  proposalPdfUrl,
  onSubmitSelections,
  onSubmitProposal,
  isAdmin = false,
  onUpdateProjectStatus,
  onToggleProjectLock,
  projectId,
  proposalEmailStatus,
  proposalEmailError,
  proposalSignedAt,
  proposalSignedBy,
  proposalSignatureType,
  proposalTypedName,
  proposalSignatureIp,
  proposalSignatureGeo,
  showPrices = true,
  onResendSignedProposal,
}: {
  sections: HOSection[];
  decideLaterKeys: Set<string>;
  projectStatus?: string;
  proposalSigned: boolean;
  proposalPdfUrl?: string;
  onSubmitSelections?: () => Promise<void>;
  onSubmitProposal?: (body: any) => Promise<any>;
  isAdmin?: boolean;
  onUpdateProjectStatus?: (newStatus: string) => Promise<void>;
  onToggleProjectLock?: (locked: boolean) => Promise<void>;
  projectId?: string;
  proposalEmailStatus?: "pending" | "sending" | "sent" | "failed";
  proposalEmailError?: string;
  proposalSignedAt?: string;
  proposalSignedBy?: string;
  proposalSignatureType?: string;
  proposalTypedName?: string;
  proposalSignatureIp?: string;
  proposalSignatureGeo?: {
    latitude?: number;
    longitude?: number;
  };
  showPrices?: boolean;
  onResendSignedProposal?: () => Promise<void>;
}) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [localState, setLocalState] = useState<"draft" | "submitted" | "signed">(() => {
    if (proposalSigned || projectStatus === "selections_complete") return "signed";
    if (projectStatus === "selections_submitted") return "submitted";
    return "draft";
  });
  const [submitting, setSubmitting] = useState(false);
  const [sigType, setSigType] = useState<"drawn" | "typed">("typed");
  const [typedName, setTypedName] = useState("");
  const [geoConsent, setGeoConsent] = useState(false);
  const [sigError, setSigError] = useState("");

  const allSlots = sections.flatMap(s => s.slots);
  const confirmed = allSlots.filter(s => (s.selectedItems && s.selectedItems.length > 0) || (s.selectionId && s.state === "confirmed"));
  const skipped = allSlots.filter(s => s.isSkipped);
  const later = allSlots.filter(s => decideLaterKeys.has(s.slotKey));
  const unfilled = allSlots.filter(s => !s.isSkipped && !decideLaterKeys.has(s.slotKey) && !(s.selectedItems && s.selectedItems.length > 0) && !(s.selectionId && s.state === "confirmed"));
  const total = allSlots.reduce((sum, sl) => sum + (sl.selectedItems?.reduce((s2, it) => s2 + (it.priceUsed * it.quantity), 0) || 0), 0);

  const stats = [
    { label: "Total Slots", value: allSlots.length, color: "text-foreground", bg: "bg-muted/50 border-border" },
    { label: "Confirmed", value: confirmed.length, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Skipped", value: skipped.length, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
    { label: "Decide Later", value: later.length, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6">
      <div className="text-center space-y-2">
        <p className="text-xs text-primary font-bold uppercase tracking-widest">Final Step</p>
        <h2 className="text-2xl font-bold text-foreground">Review & Submit Selections</h2>
        <p className="text-sm text-muted-foreground">Review your chosen finishes and materials before sending to your project manager.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.bg}`}>
            <p className="text-xs text-muted-foreground font-semibold mb-1">{s.label}</p>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Total cost */}
      {(!showPrices && !isAdmin) ? null : (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-2xl px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Total Selections Cost</p>
            <p className="text-3xl font-extrabold text-primary">{formatCurrency(total)}</p>
          </div>
          <div className="text-4xl">💰</div>
        </div>
      )}

      {/* Warning */}
      {unfilled.length > 0 && (
        <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <span className="text-2xl shrink-0">⚠️</span>
          <p className="text-sm text-amber-800">
            <strong>{unfilled.length} unfilled slots</strong> remain. You can still submit — your project manager will follow up on missing items.
          </p>
        </div>
      )}

      {/* Submit flow */}
      {isAdmin ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mx-auto">📋</div>
          <h3 className="text-lg font-bold">Project Manager Overview</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Review the homeowner's selections progress. Homeowner has submitted {confirmed.length} confirmed selections out of {allSlots.length} slots.
          </p>
          <div className="pt-2 flex flex-wrap gap-2 justify-center">
            <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
              projectStatus === "selections_submitted" || projectStatus === "selections_complete" || proposalSigned
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}>
              Status: {projectStatus?.replace("_", " ").toUpperCase() || "ACTIVE"}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            {!proposalSigned && projectId && (
              <a 
                href={apiUrl(`/api/projects/${projectId}/proposal-draft-pdf`)} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-bold text-xs hover:opacity-90 transition-all cursor-pointer border border-border"
              >
                📄 View Draft PDF
              </a>
            )}
            {proposalSigned && proposalPdfUrl && (
              <a 
                href={apiUrl(proposalPdfUrl)}
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
              >
                📥 View Signed PDF
              </a>
            )}
          </div>

          {/* Signature Metadata Audit Trail */}
          {proposalSigned && (
            <div className="bg-muted/40 rounded-xl p-4 border border-border text-left space-y-2 mt-4 max-w-md mx-auto text-xs">
              <h4 className="font-bold text-foreground text-sm border-b border-border pb-1.5 flex items-center gap-1.5">
                🔏 Signature Security Audit Trail
              </h4>
              <div className="grid grid-cols-3 gap-y-1.5 text-muted-foreground pt-1">
                <span className="font-semibold">Signer:</span>
                <span className="col-span-2 text-foreground truncate font-medium">{proposalSignedBy || "Homeowner"}</span>
                
                <span className="font-semibold">Signed At:</span>
                <span className="col-span-2 text-foreground font-medium">
                  {proposalSignedAt ? new Date(proposalSignedAt).toLocaleString() : "N/A"}
                </span>

                <span className="font-semibold">Type:</span>
                <span className="col-span-2 text-foreground capitalize font-medium">{proposalSignatureType || "electronic"}</span>

                {proposalTypedName && (
                  <>
                    <span className="font-semibold">Typed Name:</span>
                    <span className="col-span-2 text-foreground italic font-medium">"{proposalTypedName}"</span>
                  </>
                )}

                <span className="font-semibold">IP Address:</span>
                <span className="col-span-2 text-foreground font-mono">{proposalSignatureIp || "N/A"}</span>

                <span className="font-semibold">Location:</span>
                <span className="col-span-2 text-foreground font-medium">
                  {proposalSignatureGeo?.latitude && proposalSignatureGeo?.longitude ? (
                    <a 
                      href={`https://www.google.com/maps?q=${proposalSignatureGeo.latitude},${proposalSignatureGeo.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      📍 {proposalSignatureGeo.latitude.toFixed(4)}, {proposalSignatureGeo.longitude.toFixed(4)} <span className="text-[10px] underline">(Map)</span>
                    </a>
                  ) : "Not shared by device"}
                </span>
              </div>
            </div>
          )}

          {/* Email Notification status badge */}
          {proposalSigned && proposalEmailStatus && (
            <div className="pt-2 max-w-md mx-auto">
              {proposalEmailStatus === "sending" && (
                <div className="flex items-center gap-2 justify-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span className="animate-spin text-sm">⏳</span>
                  <span className="font-medium">Sending proposal PDF email copies in background...</span>
                </div>
              )}
              {proposalEmailStatus === "sent" && (
                <div className="flex items-center gap-2 justify-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span className="font-medium">Signed PDF copies successfully emailed to builder & homeowner inbox.</span>
                </div>
              )}
              {proposalEmailStatus === "failed" && (
                <div className="flex flex-col gap-1 text-left text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                  <span className="font-bold">⚠️ Email Notification Failed:</span>
                  <span className="font-mono text-[10px] break-all">{proposalEmailError || "SMTP connection issue"}</span>
                  <span className="text-muted-foreground mt-1">Please verify server configuration. Signed document is still secure and downloadable above.</span>
                </div>
              )}
            </div>
          )}

          {(projectStatus === "selections_submitted" || projectStatus === "selections_complete" || proposalSigned) && (
            <div className="pt-4 border-t border-border mt-4">
              <p className="text-xs text-muted-foreground mb-3">Homeowner's sheet is currently locked because it was submitted or proposal signed.</p>
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to unlock and re-open the selections sheet for the homeowner?")) {
                    await onUpdateProjectStatus?.("selections_in_progress");
                    await onToggleProjectLock?.(false);
                    window.location.reload();
                  }
                }}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
              >
                🔄 Re-Open (Unlock) Selections Sheet
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6">
          {localState === "draft" && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mx-auto">📤</div>
              <h3 className="text-lg font-bold">Step 1: Submit to Builder</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">Send your confirmed selections to your project manager for review.</p>
              <button onClick={async () => { setSubmitting(true); try { await onSubmitSelections?.(); setLocalState("submitted"); } catch { alert("Failed. Try again."); } finally { setSubmitting(false); } }}
                disabled={submitting}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer">
                {submitting ? "Submitting..." : "📤 Submit Selections"}
              </button>
            </div>
          )}
          {localState === "submitted" && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-lg font-bold">Step 2: Sign the Proposal</h3>
                <p className="text-xs text-muted-foreground mt-1">Authorize your selections with a signature below.</p>
              </div>
              {projectId && (
                <div className="text-center bg-muted/40 p-4 border border-border rounded-xl">
                  <p className="text-xs text-muted-foreground mb-2">Please review the proposal draft PDF before signing:</p>
                  <a 
                    href={`http://localhost:3001/api/projects/${projectId}/proposal-draft-pdf`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-bold text-xs hover:opacity-90 transition-all cursor-pointer border border-border"
                  >
                    📄 View Proposal Draft PDF
                  </a>
                </div>
              )}
              <div className="flex gap-4">
                {(["typed", "drawn"] as const).map(t => (
                  <label key={t} className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${sigType === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <input type="radio" checked={sigType === t} onChange={() => setSigType(t)} className="accent-primary" />
                    <span className="text-sm font-semibold capitalize">{t} Signature</span>
                  </label>
                ))}
              </div>
              {sigType === "typed" ? (
                <div className="space-y-3">
                  <input type="text" value={typedName} onChange={e => setTypedName(e.target.value)}
                    placeholder="Type your full legal name" className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  {typedName && (
                    <div className="p-4 border-2 border-dashed border-primary/30 rounded-xl text-center bg-muted/20">
                      <span style={{ fontFamily: "Times New Roman", fontStyle: "italic", fontSize: "1.8rem", color: "var(--primary)" }}>{typedName}</span>
                      <p className="text-xs text-muted-foreground mt-1">Electronic Signature</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="border-2 border-border rounded-xl overflow-hidden bg-white">
                    <SignatureCanvas ref={signatureRef} penColor="#1A1A1A" canvasProps={{ className: "w-full", style: { height: 120, background: "#fff" } }} />
                  </div>
                  <button onClick={() => signatureRef.current?.clear()} className="text-xs text-muted-foreground hover:text-foreground underline">Clear Pad</button>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={geoConsent} onChange={e => setGeoConsent(e.target.checked)} className="accent-primary" />
                Include device location in security audit trail
              </label>
              {sigError && <p className="text-destructive text-xs font-semibold">⚠️ {sigError}</p>}
              <div className="flex gap-3">
                <button onClick={async () => {
                  setSigError("");
                  let b64: string | undefined;
                  if (sigType === "drawn") {
                    if (signatureRef.current?.isEmpty()) { setSigError("Please draw your signature."); return; }
                    b64 = signatureRef.current?.toDataURL("image/png");
                  } else if (!typedName.trim()) { setSigError("Please type your name."); return; }
                  
                  let geo: { latitude: number; longitude: number } | undefined;
                  if (geoConsent && navigator.geolocation) {
                    try {
                      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
                      });
                      geo = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                      };
                    } catch (err) {
                      console.warn("Geolocation skipped/failed:", err);
                    }
                  }

                  setSubmitting(true);
                  try {
                    await onSubmitProposal?.({
                      signatureType: sigType,
                      typedName: sigType === "typed" ? typedName : undefined,
                      signatureImageBase64: b64,
                      geo
                    });
                    setLocalState("signed");
                  }
                  catch (e: any) { setSigError(e.message || "Failed."); }
                  finally { setSubmitting(false); }
                }} disabled={submitting} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer">
                  {submitting ? "Signing..." : "✍️ Sign & Finalize"}
                </button>
                <button onClick={() => setLocalState("draft")} className="px-4 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Back</button>
              </div>
            </div>
          )}
          {localState === "signed" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center text-3xl mx-auto">✓</div>
              <h3 className="text-xl font-bold text-emerald-700">Proposal Finalized!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">Selections are locked. Both you and your builder have received copies.</p>
              
              {/* Email Notification status badge */}
              {proposalEmailStatus && (
                <div className="max-w-md mx-auto my-3">
                  {proposalEmailStatus === "sending" && (
                    <div className="flex items-center gap-2 justify-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <span className="animate-spin text-sm">⏳</span>
                      <span className="font-medium">Sending proposal PDF email copies in background...</span>
                    </div>
                  )}
                  {proposalEmailStatus === "sent" && (
                    <div className="flex items-center gap-2 justify-center text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className="font-medium">Signed PDF copies successfully emailed to your inbox.</span>
                    </div>
                  )}
                  {proposalEmailStatus === "failed" && (
                    <div className="flex flex-col gap-1 text-left text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                      <span className="font-bold">⚠️ Email Delivery Delayed:</span>
                      <span className="text-muted-foreground">The system was unable to deliver copies via email: {proposalEmailError || "SMTP connection issue"}. However, your signed proposal is saved and downloadable below.</span>
                    </div>
                  )}
                  {proposalSigned && onResendSignedProposal && (
                    <button
                      onClick={async () => {
                        try {
                          await onResendSignedProposal();
                          toast.success("Signed proposal email resend queued!");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to resend email");
                        }
                      }}
                      className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer mx-auto"
                    >
                      🔄 Resend Signed Proposal Email
                    </button>
                  )}
                </div>
              )}

              {proposalPdfUrl && (
                <a href={apiUrl(proposalPdfUrl)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all">
                  📥 Download Signed PDF
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Room checklist */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-foreground">Room Checklist Summary</h3>
        {sections.map(sec => {
          const secConfirmed = sec.slots.filter(s => (s.selectedItems && s.selectedItems.length > 0) || (s.selectionId && s.state === "confirmed"));
          const pct = sec.slots.length ? Math.round((secConfirmed.length / sec.slots.length) * 100) : 0;
          return (
            <div key={sec.key} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{sec.icon}</span>
                  <span className="font-bold text-sm text-foreground">{sec.title}</span>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">{secConfirmed.length}/{sec.slots.length} done</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="space-y-1">
                {sec.slots.map(sl => {
                  const isConf = (sl.selectedItems && sl.selectedItems.length > 0) || (sl.selectionId && sl.state === "confirmed");
                  return (
                    <div key={sl.slotKey} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground font-medium truncate">{sl.slotLabel}</span>
                      <span className={`font-bold ml-4 shrink-0 ${isConf ? "text-emerald-600" : sl.isSkipped ? "text-gray-400" : "text-amber-600"}`}>
                        {isConf ? "✓ Done" : sl.isSkipped ? "⏭ Skipped" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cart Summary Sidebar (Right panel) ─────────────────────────────────────

function CartSummary({
  sections,
  completedCount,
  totalSlots,
  onNavigateToSlot,
  showPrices = true,
  isAdmin = false,
}: {
  sections: HOSection[];
  completedCount: number;
  totalSlots: number;
  onNavigateToSlot: (slotKey: string, sectionKey: string) => void;
  showPrices?: boolean;
  isAdmin?: boolean;
}) {
  const allSelected = sections.flatMap(sec =>
    sec.slots.flatMap(slot =>
      (slot.selectedItems || []).map(item => ({ ...item, slotLabel: slot.slotLabel, sectionTitle: slot.sectionTitle, slotKey: slot.slotKey, sectionKey: sec.key }))
    )
  );

  const grandTotal = allSelected.reduce((s, it) => s + it.priceUsed * it.quantity, 0);
  const pct = totalSlots ? Math.round((completedCount / totalSlots) * 100) : 0;

  return (
    <aside className="flex flex-col h-full bg-card border-l border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-primary/5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          🛒 <span>Selection Cart</span>
          {allSelected.length > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">{allSelected.length}</span>}
        </h3>
        {/* Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Overall Progress</span>
            <span className="font-bold text-foreground">{completedCount}/{totalSlots}</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{pct}% complete</p>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {allSelected.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <span className="text-4xl mb-3">🏠</span>
            <p className="text-sm font-semibold text-muted-foreground">No selections yet</p>
            <p className="text-xs text-muted-foreground mt-1">Browse items in the center panel</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {allSelected.map(item => (
              <button key={item.selectionId} onClick={() => onNavigateToSlot(item.slotKey, item.sectionKey)}
                className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-muted/60 transition-colors border border-transparent hover:border-border group">
                {item.imageUrl ? (
                  <div className="w-10 h-10 rounded-lg bg-white border border-border shrink-0 flex items-center justify-center p-0.5">
                    <img src={item.imageUrl} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">🏠</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground font-semibold truncate">{item.sectionTitle} › {item.slotLabel}</p>
                  <p className="text-xs font-bold text-foreground truncate">{item.product || item.model}</p>
                  {(!showPrices && !isAdmin) ? null : (
                    <p className="text-xs text-primary font-semibold">{formatCurrency(item.priceUsed)} {item.quantity > 1 ? `× ${item.quantity}` : ""}</p>
                  )}
                </div>
                {(!showPrices && !isAdmin) ? null : (
                  <span className="text-xs font-bold text-foreground shrink-0">{formatCurrency(item.priceUsed * item.quantity)}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer totals */}
      {allSelected.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/30 space-y-3">
          {(!showPrices && !isAdmin) ? (
            <p className="text-xs text-muted-foreground text-center italic">Pricing details hidden by Project Manager</p>
          ) : (
            <>
              {sections.map(sec => {
                const secTotal = sec.slots.reduce((s, sl) => s + (sl.selectedItems?.reduce((s2, it) => s2 + it.priceUsed * it.quantity, 0) || 0), 0);
                if (secTotal === 0) return null;
                return (
                  <div key={sec.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{sec.icon} {sec.title}</span>
                    <span className="font-bold text-foreground">{formatCurrency(secTotal)}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-bold text-foreground">Grand Total</span>
                <span className="text-lg font-extrabold text-primary">{formatCurrency(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

// ─── Product Grid ──────────────────────────────────────────────────────────────

function ProductGrid({
  slot,
  decideLaterKeys,
  proposalSigned,
  unlockedCategoryKeys,
  onToggleDecideLater,
  onSkipCategory,
  onRemoveSelection,
  onToggleCompare,
  comparedItems,
  onOpenDetail,
  isAdmin = false,
  projectLocked = false,
  projectStatus,
  onUnlockCategory,
  onToggleProjectLock,
  onUpdateProjectStatus,
  showPrices = true,
}: {
  slot: HoSlot;
  decideLaterKeys: Set<string>;
  proposalSigned: boolean;
  unlockedCategoryKeys: string[];
  onToggleDecideLater: (slotKey: string, val: boolean) => void;
  onSkipCategory?: (slotKey: string) => void;
  onRemoveSelection: (slotKey: string) => void;
  onToggleCompare: (item: HoSwatchItem) => void;
  comparedItems: HoSwatchItem[];
  onOpenDetail: (item: HoSwatchItem) => void;
  isAdmin?: boolean;
  projectLocked?: boolean;
  projectStatus?: string;
  onUnlockCategory?: (slotKey: string, unlock: boolean) => Promise<void>;
  onToggleProjectLock?: (locked: boolean) => Promise<void>;
  onUpdateProjectStatus?: (newStatus: string) => Promise<void>;
  showPrices?: boolean;
}) {
  const isLocked = isSlotLocked(
    slot.slotKey,
    !!isAdmin,
    proposalSigned,
    unlockedCategoryKeys,
    !!projectLocked,
    projectStatus
  );
  const isDecideLater = decideLaterKeys.has(slot.slotKey);
  const status = getSlotStatus(slot, decideLaterKeys);
  const st = STATUS_STYLES[status];
  const hasSelections = slot.selectedItems && slot.selectedItems.length > 0;

  // Track the active subcategory filter
  const [activeSubGroup, setActiveSubGroup] = useState<string>("All");

  // Reset filter when switching between slots
  useEffect(() => {
    setActiveSubGroup("All");
  }, [slot.slotKey]);

  // Extract unique subcategories from the available items
  const subGroups = useMemo(() => {
    if (!slot.availableItems) return [];
    const groupsSet = new Set<string>();
    slot.availableItems.forEach((item) => {
      if (item.categoryKey) {
        const parts = item.categoryKey.split(" - ");
        if (parts.length > 2) {
          groupsSet.add(parts[2].trim());
        }
      }
    });
    return Array.from(groupsSet).sort();
  }, [slot.availableItems]);

  // Filter items based on selected subcategory
  const filteredItems = useMemo(() => {
    if (!slot.availableItems) return [];
    if (activeSubGroup === "All") return slot.availableItems;
    return slot.availableItems.filter((item) => {
      if (!item.categoryKey) return false;
      const parts = item.categoryKey.split(" - ");
      return parts.length > 2 && parts[2].trim() === activeSubGroup;
    });
  }, [slot.availableItems, activeSubGroup]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Slot header */}
      <div className="px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              {slot.sectionTitle}{slot.subsectionTitle ? ` › ${slot.subsectionTitle}` : ""}
            </p>
            <h2 className="text-xl font-bold text-foreground mt-0.5">{slot.slotLabel}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${st.dot}`} />
              <span className={`text-xs font-semibold ${st.text}`}>{st.label}</span>
              {hasSelections && (
                <span className="text-xs text-muted-foreground">
                  · {slot.selectedItems!.length} item{slot.selectedItems!.length !== 1 ? "s" : ""}
                  {(!showPrices && !isAdmin) ? null : ` · ${formatCurrency(slot.selectedItems!.reduce((s, it) => s + it.priceUsed * it.quantity, 0))}`}
                </span>
              )}
            </div>
          </div>
          {!isLocked && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => onToggleDecideLater(slot.slotKey, !isDecideLater)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${isDecideLater ? "bg-amber-100 border-amber-300 text-amber-800" : "border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700"}`}>
                ⏰ {isDecideLater ? "Unmark" : "Decide Later"}
              </button>
              <button onClick={() => onSkipCategory?.(slot.slotKey)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-all">
                ⏭ Skip
              </button>
            </div>
          )}
        </div>

        {/* Selected items summary bar */}
        {hasSelections && (
          <div className="mt-3 flex flex-wrap gap-2">
            {slot.selectedItems!.map(sel => (
              <div key={sel.selectionId} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                {sel.imageUrl && <img src={sel.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />}
                <span className="text-xs font-semibold text-emerald-800 truncate max-w-[140px]">{sel.product || sel.model}</span>
                <span className="text-xs text-emerald-600">×{sel.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skipped state */}
      {slot.isSkipped ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-4">
          <span className="text-5xl">⏭️</span>
          <h3 className="text-lg font-bold text-foreground">Category Skipped</h3>
          <p className="text-sm text-muted-foreground max-w-xs">This category is marked as not in scope.</p>
          {!isLocked && (
            <button onClick={() => onRemoveSelection(slot.slotKey)}
              className="px-5 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">
              Undo Skip
            </button>
          )}
        </div>
      ) : (
        /* Product grid */
        <div className="flex-1 flex flex-col overflow-hidden p-5 bg-card/25">
          {isAdmin && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
              <div>
                <h4 className="text-sm font-bold text-foreground">🛠️ Admin & PM Controls</h4>
                <p className="text-xs text-muted-foreground">You are modifying selections on behalf of the homeowner.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onUnlockCategory?.(slot.slotKey, !unlockedCategoryKeys.includes(slot.slotKey))}
                  className={`text-xs font-bold px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    unlockedCategoryKeys.includes(slot.slotKey)
                      ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {unlockedCategoryKeys.includes(slot.slotKey) ? "🔓 Unlocked for Homeowner" : "🔒 Locked for Homeowner"}
                </button>
                <button
                  onClick={() => onToggleProjectLock?.(!projectLocked)}
                  className={`text-xs font-bold px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    projectLocked
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {projectLocked ? "🔒 Entire Sheet Locked" : "🔓 Entire Sheet Unlocked"}
                </button>
                {projectStatus === "selections_submitted" && (
                  <button
                    onClick={() => onUpdateProjectStatus?.("selections_in_progress")}
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer"
                  >
                    🔄 Re-Open (Unlock) Submitted Sheet
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Subgroups/Filters pills bar */}
          {subGroups.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-4 border-b border-border/40 shrink-0 scrollbar-none">
              <button
                onClick={() => setActiveSubGroup("All")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                  activeSubGroup === "All"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                All ({slot.availableItems.length})
              </button>
              {subGroups.map((group) => {
                const count = slot.availableItems.filter((item) => {
                  if (!item.categoryKey) return false;
                  const parts = item.categoryKey.split(" - ");
                  return parts.length > 2 && parts[2].trim() === group;
                }).length;
                return (
                  <button
                    key={group}
                    onClick={() => setActiveSubGroup(group)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                      activeSubGroup === group
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {group} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <span className="text-4xl">📦</span>
              <p className="text-sm text-muted-foreground">No items available for this category yet.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item, idx) => {
                  const isConfirmed = slot.selectedItems?.some(s => s.libraryItemId === item.id);
                  const isComparing = comparedItems.some(c => c.id === item.id);
                  const lvl = getLevelBadge(item.level);
                return (
                  <div key={item.id}
                    className={`group relative bg-card rounded-2xl border-2 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${
                      isConfirmed ? "border-emerald-400 shadow-emerald-100 shadow-md" : "border-border hover:border-primary/40"
                    } ${isLocked && !isConfirmed ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => { if (!isLocked || isConfirmed) onOpenDetail(item); }}>
                    
                    {/* Image */}
                    <div className="relative h-36 bg-muted overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.product} className="w-full h-full object-contain bg-white p-3 group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground">🏠</div>
                      )}
                      {/* Number badge */}
                      <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                      {/* Level badge */}
                      {item.level && (
                        <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lvl.className}`}>{lvl.label}</span>
                      )}
                      {/* Confirmed overlay */}
                      {isConfirmed && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-end justify-end p-2">
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Selected</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate">{item.manufacturer || "Standard"}</p>
                      <p className="text-sm font-bold text-foreground truncate mt-0.5" title={item.product || item.model}>{item.product || item.model}</p>
                      <p className="text-sm font-extrabold text-primary mt-1">{(!showPrices && !isAdmin) ? "Included" : formatCurrency(item.priceMin || 0)}</p>
                    </div>

                    {/* Action row */}
                    <div className="px-3 pb-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onOpenDetail(item)}
                        className="flex-1 py-1.5 text-[11px] font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                        View Details
                      </button>
                      <label className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border cursor-pointer text-[10px] font-bold transition-all ${isComparing ? "bg-secondary/20 border-secondary/60 text-secondary-foreground" : "border-border text-muted-foreground hover:border-secondary/40"}`}
                        onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isComparing} onChange={() => onToggleCompare(item)} className="hidden" />
                        ⚖️
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Decide later notice */}
          {isDecideLater && (
            <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span>⏰</span>
              <p className="text-xs text-amber-800 font-semibold">This slot is marked "Decide Later" — you can still browse and select items.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HomeownerSelectionsTab({
  sections,
  proposalSigned,
  unlockedCategoryKeys,
  onSelectItem,
  onRemoveSelection,
  onToggleDecideLater,
  decideLaterKeys,
  lastVisitedCategoryKey,
  onVisitSlot,
  onSkipCategory,
  onRemoveSelectionItem,
  onUpdateQuantity,
  onSubmitSelections,
  onSubmitProposal,
  proposalPdfUrl,
  projectStatus,
  isAdmin = false,
  projectLocked = false,
  onUnlockCategory,
  onToggleProjectLock,
  onUpdateProjectStatus,
  onSaveRooms,
  availableCategories = [],
  projectId,
  proposalEmailStatus,
  proposalEmailError,
  proposalSignedAt,
  proposalSignedBy,
  proposalSignatureType,
  proposalTypedName,
  proposalSignatureIp,
  proposalSignatureGeo,
  showPrices = true,
  onResendSignedProposal,
}: HomeownerSelectionsTabProps) {


  // ── Layout state ──
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Navigation state ──
  const extendedSections = useMemo(() => [
    ...sections,
    { key: "review-submit", title: "Review & Submit", icon: "📋", slots: [] }
  ], [sections]);

  const [activeSectionKey, setActiveSectionKey] = useState<string>(() => {
    if (lastVisitedCategoryKey) {
      const found = sections.find(s => s.slots.some(sl => sl.slotKey === lastVisitedCategoryKey));
      if (found) return found.key;
    }
    return sections[0]?.key || "";
  });

  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(() => {
    if (lastVisitedCategoryKey) return lastVisitedCategoryKey;
    const sec = sections[0];
    return sec?.slots[0]?.slotKey || null;
  });

  const [openGroupNames, setOpenGroupNames] = useState<Set<string>>(() => {
    const firstSlot = sections[0]?.slots[0];
    return firstSlot ? new Set([getSlotGroupName(firstSlot)]) : new Set();
  });

  // ── Comparison state ──
  const [comparedItems, setComparedItems] = useState<HoSwatchItem[]>([]);
  const [comparisonSlotKey, setComparisonSlotKey] = useState<string | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const handleToggleCompare = useCallback((item: HoSwatchItem) => {
    setComparedItems(prev => {
      if (prev.some(c => c.id === item.id)) return prev.filter(c => c.id !== item.id);
      if (prev.length >= 3) { alert("Max 3 items to compare."); return prev; }
      return [...prev, item];
    });
    setComparisonSlotKey(activeSlotKey);
  }, [activeSlotKey]);

  // ── Detail modal ──
  const [detailItem, setDetailItem] = useState<HoSwatchItem | null>(null);

  // ── Decide Later drawer ──
  const [isDecideLaterOpen, setIsDecideLaterOpen] = useState(false);

  const flaggedSlots = useMemo(() => {
    const list: { slot: HoSlot; section: HOSection }[] = [];
    sections.forEach(sec => sec.slots.forEach(slot => {
      if (decideLaterKeys.has(slot.slotKey)) list.push({ slot, section: sec });
    }));
    return list;
  }, [sections, decideLaterKeys]);

  // ── Stats ──
  const { completedCount, totalSlots } = useMemo(() => {
    const total = sections.reduce((s, sec) => s + sec.slots.length, 0);
    const done = sections.reduce((s, sec) => s + sec.slots.filter(sl =>
      (sl.selectedItems && sl.selectedItems.length > 0) || (sl.selectionId && sl.state === "confirmed") || sl.isSkipped
    ).length, 0);
    return { completedCount: done, totalSlots: total };
  }, [sections]);

  // ── Active data ──
  const activeSection = useMemo(() => extendedSections.find(s => s.key === activeSectionKey) || null, [extendedSections, activeSectionKey]);
  const activeSlot = useMemo(() => {
    if (!activeSlotKey) return null;
    for (const sec of sections) {
      const sl = sec.slots.find(s => s.slotKey === activeSlotKey);
      if (sl) return sl;
    }
    return null;
  }, [activeSlotKey, sections]);

  // groupedSlots — computed inline in sidebar render

  // ── Handlers ──
  const handleRoomChange = useCallback((roomKey: string) => {
    setActiveSectionKey(roomKey);
    const found = sections.find(s => s.key === roomKey);
    if (found?.slots.length) {
      const first = found.slots[0];
      setActiveSlotKey(first.slotKey);
      onVisitSlot?.(first.slotKey);
      setOpenGroupNames(new Set([getSlotGroupName(first)]));
    }
    setComparedItems([]);
    setDetailItem(null);
  }, [sections, onVisitSlot]);

  const handleSlotClick = useCallback((slot: HoSlot, sectionKey: string) => {
    setActiveSectionKey(sectionKey);
    setActiveSlotKey(slot.slotKey);
    onVisitSlot?.(slot.slotKey);
    setDetailItem(null);
    setComparedItems([]);
  }, [onVisitSlot]);

  const handleNavigateToSlot = useCallback((slotKey: string, sectionKey: string) => {
    setActiveSectionKey(sectionKey);
    setActiveSlotKey(slotKey);
    onVisitSlot?.(slotKey);
    const sec = sections.find(s => s.key === sectionKey);
    const slot = sec?.slots.find(sl => sl.slotKey === slotKey);
    if (slot) {
      const groupName = getSlotGroupName(slot);
      setOpenGroupNames(prev => { const n = new Set(prev); n.add(groupName); return n; });
    }
  }, [sections, onVisitSlot]);

  // ── Room Wizard View mode (new) ──
  const [viewMode, setViewMode] = useState<"wizard" | "sheet">("wizard");

  // ── Room progress ──
  const roomProgressPct = useMemo(() => {
    if (!activeSection || !activeSection.slots.length) return 0;
    const done = activeSection.slots.filter(s => (s.selectedItems && s.selectedItems.length > 0) || (s.selectionId && s.state === "confirmed")).length;
    return Math.round((done / activeSection.slots.length) * 100);
  }, [activeSection]);

  const decideLaterCount = useMemo(() => sections.reduce((s, sec) => s + sec.slots.filter(sl => decideLaterKeys.has(sl.slotKey)).length, 0), [sections, decideLaterKeys]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
      {/* ── View Toggle Header ── */}
      <div className="flex justify-between items-center bg-card border-b border-border px-6 py-3 shrink-0">
        <div className="flex bg-muted p-1 rounded-xl border border-border w-fit gap-1">
          <button
            onClick={() => setViewMode("wizard")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              viewMode === "wizard" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ Room Wizard
          </button>
          <button
            onClick={() => setViewMode("sheet")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              viewMode === "sheet" ? "bg-card text-foreground shadow-sm font-extrabold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Selection Sheet
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">


      {/* ──────── MAIN WORKSPACE AREA ──────── */}
      {viewMode === "wizard" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Vertical Room Navigation Rail */}
          <div className="w-56 bg-card border-r border-border flex flex-col justify-between shrink-0">
            <div className="flex-1 overflow-y-auto py-4 space-y-1">
              <div className="px-4 pb-2 border-b border-border mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Rooms Configured
                </span>
              </div>
              {extendedSections.map((sec) => {
                const isActive = activeSectionKey === sec.key;
                const secCompleted = sec.slots.filter(sl =>
                  (sl.selectedItems && sl.selectedItems.length > 0) || (sl.selectionId && sl.state === "confirmed") || sl.isSkipped
                ).length;
                const secTotal = sec.slots.length;
                
                return (
                  <button
                    key={sec.key}
                    onClick={() => {
                      setActiveSectionKey(sec.key);
                      if (sec.slots.length > 0) {
                        setActiveSlotKey(sec.slots[0].slotKey);
                      } else {
                        setActiveSlotKey(null);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${
                      isActive
                        ? "bg-primary/10 border-l-4 border-l-primary text-primary font-bold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base">{sec.icon}</span>
                      <span className="text-xs truncate">{sec.title}</span>
                    </div>
                    {secTotal > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        secCompleted === secTotal ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                      }`}>
                        {secCompleted}/{secTotal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-border space-y-2">
              {onSaveRooms && (
                <button
                  onClick={() => {
                    const roomName = prompt("Enter new room name:");
                    if (!roomName) return;
                    const emoji = prompt("Enter room emoji:", "🏠") || "🏠";
                    
                    const existingRooms = sections.filter(s => s.key !== "review-submit").map(s => ({
                      id: s.key,
                      name: s.title,
                      icon: s.icon,
                      slots: s.slots.map(sl => ({
                        categoryKey: sl.slotKey,
                        slotLabel: sl.slotLabel,
                        required: false,
                      })),
                    }));

                    const newRoom = {
                      id: `room-${Date.now()}`,
                      name: roomName,
                      icon: emoji,
                      slots: [],
                    };

                    onSaveRooms([...existingRooms, newRoom]).then(() => {
                      setActiveSectionKey(newRoom.id);
                    });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all cursor-pointer mb-2"
                >
                  ➕ Add Custom Room
                </button>
              )}
              <button
                onClick={() => setIsDecideLaterOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-800 text-xs font-bold transition-all"
              >
                ⏰ Later ({decideLaterCount})
              </button>

            </div>
          </div>

          {/* Center Card-Based Wizard flow */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
            {activeSectionKey === "review-submit" ? (
              <div className="flex-1 overflow-y-auto px-6">
                <ReviewSubmitPanel
                  sections={sections}
                  decideLaterKeys={decideLaterKeys}
                  projectStatus={projectStatus}
                  proposalSigned={proposalSigned}
                  proposalPdfUrl={proposalPdfUrl}
                  onSubmitSelections={onSubmitSelections}
                  onSubmitProposal={onSubmitProposal}
                  isAdmin={isAdmin}
                  onUpdateProjectStatus={onUpdateProjectStatus}
                  onToggleProjectLock={onToggleProjectLock}
                  projectId={projectId}
                  proposalEmailStatus={proposalEmailStatus}
                  proposalEmailError={proposalEmailError}
                  proposalSignedAt={proposalSignedAt}
                  proposalSignedBy={proposalSignedBy}
                  onResendSignedProposal={onResendSignedProposal}
                  proposalSignatureType={proposalSignatureType}
                  proposalTypedName={proposalTypedName}
                  proposalSignatureIp={proposalSignatureIp}
                  proposalSignatureGeo={proposalSignatureGeo}
                  showPrices={showPrices}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Room Header Banner */}
                {activeSection && (
                  <div className="px-6 py-4 border-b border-border bg-card flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{activeSection.icon}</span>
                      <div>
                        <h2 className="text-base font-bold text-foreground">{activeSection.title} Selections</h2>
                        <p className="text-xs text-muted-foreground">Complete all required slots for this room.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-full sm:w-36 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${roomProgressPct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground font-bold shrink-0">{roomProgressPct}% Done</span>
                    </div>
                  </div>
                )}

                {/* Subsections & Slot Config Cards */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {onSaveRooms && activeSection && activeSection.key !== "review-submit" && (
                    <div className="bg-muted/40 p-4 border border-dashed border-border rounded-2xl flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-muted-foreground uppercase">➕ Customize this room: add item slot</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const catName = availableCategories.find(c => c.categoryKey === val)?.label.split(" › ").pop() || val;
                          
                          const existingRooms = sections.filter(s => s.key !== "review-submit").map(s => ({
                            id: s.key,
                            name: s.title,
                            icon: s.icon,
                            slots: s.slots.map(sl => ({
                              categoryKey: sl.slotKey,
                              slotLabel: sl.slotLabel,
                              required: false,
                            })),
                          }));

                          const targetRoomIndex = existingRooms.findIndex(r => r.id === activeSection.key);
                          if (targetRoomIndex > -1) {
                            existingRooms[targetRoomIndex].slots.push({
                              categoryKey: val,
                              slotLabel: catName,
                              required: false,
                            });
                            onSaveRooms(existingRooms).then(() => {
                              setActiveSlotKey(val);
                            });
                          }
                          e.target.value = "";
                        }}
                        className="px-3 py-1.5 border border-input rounded-xl bg-background"
                      >
                        <option value="" disabled>-- Add category slot --</option>
                        {availableCategories.map(c => (
                          <option key={c.categoryKey} value={c.categoryKey}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeSection && activeSection.slots.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-2xl border border-border">
                      <span className="text-4xl">✨</span>
                      <p className="text-sm text-muted-foreground mt-2">No selections slots configured for this room.</p>
                    </div>
                  ) : (
                    <div className="space-y-8">

                      {activeSection?.slots.map((slot) => {
                        const status = getSlotStatus(slot, decideLaterKeys);
                        const isSlotActive = activeSlotKey === slot.slotKey;
                        const isConfirmed = status === "confirmed";

                        return (
                          <div
                            key={slot.slotKey}
                            id={`slot-card-${slot.slotKey}`}
                            className={`bg-card rounded-2xl border-2 transition-all shadow-sm ${
                              isSlotActive
                                ? "border-primary ring-2 ring-primary/10"
                                : isConfirmed
                                ? "border-emerald-400/60"
                                : "border-border hover:border-border/80"
                            }`}
                          >
                            {/* Slot header */}
                            <div
                              onClick={() => setActiveSlotKey(slot.slotKey)}
                              className="p-5 flex justify-between items-start md:items-center gap-4 cursor-pointer"
                            >
                              <div>
                                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                  {slot.categoryKey?.split(" - ").slice(-1)[0] || ""}
                                </span>

                                <h3 className="text-sm font-bold text-foreground mt-1.5 flex items-center gap-2">
                                  {slot.slotLabel}
                                  {slot.selectedItems && slot.selectedItems.length > 0 && (
                                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                      ✓ Selected
                                    </span>
                                  )}
                                </h3>
                              </div>

                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => onToggleDecideLater(slot.slotKey, status !== "decide-later")}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    status === "decide-later"
                                      ? "bg-amber-100 border-amber-300 text-amber-800"
                                      : "bg-background border-border hover:bg-muted"
                                  }`}
                                >
                                  ⏰ Later
                                </button>
                                <button
                                  onClick={() => onSkipCategory?.(slot.slotKey)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    status === "skipped"
                                      ? "bg-gray-100 border-gray-300 text-gray-800"
                                      : "bg-background border-border hover:bg-muted"
                                  }`}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>

                            {/* Options Swatches Catalog directly inline */}
                            {isSlotActive && (
                              <div className="p-5 border-t border-border bg-muted/10">
                                <ProductGrid
                                  slot={slot}
                                  decideLaterKeys={decideLaterKeys}
                                  proposalSigned={proposalSigned}
                                  unlockedCategoryKeys={unlockedCategoryKeys}
                                  onToggleDecideLater={onToggleDecideLater}
                                  onSkipCategory={onSkipCategory}
                                  onRemoveSelection={onRemoveSelection}
                                  onToggleCompare={handleToggleCompare}
                                  comparedItems={comparedItems}
                                  onOpenDetail={setDetailItem}
                                  isAdmin={isAdmin}
                                  projectLocked={projectLocked}
                                  projectStatus={projectStatus}
                                  onUnlockCategory={onUnlockCategory}
                                  onToggleProjectLock={onToggleProjectLock}
                                  onUpdateProjectStatus={onUpdateProjectStatus}
                                  showPrices={showPrices}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* ──────── LEFT SIDEBAR ──────── */}
          <nav className="w-64 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
            {/* Overall progress */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground">My Selections</span>
                <span className="text-xs text-muted-foreground font-semibold">{completedCount}/{totalSlots}</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${totalSlots ? Math.round((completedCount / totalSlots) * 100) : 0}%` }} />
              </div>
            </div>

            {/* Decide Later button */}
            {decideLaterCount > 0 && (
              <button onClick={() => setIsDecideLaterOpen(true)}
                className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors">
                ⏰ Decide Later
                <span className="ml-auto bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">{decideLaterCount}</span>
              </button>
            )}

            {/* Room tabs + slots */}
            <div className="flex-1 overflow-y-auto py-3">
              {extendedSections.map(sec => {
                const isRoomActive = activeSectionKey === sec.key;
                const secCompleted = sec.slots.filter(sl =>
                  (sl.selectedItems && sl.selectedItems.length > 0) || (sl.selectionId && sl.state === "confirmed") || sl.isSkipped
                ).length;
                const secTotal = sec.slots.length;
                const groups: Record<string, HoSlot[]> = {};
                sec.slots.forEach(sl => {
                  const g = getSlotGroupName(sl);
                  if (!groups[g]) groups[g] = [];
                  groups[g].push(sl);
                });

                return (
                  <div key={sec.key} className="mb-1">
                    {/* Room header */}
                    <button
                      onClick={() => { if (sec.key === "review-submit") { setActiveSectionKey(sec.key); setActiveSlotKey(null); } else handleRoomChange(sec.key); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all hover:bg-muted/60 ${isRoomActive ? "bg-primary/8" : ""}`}>
                      <span className="text-base shrink-0">{sec.icon}</span>
                      <span className={`text-sm font-bold flex-1 truncate ${isRoomActive ? "text-primary" : "text-foreground"}`}>{sec.title}</span>
                      {secTotal > 0 && (
                        <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full ${secCompleted === secTotal ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                          {secCompleted}/{secTotal}
                        </span>
                      )}
                    </button>

                    {/* Groups + slots (when room is active) */}
                    {isRoomActive && sec.key !== "review-submit" && Object.entries(groups).map(([groupName, slots]) => {
                      const isGroupOpen = openGroupNames.has(groupName);
                      const groupDone = slots.filter(sl => (sl.selectedItems && sl.selectedItems.length > 0) || (sl.selectionId && sl.state === "confirmed")).length;

                      return (
                        <div key={groupName}>
                          <button
                            onClick={() => setOpenGroupNames(prev => { const n = new Set(prev); if (n.has(groupName)) n.delete(groupName); else n.add(groupName); return n; })}
                            className="w-full flex items-center gap-2 px-5 py-1.5 text-left hover:bg-muted/40 transition-colors">
                            <span className={`text-[9px] transition-transform duration-200 text-muted-foreground ${isGroupOpen ? "rotate-90" : ""}`}>▶</span>
                            <span className="text-xs font-bold text-muted-foreground flex-1 truncate">{groupName}</span>
                            <span className="text-[10px] text-muted-foreground">{groupDone}/{slots.length}</span>
                          </button>
                          {isGroupOpen && (
                            <div className="ml-5 border-l border-border/60 pl-2">
                              {slots.map(slot => {
                                const status = getSlotStatus(slot, decideLaterKeys);
                                const st = STATUS_STYLES[status];
                                const isActive = activeSlotKey === slot.slotKey;
                                return (
                                  <button key={slot.slotKey}
                                    onClick={() => handleSlotClick(slot, sec.key)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all mb-0.5 ${isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 border border-transparent"}`}>
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1">
                                        <p className={`text-xs font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>{slot.slotLabel}</p>
                                        {isAdmin && (
                                          <span className="text-[10px] text-muted-foreground shrink-0 select-none" title={unlockedCategoryKeys.includes(slot.slotKey) ? "Unlocked for homeowner" : "Locked for homeowner"}>
                                            {unlockedCategoryKeys.includes(slot.slotKey) ? "🔓" : "🔒"}
                                          </span>
                                        )}
                                      </div>
                                      {status === "confirmed" && slot.selectedItems && (
                                        <p className="text-[10px] text-emerald-600 font-medium truncate">{slot.selectedItems[0]?.product || slot.selectedItems[0]?.model}</p>
                                      )}
                                      {status === "decide-later" && <p className="text-[10px] text-amber-600 font-medium">Decide Later</p>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* ──────── CENTER PANEL ──────── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {activeSectionKey === "review-submit" ? (
              <div className="flex-1 overflow-y-auto px-6">
                <ReviewSubmitPanel
                  sections={sections}
                  decideLaterKeys={decideLaterKeys}
                  projectStatus={projectStatus}
                  proposalSigned={proposalSigned}
                  proposalPdfUrl={proposalPdfUrl}
                  onSubmitSelections={onSubmitSelections}
                  onSubmitProposal={onSubmitProposal}
                  isAdmin={isAdmin}
                  onUpdateProjectStatus={onUpdateProjectStatus}
                  onToggleProjectLock={onToggleProjectLock}
                  projectId={projectId}
                  proposalEmailStatus={proposalEmailStatus}
                  proposalEmailError={proposalEmailError}
                  proposalSignedAt={proposalSignedAt}
                  proposalSignedBy={proposalSignedBy}
                  onResendSignedProposal={onResendSignedProposal}
                  proposalSignatureType={proposalSignatureType}
                  proposalTypedName={proposalTypedName}
                  proposalSignatureIp={proposalSignatureIp}
                  proposalSignatureGeo={proposalSignatureGeo}
                  showPrices={showPrices}
                />
              </div>
            ) : !activeSlot ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <span className="text-6xl mb-4">🏡</span>
                <h3 className="text-xl font-bold text-foreground mb-2">Select a Category</h3>
                <p className="text-sm text-muted-foreground max-w-xs">Choose a room and category from the sidebar to browse available options.</p>
              </div>
            ) : (
              <>
                {/* Room progress strip */}
                {activeSection && activeSection.key !== "review-submit" && (
                  <div className="px-6 py-2 border-b border-border bg-muted/30 flex items-center gap-4">
                    <span className="text-sm font-bold text-foreground">{activeSection.icon} {activeSection.title}</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${roomProgressPct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold shrink-0">{roomProgressPct}%</span>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <ProductGrid
                    slot={activeSlot}
                    decideLaterKeys={decideLaterKeys}
                    proposalSigned={proposalSigned}
                    unlockedCategoryKeys={unlockedCategoryKeys}
                    onToggleDecideLater={onToggleDecideLater}
                    onSkipCategory={onSkipCategory}
                    onRemoveSelection={onRemoveSelection}
                    onToggleCompare={handleToggleCompare}
                    comparedItems={comparedItems}
                    onOpenDetail={setDetailItem}
                    isAdmin={isAdmin}
                    projectLocked={projectLocked}
                    projectStatus={projectStatus}
                    onUnlockCategory={onUnlockCategory}
                    onToggleProjectLock={onToggleProjectLock}
                    onUpdateProjectStatus={onUpdateProjectStatus}
                    showPrices={showPrices}
                  />
                </div>
              </>
            )}
          </main>

          {/* ──────── RIGHT CART SIDEBAR ──────── */}
          {isDesktop && (
            <div className="w-64 shrink-0 overflow-hidden">
              <CartSummary
                sections={sections}
                completedCount={completedCount}
                totalSlots={totalSlots}
                onNavigateToSlot={handleNavigateToSlot}
                showPrices={showPrices}
                isAdmin={isAdmin}
              />
            </div>
          )}
        </div>
      )}


      {/* ──────── PRODUCT DETAIL MODAL ──────── */}
      {detailItem && activeSlot && (
        <ProductDetailModal
          item={detailItem}
          slot={activeSlot}
          isLocked={isSlotLocked(
            activeSlot.slotKey,
            !!isAdmin,
            proposalSigned,
            unlockedCategoryKeys,
            !!projectLocked,
            projectStatus
          )}
          onClose={() => setDetailItem(null)}
          onSelect={() => onSelectItem(activeSlot.slotKey, detailItem.id, detailItem.priceMin || 0, 1)}
          onRemoveSelectionItem={onRemoveSelectionItem}
          onUpdateQuantity={onUpdateQuantity}
          showPrices={showPrices}
          isAdmin={isAdmin}
        />
      )}

      {/* ──────── COMPARE DRAWER ──────── */}
      {isCompareOpen && comparedItems.length > 0 && activeSlot && (
        <CompareDrawer
          items={comparedItems}
          slotKey={comparisonSlotKey}
          sections={sections}
          onSelectItem={onSelectItem}
          onToggleItem={handleToggleCompare}
          onClose={() => setIsCompareOpen(false)}
          isLocked={isSlotLocked(
            activeSlot.slotKey,
            !!isAdmin,
            proposalSigned,
            unlockedCategoryKeys,
            !!projectLocked,
            projectStatus
          )}
          showPrices={showPrices}
          isAdmin={isAdmin}
        />
      )}

      {/* ──────── COMPARE FAB ──────── */}
      {comparedItems.length > 0 && !isCompareOpen && (
        <button onClick={() => setIsCompareOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-primary text-primary-foreground px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm hover:opacity-90 active:scale-[0.97] transition-all">
          ⚖️ Compare {comparedItems.length} Items
          <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">View →</span>
        </button>
      )}

      {/* ──────── DECIDE LATER DRAWER ──────── */}
      {isDecideLaterOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => setIsDecideLaterOpen(false)} />
          <aside className="fixed right-0 top-0 h-full z-[91] w-80 bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">⏰ Decide Later ({flaggedSlots.length})</h3>
              <button onClick={() => setIsDecideLaterOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {flaggedSlots.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <span className="text-4xl block mb-3">🎉</span>
                  <p className="text-sm">No items flagged!</p>
                </div>
              ) : flaggedSlots.map(({ slot, section }) => (
                <button key={slot.slotKey}
                  onClick={() => { handleNavigateToSlot(slot.slotKey, section.key); setIsDecideLaterOpen(false); }}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition-all">
                  <span className="text-xl">{section.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{slot.slotLabel}</p>
                    <p className="text-xs text-muted-foreground">{section.title}</p>
                  </div>
                  <span className="text-xs text-primary font-bold shrink-0">Go ⚡</span>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
      </div>
    </div>
  );
}
