import { useCallback, useMemo, useState, useEffect } from "react";
import type { CategoryTreeNode } from "../utils/categoryTree";
import {
  getCompletionStats,
  getSectionCompletionStats,
  getSelectableNodes,
} from "../utils/categoryTree";
import { Search } from "lucide-react";
import type { ApiProjectSelection } from "@2bn/shared";

interface CategorySidebarTreeProps {
  tree: CategoryTreeNode[];
  activeCategoryKey: string | null;
  completedCategoryKeys: Set<string>;
  skippedCategoryKeys?: Set<string>;
  onSelectCategory: (categoryKey: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  selections?: ApiProjectSelection[];
  proposalSigned?: boolean;
  unlockedCategoryKeys?: string[];
}

function filterCategoryTree(nodes: CategoryTreeNode[], query: string): CategoryTreeNode[] {
  if (!query) return nodes;
  const lowerQuery = query.toLowerCase();

  return nodes
    .map((node) => {
      const isMatch =
        node.label.toLowerCase().includes(lowerQuery) ||
        (node.categoryKey && node.categoryKey.toLowerCase().includes(lowerQuery));

      const filteredChildren = filterCategoryTree(node.children || [], query);

      if (isMatch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    })
    .filter((n): n is CategoryTreeNode => n !== null);
}

export function CategorySidebarTree({
  tree,
  activeCategoryKey,
  completedCategoryKeys,
  skippedCategoryKeys = new Set(),
  onSelectCategory,
  collapsed = false,
  onToggleCollapse,
  selections = [],
  proposalSigned = false,
  unlockedCategoryKeys = [],
}: CategorySidebarTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeCategoryKey) {
      for (const section of tree) {
        const selectable = getSelectableNodes([section]);
        if (selectable.some((n: CategoryTreeNode) => n.categoryKey === activeCategoryKey)) {
          initial.add(section.id);
        }
      }
    }
    if (initial.size === 0 && tree.length > 0) {
      initial.add(tree[0].id);
    }
    return initial;
  });

  const overallStats = useMemo(
    () => getCompletionStats(tree, completedCategoryKeys, skippedCategoryKeys),
    [tree, completedCategoryKeys, skippedCategoryKeys],
  );

  const filteredTree = useMemo(() => {
    return filterCategoryTree(tree, searchQuery);
  }, [tree, searchQuery]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const selectionsCountMap = useMemo(() => {
    const map = new Map<string, number>();
    selections.forEach((s) => {
      if (s.state === "confirmed") {
        map.set(s.categoryKey, (map.get(s.categoryKey) || 0) + (s.quantity ?? 1));
      }
    });
    return map;
  }, [selections]);

  if (collapsed) {
    return (
      <div className="category-sidebar category-sidebar--collapsed">
        <button
          type="button"
          className="category-sidebar-toggle"
          onClick={onToggleCollapse}
          title="Expand category tree"
          aria-label="Expand category navigation"
        >
          ☰
        </button>
        <div className="category-sidebar-collapsed-progress">
          <span className="category-sidebar-collapsed-percent">
            {overallStats.percentage}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <aside className="category-sidebar" role="navigation" aria-label="Category navigation">
      {/* Header */}
      <div className="category-sidebar-header">
        <div className="category-sidebar-title">
          <h3>Selection Categories</h3>
          {onToggleCollapse && (
            <button
              type="button"
              className="category-sidebar-toggle"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse category navigation"
            >
              ✕
            </button>
          )}
        </div>
        <div className="category-sidebar-progress">
          <div className="category-sidebar-progress-bar">
            <div
              className="category-sidebar-progress-fill"
              style={{ width: `${overallStats.percentage}%` }}
            />
          </div>
          <span className="category-sidebar-progress-text">
            {overallStats.completed} of {overallStats.total} complete ({overallStats.percentage}%)
          </span>
        </div>
      </div>

      {/* Search Box */}
      <div className="category-search-container">
        <div className="category-search-wrapper">
          <Search size={14} className="category-search-icon" />
          <input
            type="text"
            className="category-search-input"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tree */}
      <div className="category-sidebar-tree">
        {filteredTree.length === 0 ? (
          <div style={{ padding: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
            No matching categories
          </div>
        ) : (
          filteredTree.map((section) => (
            <SectionNode
              key={section.id}
              section={section}
              isExpanded={searchQuery ? true : expandedSections.has(section.id)}
              activeCategoryKey={activeCategoryKey}
              completedCategoryKeys={completedCategoryKeys}
              skippedCategoryKeys={skippedCategoryKeys}
              onToggle={() => toggleSection(section.id)}
              onSelectCategory={onSelectCategory}
              selectionsCountMap={selectionsCountMap}
              proposalSigned={proposalSigned}
              unlockedCategoryKeys={unlockedCategoryKeys}
            />
          ))
        )}
      </div>
    </aside>
  );
}

// ─── Section Node ───────────────────────────────────────────────────────────

function SectionNode({
  section,
  isExpanded,
  activeCategoryKey,
  completedCategoryKeys,
  skippedCategoryKeys,
  onToggle,
  onSelectCategory,
  selectionsCountMap,
  proposalSigned,
  unlockedCategoryKeys,
}: {
  section: CategoryTreeNode;
  isExpanded: boolean;
  activeCategoryKey: string | null;
  completedCategoryKeys: Set<string>;
  skippedCategoryKeys: Set<string>;
  onToggle: () => void;
  onSelectCategory: (key: string) => void;
  selectionsCountMap: Map<string, number>;
  proposalSigned?: boolean;
  unlockedCategoryKeys?: string[];
}) {
  const stats = useMemo(
    () => getSectionCompletionStats(section, completedCategoryKeys, skippedCategoryKeys),
    [section, completedCategoryKeys, skippedCategoryKeys],
  );

  const hasSelectableChildren = section.children.some(
    (g) => g.categoryKey || g.children.length > 0,
  );

  if (!hasSelectableChildren) return null;

  return (
    <div className="sidebar-section">
      <button
        type="button"
        className={`sidebar-section-header${isExpanded ? " expanded" : ""}`}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className="sidebar-section-icon">{section.icon}</span>
        <span className="sidebar-section-label">{section.label}</span>
        <span className="sidebar-section-stats">
          {stats.completed}/{stats.total}
        </span>
        <span className={`sidebar-section-chevron${isExpanded ? " open" : ""}`}>
          ›
        </span>
      </button>

      {isExpanded && (
        <div className="sidebar-section-body">
          {section.children.map((group) => (
            <GroupNode
              key={group.id}
              group={group}
              activeCategoryKey={activeCategoryKey}
              completedCategoryKeys={completedCategoryKeys}
              skippedCategoryKeys={skippedCategoryKeys}
              onSelectCategory={onSelectCategory}
              selectionsCountMap={selectionsCountMap}
              proposalSigned={proposalSigned}
              unlockedCategoryKeys={unlockedCategoryKeys}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Group Node ─────────────────────────────────────────────────────────────

function GroupNode({
  group,
  activeCategoryKey,
  completedCategoryKeys,
  skippedCategoryKeys,
  onSelectCategory,
  selectionsCountMap,
  proposalSigned,
  unlockedCategoryKeys,
}: {
  group: CategoryTreeNode;
  activeCategoryKey: string | null;
  completedCategoryKeys: Set<string>;
  skippedCategoryKeys: Set<string>;
  onSelectCategory: (key: string) => void;
  selectionsCountMap: Map<string, number>;
  proposalSigned?: boolean;
  unlockedCategoryKeys?: string[];
}) {
  const hasActiveChild = useMemo(() => {
    return getSelectableNodes([group]).some(node => node.categoryKey === activeCategoryKey);
  }, [group, activeCategoryKey]);

  const [isExpanded, setIsExpanded] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true);
    }
  }, [hasActiveChild]);

  return (
    <div className="sidebar-group" style={{ marginBottom: "0.25rem" }}>
      <div
        className="sidebar-group-header"
        style={{ padding: "4px 8px 2px 8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="sidebar-group-label" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {group.label}
        </span>
        <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--text-muted)", marginRight: "4px" }}>
          {isExpanded ? "−" : "+"}
        </span>
      </div>

      {isExpanded && (
        <div className="sidebar-group-children" style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "6px" }}>
          {group.children.map((child) => {
            if (child.children.length > 0) {
              return (
                <SubgroupNode
                  key={child.id}
                  subgroup={child}
                  activeCategoryKey={activeCategoryKey}
                  completedCategoryKeys={completedCategoryKeys}
                  skippedCategoryKeys={skippedCategoryKeys}
                  onSelectCategory={onSelectCategory}
                  selectionsCountMap={selectionsCountMap}
                  proposalSigned={proposalSigned}
                  unlockedCategoryKeys={unlockedCategoryKeys}
                />
              );
            } else {
              return (
                <LeafButton
                  key={child.id}
                  node={child}
                  activeCategoryKey={activeCategoryKey}
                  completedCategoryKeys={completedCategoryKeys}
                  skippedCategoryKeys={skippedCategoryKeys}
                  onSelectCategory={onSelectCategory}
                  selectedCount={selectionsCountMap.get(child.categoryKey) || 0}
                  isLocked={proposalSigned && !unlockedCategoryKeys?.includes(child.categoryKey)}
                />
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

// ─── Subgroup Node ──────────────────────────────────────────────────────────

function SubgroupNode({
  subgroup,
  activeCategoryKey,
  completedCategoryKeys,
  skippedCategoryKeys,
  onSelectCategory,
  selectionsCountMap,
  proposalSigned,
  unlockedCategoryKeys,
}: {
  subgroup: CategoryTreeNode;
  activeCategoryKey: string | null;
  completedCategoryKeys: Set<string>;
  skippedCategoryKeys: Set<string>;
  onSelectCategory: (key: string) => void;
  selectionsCountMap: Map<string, number>;
  proposalSigned?: boolean;
  unlockedCategoryKeys?: string[];
}) {
  const hasActiveChild = useMemo(() => {
    return subgroup.children.some(node => node.categoryKey === activeCategoryKey);
  }, [subgroup, activeCategoryKey]);

  const [isExpanded, setIsExpanded] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true);
    }
  }, [hasActiveChild]);

  return (
    <div className="sidebar-subgroup" style={{ marginTop: "4px" }}>
      <div
        className="sidebar-subgroup-header"
        style={{ padding: "2px 8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", opacity: 0.8, textTransform: "uppercase" }}>
          {subgroup.label}
        </span>
        <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: "var(--text-muted)", opacity: 0.8, marginRight: "4px" }}>
          {isExpanded ? "−" : "+"}
        </span>
      </div>
      {isExpanded && (
        <div className="sidebar-subgroup-items" style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "8px", borderLeft: "1px solid var(--border)", marginLeft: "8px" }}>
          {subgroup.children.map((item) => (
            <LeafButton
              key={item.id}
              node={item}
              activeCategoryKey={activeCategoryKey}
              completedCategoryKeys={completedCategoryKeys}
              skippedCategoryKeys={skippedCategoryKeys}
              onSelectCategory={onSelectCategory}
              selectedCount={selectionsCountMap.get(item.categoryKey) || 0}
              isLocked={proposalSigned && !unlockedCategoryKeys?.includes(item.categoryKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Leaf Button Node ───────────────────────────────────────────────────────

function LeafButton({
  node,
  activeCategoryKey,
  completedCategoryKeys,
  skippedCategoryKeys,
  onSelectCategory,
  selectedCount,
  isLocked,
}: {
  node: CategoryTreeNode;
  activeCategoryKey: string | null;
  completedCategoryKeys: Set<string>;
  skippedCategoryKeys: Set<string>;
  onSelectCategory: (key: string) => void;
  selectedCount: number;
  isLocked?: boolean;
}) {
  const isActive = activeCategoryKey === node.categoryKey;
  const isCompleted = completedCategoryKeys.has(node.categoryKey);
  const isSkipped = skippedCategoryKeys.has(node.categoryKey);

  const statusIcon = isLocked ? "🔒" : isCompleted ? "✅" : isSkipped ? "⏭️" : "⬜";

  return (
    <button
      type="button"
      className={`sidebar-leaf${isActive ? " active" : ""}${isCompleted ? " completed" : ""}${isLocked ? " locked" : ""}`}
      onClick={() => onSelectCategory(node.categoryKey)}
      style={{ padding: "0.35rem 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left" }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <span className="sidebar-leaf-status" style={{ marginRight: "6px" }}>{statusIcon}</span>
        <span className="sidebar-leaf-label">{node.label}</span>
      </div>
      {selectedCount > 0 && (
        <span
          style={{
            fontSize: "0.75rem",
            background: isCompleted ? "var(--emerald-soft)" : "var(--border)",
            color: isCompleted ? "var(--primary-emerald)" : "var(--text-muted)",
            padding: "1px 6px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {selectedCount}
        </span>
      )}
    </button>
  );
}
