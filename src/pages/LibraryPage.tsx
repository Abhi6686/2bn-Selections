import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { LevelBadge } from "../components/LevelBadge";
import { ProductImage } from "../components/ProductImage";
import type { SelectionLevel } from "../types";
import { formatPriceRange } from "../utils/format";

export function LibraryPage() {
  const { state, categories, addLibraryItem, addCategory } = useApp();
  const [filterLevel, setFilterLevel] = useState<SelectionLevel | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [form, setForm] = useState({
    category: categories[0] ?? "",
    level: "1" as SelectionLevel,
    manufacturer: "",
    model: "",
    product: "",
    finish: "",
    priceMin: "",
    priceMax: "",
    imageUrl: "",
  });

  const filteredItems = useMemo(() => {
    return state.libraryItems.filter((item) => {
      if (filterLevel !== "all" && item.level !== filterLevel) return false;
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      return true;
    });
  }, [state.libraryItems, filterLevel, filterCategory]);

  function handleAddMaterial(event: React.FormEvent) {
    event.preventDefault();
    const priceMin = parseFloat(form.priceMin);
    const priceMax = parseFloat(form.priceMax || form.priceMin);
    if (!form.manufacturer || !form.model || Number.isNaN(priceMin)) return;

    addLibraryItem({
      category: form.category,
      level: form.level,
      manufacturer: form.manufacturer,
      model: form.model,
      product: form.product || form.model,
      finish: form.finish || "—",
      priceMin,
      priceMax,
      imageUrl: form.imageUrl.trim() || undefined,
    });
    setShowForm(false);
    setForm({
      category: form.category,
      level: form.level,
      manufacturer: "",
      model: "",
      product: "",
      finish: "",
      priceMin: "",
      priceMax: "",
      imageUrl: "",
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Material Library</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Appliances — Levels 1–3. Add custom materials to any category.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add material"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label>Level</label>
          <select
            value={filterLevel}
            onChange={(event) => setFilterLevel(event.target.value as SelectionLevel | "all")}
          >
            <option value="all">All levels</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label>Category</label>
          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 200 }}>
          <label>New category name</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="e.g. Outdoor Kitchen"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                addCategory(newCategoryName);
                setNewCategoryName("");
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleAddMaterial} style={{ marginBottom: "1.5rem" }}>
          <h3>Add custom material</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="field">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Level</label>
              <select
                value={form.level}
                onChange={(event) =>
                  setForm({ ...form, level: event.target.value as SelectionLevel })
                }
              >
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3</option>
              </select>
            </div>
            <div className="field">
              <label>Manufacturer</label>
              <input
                required
                value={form.manufacturer}
                onChange={(event) => setForm({ ...form, manufacturer: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Model #</label>
              <input
                required
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Product description</label>
              <input
                value={form.product}
                onChange={(event) => setForm({ ...form, product: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Finish</label>
              <input
                value={form.finish}
                onChange={(event) => setForm({ ...form, finish: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Price min ($)</label>
              <input
                required
                type="number"
                step="0.01"
                value={form.priceMin}
                onChange={(event) => setForm({ ...form, priceMin: event.target.value })}
              />
            </div>
            <div className="field">
              <label>Price max ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.priceMax}
                onChange={(event) => setForm({ ...form, priceMax: event.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Image URL (optional)</label>
              <input
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                placeholder="/images/... or https://..."
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Save to library
          </button>
        </form>
      )}

      <p style={{ marginBottom: "1rem", color: "var(--text-muted)" }}>
        {filteredItems.length} items
      </p>

      <div className="card-grid">
        {filteredItems.map((item) => (
          <article key={item.id} className="card library-product-card">
            <ProductImage item={item} alt={item.product} />
            <div className="library-product-card-body">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <LevelBadge level={item.level} />
                {item.custom && (
                  <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 700 }}>
                    Custom
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 0.25rem" }}>
                {item.category}
              </p>
              <h3 style={{ fontSize: "1.1rem" }}>
                {item.manufacturer} {item.model}
              </h3>
              <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>{item.product}</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{item.finish}</p>
              <p style={{ fontWeight: 700, marginTop: "0.75rem" }}>
                {formatPriceRange(item.priceMin, item.priceMax)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
