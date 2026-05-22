import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LevelBadge } from "../components/LevelBadge";
import { ProductImage } from "../components/ProductImage";
import { useApp } from "../context/AppContext";
import {
  findItemsForCategoryAllLevels,
  levelLabels,
} from "../store/library";
import type { LibraryItem, ProjectSelection, SelectionLevel } from "../types";
import { formatCurrency, formatPriceRange } from "../utils/format";

const WIZARD_CATEGORIES = [
  "Kitchen - Refrigeration",
  "Kitchen - Cooking",
  "Kitchen - Ventilation",
  "Kitchen - Microwave",
  "Kitchen - Dishwasher",
  "Laundry",
  "Plumbing - Kitchen Faucet",
  "Plumbing - Bathroom Faucet",
  "Plumbing - Shower / Tub",
  "Plumbing - Toilet",
];

export function NewProjectPage() {
  const navigate = useNavigate();
  const { state, categories, createProject } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [levelFilter, setLevelFilter] = useState<SelectionLevel | "all">("all");
  const [selections, setSelections] = useState<Record<string, ProjectSelection>>({});

  const wizardCategories = useMemo(() => {
    const merged = [...new Set([...WIZARD_CATEGORIES, ...categories])];
    return merged.filter((category) =>
      findItemsForCategoryAllLevels(state.libraryItems, category).length > 0,
    );
  }, [categories, state.libraryItems]);

  const selectionStepIndex = step - 1;
  const currentCategory = step > 0 ? wizardCategories[selectionStepIndex] ?? null : null;

  const categoryItems = useMemo(() => {
    if (!currentCategory) return [];
    const items = findItemsForCategoryAllLevels(state.libraryItems, currentCategory);
    if (levelFilter === "all") return items;
    return items.filter((item) => item.level === levelFilter);
  }, [currentCategory, state.libraryItems, levelFilter]);

  const itemsByLevel = useMemo(() => {
    const grouped: Record<SelectionLevel, LibraryItem[]> = { "1": [], "2": [], "3": [] };
    for (const item of categoryItems) {
      grouped[item.level].push(item);
    }
    return grouped;
  }, [categoryItems]);

  const runningTotal = useMemo(
    () => Object.values(selections).reduce((sum, selection) => sum + selection.priceUsed, 0),
    [selections],
  );

  const progressPercent =
    step === 0 ? 0 : Math.round((selectionStepIndex / wizardCategories.length) * 100);

  function selectItem(item: LibraryItem, priceUsed: number) {
    if (!currentCategory) return;
    setSelections((previous) => ({
      ...previous,
      [currentCategory]: {
        category: currentCategory,
        libraryItemId: item.id,
        manufacturer: item.manufacturer,
        model: item.model,
        product: item.product,
        priceUsed,
        level: item.level,
        imageUrl: item.imageUrl,
        finish: item.finish,
      },
    }));
  }

  function handleNext() {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (selectionStepIndex < wizardCategories.length - 1) {
      setStep(step + 1);
      setLevelFilter("all");
      return;
    }
    const project = createProject({
      name: name || "Untitled Project",
      clientName,
      address,
      selections: Object.values(selections),
    });
    navigate(`/projects/${project.id}`);
  }

  const canProceed =
    step === 0
      ? name.trim().length > 0
      : currentCategory
        ? Boolean(selections[currentCategory])
        : true;

  if (step === 0) {
    return (
      <div className="new-project-page">
        <header className="new-project-header">
          <p className="page-eyebrow">New project</p>
          <h1>Project details</h1>
          <p className="page-lead">
            Enter client information, then choose appliances from Level 1, 2, and 3 for each
            category.
          </p>
        </header>

        <div className="project-setup-card">
          <div className="project-setup-grid">
            <div className="field">
              <label>Project name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. AMC Residence"
                required
              />
            </div>
            <div className="field">
              <label>Client</label>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client or homeowner name"
              />
            </div>
            <div className="field project-setup-full">
              <label>Address</label>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Project site address"
              />
            </div>
          </div>

          <div className="project-setup-note">
            <strong>All levels included.</strong> Each category shows Value (L1), Mid (L2), and
            Premium (L3) options — pick the right appliance per room, not a single budget tier.
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!canProceed}
            onClick={handleNext}
          >
            Continue to appliance selections →
          </button>
        </div>
      </div>
    );
  }

  const currentSelection = currentCategory ? selections[currentCategory] : undefined;

  return (
    <div className="new-project-page">
      <header className="new-project-header">
        <p className="page-eyebrow">
          Step {selectionStepIndex + 1} of {wizardCategories.length}
        </p>
        <h1>{currentCategory}</h1>
        <p className="page-lead">
          {name} · Running total <strong>{formatCurrency(runningTotal)}</strong>
        </p>
        <div className="wizard-progress">
          <div className="wizard-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <div className="wizard-steps">
        {wizardCategories.map((category, index) => (
          <span
            key={category}
            className={`wizard-step${index < selectionStepIndex ? " done" : ""}${index === selectionStepIndex ? " current" : ""}${selections[category] ? " has-selection" : ""}`}
          >
            {index + 1}. {category.split(" - ").pop()}
          </span>
        ))}
      </div>

      <div className="level-filter">
        <span className="level-filter-label">Show:</span>
        <button
          type="button"
          className={`level-filter-btn${levelFilter === "all" ? " active" : ""}`}
          onClick={() => setLevelFilter("all")}
        >
          All levels
        </button>
        {(["1", "2", "3"] as SelectionLevel[]).map((level) => (
          <button
            key={level}
            type="button"
            className={`level-filter-btn${levelFilter === level ? " active" : ""}`}
            onClick={() => setLevelFilter(level)}
          >
            {levelLabels[level]}
          </button>
        ))}
      </div>

      {categoryItems.length === 0 ? (
        <div className="alert">
          No items for this category{levelFilter !== "all" ? ` at ${levelLabels[levelFilter]}` : ""}.
          Try another filter or add materials in the Library.
        </div>
      ) : levelFilter === "all" ? (
        <div className="wizard-level-sections">
          {(["1", "2", "3"] as SelectionLevel[]).map((level) => {
            const levelItems = itemsByLevel[level];
            if (levelItems.length === 0) return null;

            return (
              <section key={level} className="wizard-level-section">
                <div className="wizard-level-section-header">
                  <LevelBadge level={level} />
                  <span>{levelLabels[level]}</span>
                </div>
                <div className="wizard-options-grid">
                  {levelItems.map((item) => (
                    <SelectionPickCard
                      key={item.id}
                      item={item}
                      isSelected={currentSelection?.libraryItemId === item.id}
                      onSelect={() => selectItem(item, item.priceMin)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="wizard-options-grid">
          {categoryItems.map((item) => (
            <SelectionPickCard
              key={item.id}
              item={item}
              isSelected={currentSelection?.libraryItemId === item.id}
              onSelect={() => selectItem(item, item.priceMin)}
            />
          ))}
        </div>
      )}

      <footer className="wizard-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (step === 1) {
              setStep(0);
            } else {
              setStep(step - 1);
              setLevelFilter("all");
            }
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canProceed}
          onClick={handleNext}
        >
          {selectionStepIndex >= wizardCategories.length - 1
            ? "Create project & set initial budget"
            : "Next category →"}
        </button>
      </footer>
    </div>
  );
}

function SelectionPickCard({
  item,
  isSelected,
  onSelect,
}: {
  item: LibraryItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`selection-pick-card${isSelected ? " selected" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect();
      }}
      role="button"
      tabIndex={0}
    >
      <ProductImage item={item} alt={item.product} className="selection-pick-card-image" />
      <div className="selection-pick-card-body">
        <div className="selection-pick-card-top">
          <LevelBadge level={item.level} />
          {item.optional && <span className="optional-tag">Optional</span>}
        </div>
        <h3>
          {item.manufacturer} {item.model}
        </h3>
        <p>{item.product}</p>
        <p className="selection-pick-price">{formatPriceRange(item.priceMin, item.priceMax)}</p>
      </div>
    </div>
  );
}
