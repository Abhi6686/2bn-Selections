import type { LibraryItem, ProjectSelection } from "../types";
import { formatCurrency } from "../utils/format";
import { LevelBadge } from "./LevelBadge";
import { ProductImage } from "./ProductImage";

interface SelectionProductCardProps {
  selection: ProjectSelection;
  libraryItem?: LibraryItem;
  onChangeClick: () => void;
}

export function SelectionProductCard({
  selection,
  libraryItem,
  onChangeClick,
}: SelectionProductCardProps) {
  return (
    <article className="selection-product-card">
      <ProductImage
        item={libraryItem}
        imageUrl={selection.imageUrl}
        alt={`${selection.manufacturer} ${selection.model}`}
        className="selection-product-card-image"
      />
      <div className="selection-product-card-body">
        <p className="selection-category">{selection.category}</p>
        <h3>
          {selection.manufacturer} {selection.model}
        </h3>
        <p className="selection-description">{selection.product}</p>
        {selection.finish && <p className="selection-finish">{selection.finish}</p>}
        <div className="selection-product-card-footer">
          <strong className="selection-price">{formatCurrency(selection.priceUsed)}</strong>
          <LevelBadge level={selection.level} />
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={onChangeClick}>
          Change selection
        </button>
      </div>
    </article>
  );
}
