import { useState } from "react";
import type { LibraryItem } from "../types";
import { formatPriceRange } from "../utils/format";
import { LevelBadge } from "./LevelBadge";
import { ProductImage } from "./ProductImage";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Check, Info, Plus, Minus, Tag } from "lucide-react";

interface SelectionItemCardProps {
  item: LibraryItem;
  isSelected: boolean;
  /** Multi-select: how many of this item are selected (0 = not selected) */
  selectedQuantity: number;
  onSelect: () => void;
  onDeselect: () => void;
  onOpenDetail?: () => void;
  onQuantityChange?: (quantity: number) => void;
  /** Enable multi-select mode (quantity selector) */
  multiSelect?: boolean;
  /** Show compare checkbox */
  showCompare?: boolean;
  isComparing?: boolean;
  onToggleCompare?: () => void;
  /** Current selection price for showing delta */
  currentPrice?: number;
  /** Disable changes if selection sheet is locked */
  isLocked?: boolean;
}

export function SelectionItemCard({
  item,
  isSelected,
  selectedQuantity,
  onSelect,
  onDeselect,
  onOpenDetail,
  onQuantityChange,
  multiSelect = false,
  showCompare = false,
  isComparing = false,
  onToggleCompare,
  currentPrice,
  isLocked = false,
}: SelectionItemCardProps) {
  const [showSpecs, setShowSpecs] = useState(false);
  const priceDelta =
    currentPrice !== undefined ? item.priceMin - currentPrice : null;

  function handleCardClick() {
    if (onOpenDetail) {
      onOpenDetail();
    } else {
      if (isSelected && !multiSelect) {
        onDeselect();
      } else {
        onSelect();
      }
    }
  }

  function handleQuantityUp(e: React.MouseEvent) {
    e.stopPropagation();
    onQuantityChange?.((selectedQuantity || 0) + 1);
  }

  function handleQuantityDown(e: React.MouseEvent) {
    e.stopPropagation();
    const newQty = (selectedQuantity || 0) - 1;
    if (newQty <= 0) {
      onDeselect();
    } else {
      onQuantityChange?.(newQty);
    }
  }

  return (
    <Card
      className={`relative overflow-hidden group cursor-pointer border flex flex-col justify-between transition-all duration-300 h-full ${
        isSelected
          ? "border-secondary ring-1 ring-secondary/50 shadow-md bg-secondary/5"
          : "border-border hover:border-primary/30 hover:shadow-md"
      }`}
      onClick={handleCardClick}
    >
      {/* Selection corner tag */}
      {isSelected && (
        <div className="absolute top-0 right-0 z-10 bg-secondary text-secondary-foreground py-1 px-3 rounded-bl-xl flex items-center gap-1 shadow-sm animate-popIn">
          <Check size={12} className="stroke-[3]" />
          {multiSelect && selectedQuantity > 1 ? (
            <span className="text-[10px] font-bold">×{selectedQuantity}</span>
          ) : (
            <span className="text-[10px] font-bold">Selected</span>
          )}
        </div>
      )}

      {/* Main image container */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/20 border-b border-border/50">
        <ProductImage
          item={item}
          alt={item.product}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <span className="bg-white/95 text-primary text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5">
            <Info size={11} /> Quick Details
          </span>
        </div>

        {/* Compare Checkbox */}
        {showCompare && (
          <div
            className="absolute top-2.5 left-2.5 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm border border-border px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:bg-background shadow-sm">
              <input
                type="checkbox"
                checked={isComparing}
                onChange={onToggleCompare}
                className="accent-secondary h-3 w-3 rounded border-border"
              />
              <span>Compare</span>
            </label>
          </div>
        )}
      </div>

      {/* Card Body */}
      <CardContent className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Metadata Row */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <LevelBadge level={item.level} />
            {item.optional && (
              <Badge variant="outline" className="text-[10px] font-semibold border-border/80 text-muted-foreground uppercase">
                Optional
              </Badge>
            )}
            {(item as any).recommendationScore !== undefined && (item as any).recommendationScore > 0 && (
              <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border-transparent text-[10px] font-bold">
                ✨ Match
              </Badge>
            )}
          </div>

          {/* Title & Brand */}
          <div>
            <h4 className="font-serif text-sm font-bold text-foreground line-clamp-1">
              {item.manufacturer} {item.model}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-1">{item.product}</p>
          </div>

          {/* Tags */}
          {((item as any).tagSlugs || (item as any).tags || []).length > 0 && (
            <div className="flex gap-1 flex-wrap pt-0.5">
              {((item as any).tagSlugs || (item as any).tags || []).map((t: string) => (
                <span
                  key={t}
                  className="text-[9px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded flex items-center gap-0.5 border border-border/30 capitalize"
                >
                  <Tag size={8} /> {t}
                </span>
              ))}
            </div>
          )}

          {/* Technical Specs Summary */}
          {(item.finish || (item as any).size) && (
            <div className="text-[11px] space-y-0.5 text-muted-foreground pt-1 border-t border-border/40">
              {item.finish && (
                <div>
                  <span className="font-semibold text-foreground/75">Finish:</span> {item.finish}
                </div>
              )}
              {(item as any).size && (
                <div>
                  <span className="font-semibold text-foreground/75">Size:</span> {(item as any).size}
                </div>
              )}
            </div>
          )}

          {/* Price Range & Delta */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-foreground">
              {formatPriceRange(item.priceMin, item.priceMax)}
            </span>
            {priceDelta !== null && priceDelta !== 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  priceDelta > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {priceDelta >= 0 ? "+" : ""}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                }).format(priceDelta)}
              </span>
            )}
          </div>
        </div>

        {/* Action controls / bottom footer */}
        <div className="mt-4 pt-3 border-t border-border/50 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Specifications expandable */}
          {(item as any).specifications && (
            <div className="w-full">
              <button
                type="button"
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer w-full justify-between"
                onClick={() => setShowSpecs(!showSpecs)}
              >
                <span>Technical Specifications</span>
                <span>{showSpecs ? "▲" : "▼"}</span>
              </button>
              {showSpecs && (
                <div className="mt-1.5 p-2 bg-muted/50 rounded-lg text-[10px] text-muted-foreground border border-border/30 max-h-24 overflow-y-auto leading-relaxed">
                  {(item as any).specifications}
                </div>
              )}
            </div>
          )}

          {/* Quantity selector in multi-select mode */}
          {multiSelect && isSelected && !isLocked && (
            <div className="flex items-center justify-between bg-muted/60 px-2 py-1.5 rounded-lg border border-border/30">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Quantity:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-6 w-6 p-0 rounded bg-card border-border"
                  disabled={selectedQuantity <= 0}
                  onClick={handleQuantityDown}
                >
                  <Minus size={10} />
                </Button>
                <span className="text-xs font-bold text-foreground w-4 text-center">{selectedQuantity}</span>
                <Button
                  variant="outline"
                  className="h-6 w-6 p-0 rounded bg-card border-border"
                  onClick={handleQuantityUp}
                >
                  <Plus size={10} />
                </Button>
              </div>
            </div>
          )}

          {/* Selection state buttons */}
          <div className="w-full">
            {isLocked ? (
              <div className="text-xs text-muted-foreground py-2 text-center flex items-center justify-center gap-1 bg-muted/40 rounded-lg border border-border/20">
                🔒 Selections Locked
              </div>
            ) : isSelected ? (
              <Button
                variant="accent"
                className="w-full h-9 rounded-lg"
                onClick={onDeselect}
              >
                Selected
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full h-9 rounded-lg"
                onClick={onSelect}
              >
                Add Selection
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
