import { useMemo, useState } from "react";
import { findItemsForCategoryAllLevels, levelLabels } from "../store/library";
import type { LibraryItem, ProjectSelection, SelectionLevel } from "../types";
import { formatCurrency, formatPriceRange } from "../utils/format";
import { LevelBadge } from "./LevelBadge";
import { ProductImage } from "./ProductImage";

interface ChangeSelectionModalProps {
  selection: ProjectSelection;
  libraryItems: LibraryItem[];
  onClose: () => void;
  onConfirm: (item: LibraryItem, priceUsed: number) => void;
}

export function ChangeSelectionModal({
  selection,
  libraryItems,
  onClose,
  onConfirm,
}: ChangeSelectionModalProps) {
  const [activeLevel, setActiveLevel] = useState<SelectionLevel | "all">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [priceUsed, setPriceUsed] = useState(String(selection.priceUsed));

  const options = useMemo(
    () => findItemsForCategoryAllLevels(libraryItems, selection.category),
    [libraryItems, selection.category],
  );

  const filteredOptions = useMemo(() => {
    if (activeLevel === "all") return options;
    return options.filter((item) => item.level === activeLevel);
  }, [options, activeLevel]);

  const selectedItem = options.find((item) => item.id === selectedItemId);
  const parsedPrice = parseFloat(priceUsed) || 0;
  const priceDelta = parsedPrice - selection.priceUsed;

  function handleConfirm() {
    if (!selectedItem) return;
    onConfirm(selectedItem, parsedPrice || selectedItem.priceMin);
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="modal-eyebrow">Change selection</p>
            <h2>{selection.category}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="modal-current">
          <ProductImage
            imageUrl={selection.imageUrl}
            item={libraryItems.find((item) => item.id === selection.libraryItemId)}
            alt={selection.product}
            className="modal-current-image"
          />
          <div>
            <p className="modal-current-label">Current</p>
            <h3>
              {selection.manufacturer} {selection.model}
            </h3>
            <p>{selection.product}</p>
            <div className="modal-current-meta">
              <LevelBadge level={selection.level} />
              <strong>{formatCurrency(selection.priceUsed)}</strong>
            </div>
          </div>
        </section>

        <div className="level-filter">
          <span className="level-filter-label">Compare across levels:</span>
          <button
            type="button"
            className={`level-filter-btn${activeLevel === "all" ? " active" : ""}`}
            onClick={() => setActiveLevel("all")}
          >
            All levels
          </button>
          {(["1", "2", "3"] as SelectionLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={`level-filter-btn${activeLevel === level ? " active" : ""}`}
              onClick={() => setActiveLevel(level)}
            >
              {levelLabels[level]}
            </button>
          ))}
        </div>

        <div className="modal-options">
          {filteredOptions.length === 0 ? (
            <p className="empty-options">No options in this category for the selected level.</p>
          ) : (
            filteredOptions.map((item) => {
              const isSelected = selectedItemId === item.id;
              const isCurrent = selection.libraryItemId === item.id;
              const delta = item.priceMin - selection.priceUsed;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`option-card${isSelected ? " selected" : ""}${isCurrent ? " current" : ""}`}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setPriceUsed(String(item.priceMin));
                  }}
                >
                  <ProductImage item={item} alt={item.product} className="option-card-image" />
                  <div className="option-card-body">
                    <div className="option-card-top">
                      <LevelBadge level={item.level} />
                      {isCurrent && <span className="current-tag">Current</span>}
                      {item.optional && <span className="optional-tag">Optional</span>}
                    </div>
                    <h4>
                      {item.manufacturer} {item.model}
                    </h4>
                    <p>{item.product}</p>
                    <p className="option-finish">{item.finish}</p>
                    <div className="option-card-footer">
                      <strong>{formatPriceRange(item.priceMin, item.priceMax)}</strong>
                      {!isCurrent && (
                        <span className={`option-delta${delta > 0 ? " up" : delta < 0 ? " down" : ""}`}>
                          {delta >= 0 ? "+" : ""}
                          {formatCurrency(delta)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <footer className="modal-footer">
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Price to use ($)</label>
            <input
              type="number"
              step="0.01"
              value={priceUsed}
              onChange={(event) => setPriceUsed(event.target.value)}
            />
          </div>
          <div className="modal-footer-summary">
            {selectedItem && (
              <p className={`price-delta${priceDelta > 0 ? " up" : priceDelta < 0 ? " down" : ""}`}>
                Budget impact: {priceDelta >= 0 ? "+" : ""}
                {formatCurrency(priceDelta)}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedItem}
              onClick={handleConfirm}
            >
              Apply selection
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
