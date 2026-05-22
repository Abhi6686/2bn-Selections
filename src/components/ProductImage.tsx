import { getLibraryItemImage } from "../store/library";
import type { LibraryItem } from "../types";

interface ProductImageProps {
  item?: LibraryItem | null;
  imageUrl?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ item, imageUrl, alt, className = "" }: ProductImageProps) {
  const source = imageUrl ?? getLibraryItemImage(item ?? undefined);

  if (!source) {
    return (
      <div className={`product-image product-image--placeholder ${className}`}>
        <span>No image</span>
      </div>
    );
  }

  return (
    <div className={`product-image ${className}`}>
      <img src={source} alt={alt} loading="lazy" />
    </div>
  );
}
