import { useMemo } from "react";
import type { CategoryTreeNode } from "../utils/categoryTree";
import { findNodeByCategoryKey, getNodePath, getFirstSelectableLeaf } from "../utils/categoryTree";

interface CategoryBreadcrumbProps {
  tree: CategoryTreeNode[];
  categoryKey: string;
  onNavigate?: (categoryKey: string) => void;
}

/**
 * Clickable breadcrumb showing the current position in the category hierarchy.
 * Example: EXTERIOR SELECTIONS > Roofing > Roof shingle type
 */
export function CategoryBreadcrumb({
  tree,
  categoryKey,
  onNavigate,
}: CategoryBreadcrumbProps) {
  const pathNodes = useMemo(() => {
    const node = findNodeByCategoryKey(tree, categoryKey);
    if (!node) return [];
    return getNodePath(tree, node.id);
  }, [tree, categoryKey]);

  if (pathNodes.length === 0) return null;

  return (
    <nav className="category-breadcrumb" aria-label="Category breadcrumb">
      {pathNodes.map((node, index) => {
        const isLast = index === pathNodes.length - 1;

        return (
          <span key={`${node.id}-${index}`} className="category-breadcrumb-item">
            {index > 0 && (
              <span className="category-breadcrumb-separator" aria-hidden="true">
                ›
              </span>
            )}
            {isLast ? (
              <span className="category-breadcrumb-current" aria-current="page">
                {node.label}
              </span>
            ) : (
              <button
                type="button"
                className="category-breadcrumb-link"
                onClick={() => {
                  const leaf = getFirstSelectableLeaf(node);
                  if (leaf && onNavigate) {
                    onNavigate(leaf.categoryKey);
                  }
                }}
              >
                {node.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

