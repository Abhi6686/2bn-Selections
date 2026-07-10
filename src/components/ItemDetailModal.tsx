import { useState, useEffect } from "react";
import type { ApiLibraryItem, SelectionLevel } from "@2bn/shared";
import { useUpdateLibraryItem } from "../api/hooks";
import { LevelBadge } from "./LevelBadge";
import { ProductImage } from "./ProductImage";
import { X, Edit2, Check, ArrowLeft, Plus, Minus, Tag, ShoppingCart } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

interface ItemDetailModalProps {
  item: ApiLibraryItem;
  isSelected: boolean;
  selectedQuantity: number;
  onSelect: () => void;
  onDeselect: () => void;
  onQuantityChange?: (quantity: number) => void;
  multiSelect?: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isLocked?: boolean;
}

export function ItemDetailModal({
  item,
  isSelected,
  selectedQuantity,
  onSelect,
  onDeselect,
  onQuantityChange,
  multiSelect = false,
  onClose,
  isAdmin,
  isLocked = false,
}: ItemDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeImage, setActiveImage] = useState<string>("");
  const updateItemMutation = useUpdateLibraryItem();

  // Edit form state
  const [formData, setFormData] = useState({
    manufacturer: "",
    model: "",
    product: "",
    finish: "",
    size: "",
    priceMin: "",
    priceMax: "",
    level: "1" as SelectionLevel,
    imageUrl: "",
    dimensionsImageUrl: "",
    vendor: "",
    specifications: "",
    tags: "",
    active: true,
    custom: false,
    recommendationScore: "0",
    galleryImages: ["", "", "", "", ""] as string[],
  });

  // Set default active image and form data
  useEffect(() => {
    if (item) {
      setActiveImage(item.imageUrl || "");
      const gallery = Array.from({ length: 5 }, (_, i) => item.galleryImages?.[i] || "");
      setFormData({
        manufacturer: item.manufacturer || "",
        model: item.model || "",
        product: item.product || "",
        finish: item.finish || "",
        size: item.size || "",
        priceMin: item.priceMin?.toString() || "0",
        priceMax: item.priceMax?.toString() || "0",
        level: (item.level || "1") as SelectionLevel,
        imageUrl: item.imageUrl || "",
        dimensionsImageUrl: item.dimensionsImageUrl || "",
        vendor: item.vendor || "",
        specifications: item.specifications || "",
        tags: item.tags?.join(", ") || "",
        active: item.active !== false,
        custom: !!item.custom,
        recommendationScore: item.recommendationScore?.toString() || "0",
        galleryImages: gallery,
      });
      setIsEditing(false);
    }
  }, [item]);

  const handleImageClick = (url: string) => {
    setActiveImage(url);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceMinNum = parseFloat(formData.priceMin) || 0;
      const priceMaxNum = parseFloat(formData.priceMax) || priceMinNum;
      const recScoreNum = parseInt(formData.recommendationScore) || 0;

      const updatedTags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      await updateItemMutation.mutateAsync({
        id: item.id,
        body: {
          manufacturer: formData.manufacturer,
          model: formData.model,
          product: formData.product,
          finish: formData.finish || undefined,
          size: formData.size || undefined,
          priceMin: priceMinNum,
          priceMax: priceMaxNum,
          level: formData.level,
          imageUrl: formData.imageUrl.trim() || undefined,
          dimensionsImageUrl: formData.dimensionsImageUrl.trim() || undefined,
          vendor: formData.vendor || undefined,
          specifications: formData.specifications.trim() || undefined,
          tags: updatedTags,
          active: formData.active,
          custom: formData.custom,
          recommendationScore: recScoreNum || undefined,
          galleryImages: formData.galleryImages.map((u) => u.trim()).filter(Boolean),
        },
      });

      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update item details:", err);
      alert("Error saving item. Please try again.");
    }
  };

  const formattedPrice = () => {
    const min = item.priceMin || 0;
    const max = item.priceMax || 0;
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    if (min === max || !max) return formatter.format(min);
    return `${formatter.format(min)} – ${formatter.format(max)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn" onClick={onClose}>
      <Card
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border shadow-2xl rounded-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Controls */}
        <header className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur-sm z-10">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onClose}>
            <X size={16} />
            <span>Close Details</span>
          </Button>
          {isAdmin && (
            <Button
              variant={isEditing ? "outline" : "premium"}
              size="sm"
              className="gap-1.5"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <ArrowLeft size={14} />
                  Cancel Edit
                </>
              ) : (
                <>
                  <Edit2 size={14} />
                  Edit Specifications
                </>
              )}
            </Button>
          )}
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-8 flex-1">
          {isEditing ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <h3 className="text-xl font-bold font-serif text-foreground">Edit Library Item Specs</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="manufacturer" className="text-xs font-bold text-muted-foreground uppercase">Manufacturer *</label>
                  <Input
                    type="text"
                    id="manufacturer"
                    name="manufacturer"
                    required
                    value={formData.manufacturer}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="model" className="text-xs font-bold text-muted-foreground uppercase">Model *</label>
                  <Input
                    type="text"
                    id="model"
                    name="model"
                    required
                    value={formData.model}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="product" className="text-xs font-bold text-muted-foreground uppercase">Product Description *</label>
                  <Input
                    type="text"
                    id="product"
                    name="product"
                    required
                    value={formData.product}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="finish" className="text-xs font-bold text-muted-foreground uppercase">Finish</label>
                  <Input
                    type="text"
                    id="finish"
                    name="finish"
                    value={formData.finish}
                    onChange={handleInputChange}
                    placeholder="e.g. Brushed Nickel, Matte Black"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="size" className="text-xs font-bold text-muted-foreground uppercase">Size</label>
                  <Input
                    type="text"
                    id="size"
                    name="size"
                    value={formData.size}
                    onChange={handleInputChange}
                    placeholder="e.g. 8 in, 24 x 36"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="priceMin" className="text-xs font-bold text-muted-foreground uppercase">Min Price ($) *</label>
                  <Input
                    type="number"
                    id="priceMin"
                    name="priceMin"
                    required
                    min="0"
                    step="0.01"
                    value={formData.priceMin}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="priceMax" className="text-xs font-bold text-muted-foreground uppercase">Max Price ($)</label>
                  <Input
                    type="number"
                    id="priceMax"
                    name="priceMax"
                    min="0"
                    step="0.01"
                    value={formData.priceMax}
                    onChange={handleInputChange}
                    placeholder="Leave empty if same as Min"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="level" className="text-xs font-bold text-muted-foreground uppercase">Selection Level *</label>
                  <select
                    id="level"
                    name="level"
                    required
                    value={formData.level}
                    onChange={handleInputChange}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="1">Level 1 (Standard / Value)</option>
                    <option value="2">Level 2 (Mid-grade / Upgraded)</option>
                    <option value="3">Level 3 (Premium / Luxury)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="vendor" className="text-xs font-bold text-muted-foreground uppercase">Vendor</label>
                  <Input
                    type="text"
                    id="vendor"
                    name="vendor"
                    value={formData.vendor}
                    onChange={handleInputChange}
                    placeholder="e.g. Ferguson, Floor & Decor"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="imageUrl" className="text-xs font-bold text-muted-foreground uppercase">Product Image URL</label>
                  <Input
                    type="url"
                    id="imageUrl"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="dimensionsImageUrl" className="text-xs font-bold text-muted-foreground uppercase">Dimensions Diagram URL</label>
                  <Input
                    type="url"
                    id="dimensionsImageUrl"
                    name="dimensionsImageUrl"
                    value={formData.dimensionsImageUrl}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Additional Gallery Images</label>
                  {formData.galleryImages.map((url, idx) => (
                    <Input
                      key={idx}
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const next = [...formData.galleryImages];
                        next[idx] = e.target.value;
                        setFormData((prev) => ({ ...prev, galleryImages: next }));
                      }}
                      placeholder={`Gallery image ${idx + 1} URL (e.g. cabinet_interior.jpg)`}
                      className="mb-2"
                    />
                  ))}
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="tags" className="text-xs font-bold text-muted-foreground uppercase">Tags (comma-separated)</label>
                  <Input
                    type="text"
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="specifications" className="text-xs font-bold text-muted-foreground uppercase">Specifications</label>
                  <textarea
                    id="specifications"
                    name="specifications"
                    rows={4}
                    value={formData.specifications}
                    onChange={handleInputChange}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="premium">
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Left Column: Media Gallery */}
              <div className="space-y-4">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-muted/20 relative">
                  <ProductImage
                    imageUrl={activeImage || undefined}
                    alt={item.product}
                    className="w-full h-full object-cover"
                  />
                  {!item.active && (
                    <Badge variant="destructive" className="absolute top-3 left-3">
                      INACTIVE
                    </Badge>
                  )}
                </div>

                {/* Thumbnails Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {item.imageUrl && (
                    <button
                      type="button"
                      className={`aspect-square rounded-lg border overflow-hidden p-1 bg-card cursor-pointer transition-all duration-200 ${
                        activeImage === item.imageUrl ? "border-secondary scale-95" : "border-border/60 hover:border-border"
                      }`}
                      onClick={() => handleImageClick(item.imageUrl!)}
                    >
                      <img src={item.imageUrl} alt="Main" className="w-full h-full object-cover rounded-md" />
                    </button>
                  )}
                  {item.dimensionsImageUrl && (
                    <button
                      type="button"
                      className={`aspect-square rounded-lg border overflow-hidden p-1 bg-card cursor-pointer transition-all duration-200 ${
                        activeImage === item.dimensionsImageUrl ? "border-secondary scale-95" : "border-border/60 hover:border-border"
                      }`}
                      onClick={() => handleImageClick(item.dimensionsImageUrl!)}
                    >
                      <img src={item.dimensionsImageUrl} alt="Diagram" className="w-full h-full object-cover rounded-md" />
                    </button>
                  )}
                  {(item.galleryImages || []).filter(Boolean).map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`aspect-square rounded-lg border overflow-hidden p-1 bg-card cursor-pointer transition-all duration-200 ${
                        activeImage === url ? "border-secondary scale-95" : "border-border/60 hover:border-border"
                      }`}
                      onClick={() => handleImageClick(url)}
                    >
                      <img src={url} alt="Gallery" className="w-full h-full object-cover rounded-md" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Spec Sheet details */}
              <div className="space-y-6">
                <div>
                  <div className="flex gap-2 flex-wrap items-center mb-2">
                    <LevelBadge level={item.level} />
                    {item.custom && <Badge variant="secondary">Custom</Badge>}
                    {item.recommendationScore !== undefined && item.recommendationScore > 0 && (
                      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 border-transparent text-xs font-bold">
                        ✨ Match
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-3xl font-bold font-serif text-foreground">
                    {item.manufacturer} {item.model}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">{item.product}</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/65 border border-border/80">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Estimated Budget Range
                  </span>
                  <span className="text-2xl font-extrabold text-foreground">{formattedPrice()}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  {item.finish && (
                    <div className="p-3 bg-card border border-border rounded-xl">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Finish</span>
                      <span className="font-semibold text-foreground">{item.finish}</span>
                    </div>
                  )}
                  {item.size && (
                    <div className="p-3 bg-card border border-border rounded-xl">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Size / Dims</span>
                      <span className="font-semibold text-foreground">{item.size}</span>
                    </div>
                  )}
                  {item.vendor && (
                    <div className="p-3 bg-card border border-border rounded-xl">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Supplier</span>
                      <span className="font-semibold text-foreground">{item.vendor}</span>
                    </div>
                  )}
                </div>

                {item.specifications && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Specifications</h4>
                    <p className="text-xs text-foreground/80 leading-relaxed bg-muted/40 p-4 rounded-xl border border-border/40 whitespace-pre-line">
                      {item.specifications}
                    </p>
                  </div>
                )}

                {item.tags && item.tags.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Style Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-medium border-border text-muted-foreground capitalize">
                          <Tag size={10} className="mr-1" /> {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selection Action Controls */}
                <div className="pt-6 border-t border-border/60">
                  {isLocked ? (
                    <div className="p-3 bg-muted text-muted-foreground text-xs text-center rounded-xl border border-border/20">
                      🔒 This category is locked for selections changes.
                    </div>
                  ) : isSelected ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold">
                        <Check size={16} /> Selected and added to project sheet
                      </div>

                      {multiSelect && (
                        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-xl border border-border/30">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Quantity:</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="h-8 w-8 p-0 rounded-lg bg-card border-border"
                              disabled={selectedQuantity <= 1}
                              onClick={() => onQuantityChange?.(selectedQuantity - 1)}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="text-sm font-bold text-foreground w-6 text-center">{selectedQuantity}</span>
                            <Button
                              variant="outline"
                              className="h-8 w-8 p-0 rounded-lg bg-card border-border"
                              onClick={() => onQuantityChange?.(selectedQuantity + 1)}
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="destructive"
                        className="w-full h-11"
                        onClick={onDeselect}
                      >
                        Remove Selection
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full h-11 text-base font-bold shadow-md rounded-xl"
                      onClick={onSelect}
                    >
                      <ShoppingCart size={18} className="mr-2" /> Add to Project Selection
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
