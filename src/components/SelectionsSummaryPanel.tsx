import { useState, useMemo, useRef } from "react";
import { apiUrl } from "../config/api";
import type { ApiProject, ApiProjectSelection } from "@2bn/shared";
import { usePatchSelection, useSubmitProposal, useUnlockCategories } from "../api/hooks";
import { formatCurrency } from "../utils/format";
import SignatureCanvas from "react-signature-canvas";
import { Edit2, Lock, Unlock, Download, ChevronRight, X, PenTool } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

interface SelectionsSummaryPanelProps {
  projectId: string;
  selections: ApiProjectSelection[];
  project: ApiProject;
  isBuilder: boolean; // PM or Admin
  onSelectCategory: (categoryKey: string) => void;
  flatCategories?: string[];
}

export function SelectionsSummaryPanel({
  projectId,
  selections,
  project,
  isBuilder,
  onSelectCategory,
  flatCategories = [],
}: SelectionsSummaryPanelProps) {
  const patchSelection = usePatchSelection(projectId);
  const submitProposal = useSubmitProposal(projectId);
  const unlockCategories = useUnlockCategories(projectId);

  // States
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDiscountType, setEditDiscountType] = useState<"percent" | "flat">("percent");
  const [editDiscountVal, setEditDiscountVal] = useState<string>("0");
  
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureType, setSignatureType] = useState<"drawn" | "typed">("typed");
  const [typedName, setTypedName] = useState(project.clientName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signError, setSignError] = useState("");
  
  const [isLocksPanelOpen, setIsLocksPanelOpen] = useState(false);
  const [selectedUnlockedKeys, setSelectedUnlockedKeys] = useState<string[]>(project.unlockedCategoryKeys || []);

  const signatureRef = useRef<SignatureCanvas>(null);

  // Filter confirmed selections
  const confirmedSelections = useMemo(() => {
    return selections.filter((s) => s.state === "confirmed");
  }, [selections]);

  // Financial calculations
  const financials = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;

    confirmedSelections.forEach((s) => {
      const qty = s.quantity ?? 1;
      const price = s.priceUsed ?? 0;
      const itemCost = price * qty;
      subtotal += itemCost;

      let discount = 0;
      if (s.discountPercent && s.discountPercent > 0) {
        discount = itemCost * (s.discountPercent / 100);
      } else if (s.discountFlat && s.discountFlat > 0) {
        discount = s.discountFlat;
      }
      totalDiscount += discount;
    });

    const finalCost = Math.max(0, subtotal - totalDiscount);
    const budget = project.initialBudget || 0;
    const variance = finalCost - budget;

    return {
      subtotal,
      totalDiscount,
      finalCost,
      variance,
    };
  }, [confirmedSelections, project.initialBudget]);

  // Group selections by category
  const groupedSelections = useMemo(() => {
    const map: Record<string, ApiProjectSelection[]> = {};
    confirmedSelections.forEach((s) => {
      if (!map[s.categoryKey]) {
        map[s.categoryKey] = [];
      }
      map[s.categoryKey].push(s);
    });
    return map;
  }, [confirmedSelections]);

  // Handle discount edit trigger
  function handleStartEditDiscount(item: ApiProjectSelection) {
    setEditingItemId(item.id);
    if (item.discountPercent && item.discountPercent > 0) {
      setEditDiscountType("percent");
      setEditDiscountVal(item.discountPercent.toString());
    } else if (item.discountFlat && item.discountFlat > 0) {
      setEditDiscountType("flat");
      setEditDiscountVal(item.discountFlat.toString());
    } else {
      setEditDiscountType("percent");
      setEditDiscountVal("0");
    }
  }

  async function handleSaveDiscount(item: ApiProjectSelection) {
    const parsed = parseFloat(editDiscountVal) || 0;
    const updates: { discountPercent: number; discountFlat: number } = {
      discountPercent: 0,
      discountFlat: 0,
    };

    if (editDiscountType === "percent") {
      updates.discountPercent = Math.min(100, Math.max(0, parsed));
    } else {
      updates.discountFlat = Math.max(0, parsed);
    }

    try {
      await patchSelection.mutateAsync({
        id: item.id,
        categoryKey: item.categoryKey,
        state: "confirmed",
        ...updates,
      });
      setEditingItemId(null);
    } catch (err) {
      alert("Failed to save discount.");
    }
  }

  // Handle Locks submission
  async function handleSaveLocks() {
    try {
      await unlockCategories.mutateAsync(selectedUnlockedKeys);
      setIsLocksPanelOpen(false);
    } catch {
      alert("Failed to update category locks.");
    }
  }

  // Handle Proposal Submission
  async function handleSubmitSign() {
    setSignError("");
    setIsSubmitting(true);

    let signatureImageBase64: string | undefined;
    if (signatureType === "drawn") {
      if (signatureRef.current?.isEmpty()) {
        setSignError("Please draw your signature first.");
        setIsSubmitting(false);
        return;
      }
      signatureImageBase64 = signatureRef.current?.toDataURL("image/png");
    } else {
      if (!typedName.trim()) {
        setSignError("Please enter your name for the typed signature.");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await submitProposal.mutateAsync({
        signatureType,
        typedName: signatureType === "typed" ? typedName : undefined,
        signatureImageBase64,
      });
      setIsSignModalOpen(false);
    } catch (err: any) {
      setSignError(err.message || "Failed to submit proposal signature.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLockedForHomeowner = project.proposalSigned;

  return (
    <Card className="border border-border flex flex-col justify-between h-full bg-card shadow-lg rounded-2xl">
      <CardHeader className="p-5 pb-4 border-b border-border/80 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold font-serif flex items-center gap-2 text-foreground">
          <span>Selections Summary</span>
          {isLockedForHomeowner ? (
            <Badge variant="destructive" className="flex gap-1 items-center font-bold px-2 py-0.5 rounded text-[10px]">
              <Lock size={10} /> Locked
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex gap-1 items-center font-bold px-2 py-0.5 rounded text-[10px]">
              <Unlock size={10} /> Open
            </Badge>
          )}
        </CardTitle>
        
        {isBuilder && isLockedForHomeowner && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedUnlockedKeys(project.unlockedCategoryKeys || []);
              setIsLocksPanelOpen(!isLocksPanelOpen);
            }}
            className="h-8 gap-1 rounded-lg text-xs"
          >
            <Lock size={12} /> Override Locks
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-5 space-y-6 flex-1 flex flex-col justify-between">
        {/* Locks Setup Interface (Builder/PM Only) */}
        {isLocksPanelOpen && isBuilder && (
          <div className="p-4 bg-muted/65 border border-border rounded-xl space-y-3 animate-slideUp">
            <h4 className="text-xs font-bold text-foreground">Allow homeowner changes for specific categories:</h4>
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 border border-border/70 rounded-lg bg-card">
              {flatCategories.map((key) => {
                const label = key.split(" - ").slice(-1)[0];
                const isChecked = selectedUnlockedKeys.includes(key);
                return (
                  <label key={key} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5 hover:text-primary">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      className="rounded border-border accent-secondary h-3.5 w-3.5"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUnlockedKeys([...selectedUnlockedKeys, key]);
                        } else {
                          setSelectedUnlockedKeys(selectedUnlockedKeys.filter((k) => k !== key));
                        }
                      }}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="premium" className="flex-1" onClick={handleSaveLocks}>Save Override</Button>
              <Button size="sm" variant="outline" onClick={() => setIsLocksPanelOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Selections List */}
        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
          {confirmedSelections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No materials confirmed yet.
            </div>
          ) : (
            Object.entries(groupedSelections).map(([categoryKey, items]) => (
              <div key={categoryKey} className="pb-3 border-b border-dashed border-border/80 space-y-1.5">
                <div 
                  className="text-[10px] font-bold text-secondary uppercase tracking-widest flex justify-between items-center cursor-pointer hover:opacity-80"
                  onClick={() => onSelectCategory(categoryKey)}
                >
                  <span>{categoryKey.split(" - ").slice(-1)[0]}</span>
                  <ChevronRight size={12} />
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const qty = item.quantity ?? 1;
                    const itemSubtotal = (item.priceUsed ?? 0) * qty;
                    
                    let discountAmt = 0;
                    if (item.discountPercent && item.discountPercent > 0) {
                      discountAmt = itemSubtotal * (item.discountPercent / 100);
                    } else if (item.discountFlat && item.discountFlat > 0) {
                      discountAmt = item.discountFlat;
                    }
                    
                    const finalItemCost = Math.max(0, itemSubtotal - discountAmt);
                    const hasDiscount = discountAmt > 0;
                    const isUnlockedCategory = project.unlockedCategoryKeys?.includes(item.categoryKey);

                    return (
                      <div key={item.id} className="flex gap-3 items-center bg-muted/30 p-2.5 rounded-xl border border-border/40">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.product} className="w-10 h-10 object-cover rounded-lg border border-border/50 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-muted border border-border/50 rounded-lg flex items-center justify-center text-[8px] text-muted-foreground font-bold shrink-0">No Image</div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {item.manufacturer} {item.model}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Qty: {qty} · Level {item.level}
                          </div>

                          {/* Discount config */}
                          {editingItemId === item.id ? (
                            <div className="mt-2 p-2 bg-card border border-border rounded-lg space-y-2">
                              <div className="flex gap-2">
                                <select 
                                  value={editDiscountType} 
                                  onChange={(e) => setEditDiscountType(e.target.value as any)}
                                  className="text-[10px] p-1 border border-input rounded bg-card text-foreground"
                                >
                                  <option value="percent">% Discount</option>
                                  <option value="flat">$ Flat</option>
                                </select>
                                <Input
                                  type="number"
                                  value={editDiscountVal}
                                  onChange={(e) => setEditDiscountVal(e.target.value)}
                                  className="w-16 h-7 text-xs"
                                  min="0"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="premium" className="h-6 text-[10px]" onClick={() => handleSaveDiscount(item)}>Save</Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setEditingItemId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5">
                              {hasDiscount ? (
                                <>
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    {formatCurrency(itemSubtotal)}
                                  </span>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(finalItemCost)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-bold text-foreground">
                                  {formatCurrency(itemSubtotal)}
                                </span>
                              )}
                              
                              {isBuilder && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditDiscount(item)}
                                  className="text-secondary hover:text-secondary/80 cursor-pointer p-0.5 inline-flex"
                                  title="Add Discount"
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </div>
                          )}
                          
                          {isLockedForHomeowner && isUnlockedCategory && (
                            <div className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">
                              🔓 Override: Custom Changes Enabled
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pricing calculations details */}
        <div className="space-y-4 pt-4 border-t border-border/80">
          <div className="bg-muted/40 p-4 rounded-xl border border-border/60 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-semibold text-foreground">{formatCurrency(financials.subtotal)}</span>
            </div>
            {financials.totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Discounts applied:</span>
                <span className="font-bold">-{formatCurrency(financials.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-border/40 text-foreground">
              <span className="font-bold">Current Selections:</span>
              <span className="font-extrabold">{formatCurrency(financials.finalCost)}</span>
            </div>
            {project.proposalSigned && (
              <div className={`flex justify-between text-xs pt-1 border-t border-border/30 ${financials.variance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                <span>Budget Overage:</span>
                <span className="font-bold">
                  {financials.variance >= 0 ? "+" : ""}
                  {formatCurrency(financials.variance)}
                </span>
              </div>
            )}
          </div>

          {/* Sign proposal CTAs */}
          {isLockedForHomeowner ? (
            <div className="space-y-2">
              {project.proposalPdfUrl && (
                <a 
                  href={apiUrl(project.proposalPdfUrl)} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-full"
                >
                  <Button variant="outline" className="w-full gap-1.5 h-10">
                    <Download size={14} /> Download Signed PDF
                  </Button>
                </a>
              )}
              {!isBuilder && project.unlockedCategoryKeys && project.unlockedCategoryKeys.length > 0 && (
                <Button variant="premium" className="w-full h-10" onClick={() => setIsSignModalOpen(true)}>
                  Sign Updated Selections
                </Button>
              )}
            </div>
          ) : (
            confirmedSelections.length > 0 && (
              <Button variant="premium" className="w-full h-11" onClick={() => setIsSignModalOpen(true)}>
                <PenTool size={16} className="mr-2" /> Sign & Lock Selections
              </Button>
            )
          )}
        </div>
      </CardContent>

      {/* Signature Approval Modal popup */}
      {isSignModalOpen && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[110] p-4 animate-fadeIn" onClick={() => setIsSignModalOpen(false)}>
          <Card className="max-w-md w-full p-6 space-y-4 bg-card border-border shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsSignModalOpen(false)} 
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-bold font-serif text-foreground">Sign & Finalize Selections</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              By signing, you lock the current selections total of <strong className="text-foreground">{formatCurrency(financials.finalCost)}</strong>. The sheet will lock for further changes until approved or unlocked by your manager.
            </p>

            <div className="flex gap-4 border-b border-border pb-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-foreground">
                <input type="radio" name="sigType" checked={signatureType === "typed"} onChange={() => setSignatureType("typed")} className="accent-secondary" />
                Type Signature
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-foreground">
                <input type="radio" name="sigType" checked={signatureType === "drawn"} onChange={() => setSignatureType("drawn")} className="accent-secondary" />
                Draw Signature
              </label>
            </div>

            {signatureType === "typed" ? (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Type Full Name</label>
                <Input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
                <div className="p-6 border border-dashed border-border rounded-xl bg-muted/30 text-center">
                  <span className="font-serif italic text-2xl text-secondary">
                    {typedName || "Your Signature"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Draw Signature</label>
                <div className="border border-border rounded-xl overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={signatureRef}
                    canvasProps={{ className: "w-full h-32 bg-white" }}
                  />
                </div>
                <button 
                  type="button" 
                  className="text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer block ml-auto"
                  onClick={() => signatureRef.current?.clear()}
                >
                  Clear Pad
                </button>
              </div>
            )}

            {signError && (
              <div className="text-xs text-destructive font-semibold">
                ⚠️ {signError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button 
                variant="premium" 
                className="flex-1" 
                onClick={handleSubmitSign} 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Locking proposal..." : "Submit Signature"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsSignModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
