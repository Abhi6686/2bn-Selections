/**
 * Category tree utilities for the 2BN Selections system.
 *
 * Transforms the flat masterCategories JSON into a navigable tree structure
 * used by the sidebar tree, breadcrumbs, and progress tracking.
 *
 * Hierarchy: Section → Group → Subgroup → Item (leaf slot)
 * Example:   EXTERIOR SELECTIONS → Roofing → (no subgroup) → Roof shingle type
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CategoryItem {
  name: string;
  index: number;
}

export interface CategorySubgroup {
  name: string;
  slug: string;
  categoryKey: string;
  parentGroup: string;
  items: string[];
}

export interface CategoryGroup {
  name: string;
  slug: string;
  categoryKey: string;
  parentGroup: string | null;
  items: string[];
  subgroups: CategorySubgroup[];
}

export interface CategorySection {
  order: number;
  name: string;
  slug: string;
  groups: CategoryGroup[];
}

export interface CategoryTreeNode {
  /** Unique identifier for tree operations */
  id: string;
  /** Display label */
  label: string;
  /** Slug for URL-friendly paths */
  slug: string;
  /** Category key used for matching library items / selections */
  categoryKey: string;
  /** Depth in the tree (0 = section, 1 = group, 2 = subgroup, 3 = item slot) */
  depth: number;
  /** The leaf-level slot names (only populated on groups/subgroups that have items) */
  itemSlots: string[];
  /** Child nodes */
  children: CategoryTreeNode[];
  /** Reference to parent node id */
  parentId: string | null;
  /** Icon hint for UI (emoji or icon name) */
  icon: string;
}

export interface CategoryPath {
  sectionSlug: string;
  sectionName: string;
  groupSlug?: string;
  groupName?: string;
  subgroupSlug?: string;
  subgroupName?: string;
  itemName?: string;
}

export interface CompletionStats {
  total: number;
  completed: number;
  skipped: number;
  percentage: number;
}

// ─── Section Icons ──────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, string> = {
  "exterior-selections": "🏠",
  "interior-finishes": "🎨",
  "kitchen-selections": "🍳",
  "bathroom-selections": "🛁",
  "electrical-and-technology": "⚡",
  "hvac-and-comfort": "🌡️",
  "fireplace-selections": "🔥",
  "storage-and-organization": "📦",
  "laundry-room": "👕",
  "specialty-items": "✨",
  "final-detail-items": "🔩",
  "project-wide-details": "📋",
  "information-needed-for-ordering": "📝",
};

// ─── Tree Builder ───────────────────────────────────────────────────────────

/**
 * Builds a navigable tree from the masterCategories sections array.
 * Each node has a unique `id` for tree operations and `categoryKey` for
 * matching against library items and project selections.
 */
export function buildCategoryTree(sections: CategorySection[]): CategoryTreeNode[] {
  return sections.map((section) => {
    const sectionId = `section-${section.slug}`;
    const sectionNode: CategoryTreeNode = {
      id: sectionId,
      label: section.name,
      slug: section.slug,
      categoryKey: "",
      depth: 0,
      itemSlots: [],
      children: [],
      parentId: null,
      icon: SECTION_ICONS[section.slug] ?? "📁",
    };

    sectionNode.children = (section.groups ?? []).map((group) => {
      const groupId = `${sectionId}--${group.slug}`;
      const groupNode: CategoryTreeNode = {
        id: groupId,
        label: group.name,
        slug: group.slug,
        categoryKey: group.categoryKey,
        depth: 1,
        itemSlots: group.items ?? [],
        children: [],
        parentId: sectionId,
        icon: "",
      };

      // Add subgroups as children
      if (group.subgroups && group.subgroups.length > 0) {
        groupNode.children = group.subgroups.map((sub) => {
          const subId = `${groupId}--${sub.slug}`;
          const subNode: CategoryTreeNode = {
            id: subId,
            label: sub.name,
            slug: sub.slug,
            categoryKey: sub.categoryKey,
            depth: 2,
            itemSlots: sub.items ?? [],
            children: [],
            parentId: groupId,
            icon: "",
          };

          if (sub.items && sub.items.length > 0) {
            subNode.children = sub.items.map((item) => {
              const itemSlug = item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
              const itemId = `${subId}--${itemSlug}`;
              return {
                id: itemId,
                label: item,
                slug: itemSlug,
                categoryKey: `${sub.categoryKey} - ${item}`,
                depth: 3,
                itemSlots: [],
                children: [],
                parentId: subId,
                icon: "",
              };
            });
          }

          return subNode;
        });
      } else {
        // No subgroups, add items directly under group children
        if (group.items && group.items.length > 0) {
          groupNode.children = group.items.map((item) => {
            const itemSlug = item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            const itemId = `${groupId}--${itemSlug}`;
            return {
              id: itemId,
              label: item,
              slug: itemSlug,
              categoryKey: `${group.categoryKey} - ${item}`,
              depth: 2,
              itemSlots: [],
              children: [],
              parentId: groupId,
              icon: "",
            };
          });
        }
      }

      return groupNode;
    });

    return sectionNode;
  });
}

// ─── Flat Node List ─────────────────────────────────────────────────────────

/**
 * Flattens the tree into an ordered list of all nodes for iteration.
 */
export function flattenTree(tree: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];

  function walk(nodes: CategoryTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return result;
}

/**
 * Returns only the "selectable" leaf nodes — groups/subgroups that have
 * a `categoryKey` and actual item slots or library items can be assigned to.
 */
export function getSelectableNodes(tree: CategoryTreeNode[]): CategoryTreeNode[] {
  return flattenTree(tree).filter(
    (node) => node.categoryKey && node.children.length === 0,
  );
}

// ─── Path / Breadcrumb ──────────────────────────────────────────────────────

/**
 * Finds a node by its `id` and returns the full path from root to that node.
 */
export function getNodePath(
  tree: CategoryTreeNode[],
  nodeId: string,
): CategoryTreeNode[] {
  const path: CategoryTreeNode[] = [];

  function search(nodes: CategoryTreeNode[]): boolean {
    for (const node of nodes) {
      path.push(node);
      if (node.id === nodeId) return true;
      if (node.children.length > 0 && search(node.children)) return true;
      path.pop();
    }
    return false;
  }

  search(tree);
  return path;
}

/**
 * Finds a node by its `categoryKey`.
 */
export function findNodeByCategoryKey(
  tree: CategoryTreeNode[],
  categoryKey: string,
): CategoryTreeNode | null {
  for (const node of flattenTree(tree)) {
    if (node.categoryKey === categoryKey) return node;
  }
  return null;
}

/**
 * Finds a node by its `id`.
 */
export function findNodeById(
  tree: CategoryTreeNode[],
  nodeId: string,
): CategoryTreeNode | null {
  for (const node of flattenTree(tree)) {
    if (node.id === nodeId) return node;
  }
  return null;
}

/**
 * Returns breadcrumb labels for a given categoryKey.
 * Example: ["EXTERIOR SELECTIONS", "Roofing"] for "Exterior - Roofing"
 */
export function getBreadcrumbLabels(
  tree: CategoryTreeNode[],
  categoryKey: string,
): string[] {
  const node = findNodeByCategoryKey(tree, categoryKey);
  if (!node) return [categoryKey];

  const path = getNodePath(tree, node.id);
  return path.map((n) => n.label);
}

// ─── Completion Tracking ────────────────────────────────────────────────────

/**
 * Calculates completion stats for a subtree.
 * `completedCategoryKeys` is a Set of categoryKeys that have at least one selection.
 * `skippedCategoryKeys` is a Set of categoryKeys explicitly skipped.
 */
export function getCompletionStats(
  nodes: CategoryTreeNode[],
  completedCategoryKeys: Set<string>,
  skippedCategoryKeys: Set<string> = new Set(),
): CompletionStats {
  const selectable = getSelectableNodes(nodes);
  const total = selectable.length;
  const completed = selectable.filter((n) => completedCategoryKeys.has(n.categoryKey)).length;
  const skipped = selectable.filter((n) => skippedCategoryKeys.has(n.categoryKey)).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, skipped, percentage };
}

/**
 * Returns completion stats for a single section.
 */
export function getSectionCompletionStats(
  section: CategoryTreeNode,
  completedCategoryKeys: Set<string>,
  skippedCategoryKeys: Set<string> = new Set(),
): CompletionStats {
  return getCompletionStats([section], completedCategoryKeys, skippedCategoryKeys);
}

// ─── Wizard Step Helpers ────────────────────────────────────────────────────

/**
 * Returns an ordered list of wizard steps derived from the category tree.
 * Each step corresponds to a selectable group/subgroup with a `categoryKey`.
 */
export function getWizardStepsFromTree(tree: CategoryTreeNode[]): CategoryTreeNode[] {
  return getSelectableNodes(tree);
}

/**
 * Given the current step index in the wizard, returns the previous and next
 * selectable nodes for navigation.
 */
export function getAdjacentSteps(
  tree: CategoryTreeNode[],
  currentCategoryKey: string,
): { prev: CategoryTreeNode | null; next: CategoryTreeNode | null; currentIndex: number; total: number } {
  const steps = getWizardStepsFromTree(tree);
  const currentIndex = steps.findIndex((s) => s.categoryKey === currentCategoryKey);

  return {
    prev: currentIndex > 0 ? steps[currentIndex - 1] : null,
    next: currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null,
    currentIndex,
    total: steps.length,
  };
}

/**
 * Finds the first selectable leaf node under a given category node.
 */
export function getFirstSelectableLeaf(node: CategoryTreeNode): CategoryTreeNode | null {
  if (node.children.length === 0) {
    return node.categoryKey ? node : null;
  }
  for (const child of node.children) {
    const leaf = getFirstSelectableLeaf(child);
    if (leaf) return leaf;
  }
  return null;
}
