import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { LevelBadge } from "../components/LevelBadge";
import { useApp } from "../context/AppContext";
import type { ChangeOrderLine } from "../types";
import { countBudgetChanges, groupByCategory } from "../utils/budget";
import { formatCurrency, formatDateTime } from "../utils/format";
import { isMixedLevelProject } from "../utils/project";
import { useAuth } from "../context/AuthContext";
import { CategorySidebarTree } from "../components/CategorySidebarTree";
import { CategoryBreadcrumb } from "../components/CategoryBreadcrumb";
import { SelectionItemCard } from "../components/SelectionItemCard";
import { ProductImage } from "../components/ProductImage";
import { ItemDetailModal } from "../components/ItemDetailModal";
import { buildCategoryTree, getWizardStepsFromTree, getCompletionStats } from "../utils/categoryTree";
import masterCategoriesData from "../data/masterCategories.json";
import SignatureCanvas from "react-signature-canvas";
import { Edit2, Lock, Unlock, Download, ChevronRight, X, Trash2, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { HomeownerSelectionsTab } from "../components/HomeownerSelectionsTab";
import { Button, Card, Chip, Input } from "@heroui/react";

type TabId = "selections" | "budget" | "change-orders" | "timeline" | "analytics";

const TABS: [TabId, string][] = [
  ["selections", "Selections"],
  ["budget", "Budget history"],
  ["change-orders", "Change orders"],
  ["timeline", "Timeline"],
  ["analytics", "Analytics"],
];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { state, createChangeOrder, updateChangeOrderStatus, changeOrderMinimum } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>("selections");
  const [coTitle, setCoTitle] = useState("");
  const [coNotes, setCoNotes] = useState("");
  const [coLines, setCoLines] = useState<
    { category: string; description: string; previousAmount: number; newAmount: number }[]
  >([{ category: "", description: "", previousAmount: 0, newAmount: 0 }]);

  const project = state.projects.find((entry) => entry.id === projectId);

  const budgetStats = useMemo(() => {
    if (!project) return null;
    return countBudgetChanges(project);
  }, [project]);

  const categoryBreakdown = useMemo(() => {
    if (!project) return {};
    return groupByCategory(project.selections);
  }, [project]);

  const initialByCategory = useMemo(() => {
    if (!project?.budgetSnapshots.length) return {};
    return project.budgetSnapshots[project.budgetSnapshots.length - 1]?.byCategory ?? {};
  }, [project]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <h2 className="text-2xl font-bold text-default-500">Project not found</h2>
        <Link to="/" className="text-primary hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const budgetDelta = project.currentBudget - project.initialBudget;
  const recentNotifications = project.timeline.filter((event) => event.type === "notification");

  function handleCreateChangeOrder(event: React.FormEvent) {
    event.preventDefault();
    const validLines = coLines.filter(
      (line) => line.category && line.newAmount !== line.previousAmount,
    );
    if (validLines.length === 0) return;

    const order = createChangeOrder(project!.id, coTitle || "Selection change order", validLines, coNotes);
    if (order) {
      setCoTitle("");
      setCoNotes("");
      setCoLines([{ category: "", description: "", previousAmount: 0, newAmount: 0 }]);
      setActiveTab("change-orders");
    }
  }

  function addCoLineFromSelection(category: string) {
    const current = project!.selections.find((selection) => selection.category === category);
    setCoLines((previous) => [
      ...previous,
      {
        category,
        description: current ? `${current.manufacturer} ${current.model}` : "",
        previousAmount: current?.priceUsed ?? 0,
        newAmount: current?.priceUsed ?? 0,
      },
    ]);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-default-500 hover:text-default-700 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">{project.name}</h1>
        <p className="text-default-500 text-sm mt-0.5">
          {project.clientName} · {project.address || "No address"} ·{" "}
          {isMixedLevelProject(project) ? (
            <Chip size="sm" variant="soft" color="accent">All levels</Chip>
          ) : (
            <LevelBadge level={project.defaultLevel} />
          )}
        </p>
      </div>

      {/* Budget alert */}
      {recentNotifications.length > 0 && (
        <Card className="border border-warning bg-warning-50 dark:bg-warning-50/10">
          <Card.Content className="flex items-center gap-2 px-4 py-3">
            <AlertTriangle size={16} className="text-warning shrink-0" />
            <span className="text-sm text-foreground">
              <strong>Budget alert:</strong> {recentNotifications[0].description}
            </span>
          </Card.Content>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <Card.Content className="p-4 flex flex-col gap-1">
            <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Initial budget</span>
            <span className="text-xl font-bold text-foreground">{formatCurrency(project.initialBudget)}</span>
          </Card.Content>
        </Card>
        <Card className="shadow-sm">
          <Card.Content className="p-4 flex flex-col gap-1">
            <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Current budget</span>
            <span className="text-xl font-bold text-foreground">{formatCurrency(project.currentBudget)}</span>
          </Card.Content>
        </Card>
        {project.proposalSigned && (
          <Card className="shadow-sm">
            <Card.Content className="p-4 flex flex-col gap-1">
              <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Variance</span>
              <span className={`text-xl font-bold flex items-center gap-1 ${budgetDelta > 0 ? "text-warning" : "text-success"}`}>
                {budgetDelta >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                {budgetDelta >= 0 ? "+" : ""}{formatCurrency(budgetDelta)}
              </span>
            </Card.Content>
          </Card>
        )}
        <Card className="shadow-sm">
          <Card.Content className="p-4 flex flex-col gap-1">
            <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Change orders</span>
            <span className="text-xl font-bold text-foreground">{project.changeOrders.length}</span>
          </Card.Content>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-default-100 rounded-xl w-fit">
        {TABS.map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tabId
                ? "bg-background text-foreground shadow-sm"
                : "text-default-500 hover:text-default-700"
            }`}
            onClick={() => setActiveTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Selections tab */}
      {activeTab === "selections" && (
        <SelectionsTab
          projectId={project.id}
          project={project}
          selections={project.selections}
          libraryItems={state.libraryItems}
        />
      )}

      {/* Budget tab */}
      {activeTab === "budget" && (
        <Card className="shadow-sm">
          <Card.Content className="p-5">
            <h3 className="text-lg font-bold text-foreground mb-4">Budget snapshots</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-default-200">
                    <th className="text-left px-3 py-2 text-default-500 font-medium">When</th>
                    <th className="text-left px-3 py-2 text-default-500 font-medium">Label</th>
                    <th className="text-left px-3 py-2 text-default-500 font-medium">Source</th>
                    <th className="text-right px-3 py-2 text-default-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {project.budgetSnapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-b border-default-100 hover:bg-default-50">
                      <td className="px-3 py-2.5 text-default-600">{formatDateTime(snapshot.recordedAt)}</td>
                      <td className="px-3 py-2.5 text-foreground">{snapshot.label}</td>
                      <td className="px-3 py-2.5 text-default-600">{snapshot.source}</td>
                      <td className="px-3 py-2.5 text-right text-foreground font-medium">{formatCurrency(snapshot.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Change orders tab */}
      {activeTab === "change-orders" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <Card.Content className="p-5 space-y-4">
              <h3 className="text-lg font-bold text-foreground">Create change order</h3>
              <p className="text-sm text-default-500">
                Minimum delta: {formatCurrency(changeOrderMinimum)} (per spec sheets)
              </p>
              <form onSubmit={handleCreateChangeOrder} className="space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-default-600">Title</span>
                  <Input
                    value={coTitle}
                    onChange={(e) => setCoTitle(e.target.value)}
                    placeholder="e.g. Kitchen counter upgrade"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-default-600 font-medium">Notes</label>
                  <textarea
                    value={coNotes}
                    onChange={(e) => setCoNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <p className="text-sm text-default-500">Quick add from category:</p>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(categoryBreakdown).map((category) => (
                    <Button
                      key={category}
                      variant="secondary"
                      size="sm"
                      onPress={() => addCoLineFromSelection(category)}
                    >
                      + {category.split(" - ").pop()}
                    </Button>
                  ))}
                </div>
                {coLines.map((line, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_100px_100px] gap-2 items-end"
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-default-500 font-medium">Category</span>
                      <input
                        value={line.category}
                        onChange={(e) => {
                          const next = [...coLines];
                          next[index] = { ...line, category: e.target.value };
                          setCoLines(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-default-200 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-default-500 font-medium">Description</span>
                      <input
                        value={line.description}
                        onChange={(e) => {
                          const next = [...coLines];
                          next[index] = { ...line, description: e.target.value };
                          setCoLines(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-default-200 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-default-500 font-medium">Was</span>
                      <input
                        type="number"
                        value={line.previousAmount || ""}
                        onChange={(e) => {
                          const next = [...coLines];
                          next[index] = { ...line, previousAmount: parseFloat(e.target.value) || 0 };
                          setCoLines(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-default-200 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-default-500 font-medium">Now</span>
                      <input
                        type="number"
                        value={line.newAmount || ""}
                        onChange={(e) => {
                          const next = [...coLines];
                          next[index] = { ...line, newAmount: parseFloat(e.target.value) || 0 };
                          setCoLines(next);
                        }}
                        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-default-200 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                ))}
                <Button type="submit" variant="primary">Draft change order</Button>
              </form>
            </Card.Content>
          </Card>

          {project.changeOrders.map((order) => (
            <Card key={order.id} className="shadow-sm">
              <Card.Content className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">
                    CO #{order.number}: {order.title}
                  </h3>
                  <Chip size="sm" variant="soft" color={order.status === "accepted" ? "success" : order.status === "rejected" ? "danger" : "warning"}>
                    {order.status}
                  </Chip>
                </div>
                <p className="text-sm text-default-500">
                  Created {formatDateTime(order.createdAt)}
                  {order.releasedAt && ` · Released ${formatDateTime(order.releasedAt)}`}
                  {order.acceptedAt && ` · Accepted ${formatDateTime(order.acceptedAt)}`}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {order.totalDelta >= 0 ? "+" : ""}{formatCurrency(order.totalDelta)}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-default-200">
                        <th className="text-left px-3 py-2 text-default-500 font-medium">Category</th>
                        <th className="text-left px-3 py-2 text-default-500 font-medium">Description</th>
                        <th className="text-right px-3 py-2 text-default-500 font-medium">Previous</th>
                        <th className="text-right px-3 py-2 text-default-500 font-medium">New</th>
                        <th className="text-right px-3 py-2 text-default-500 font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((line: ChangeOrderLine) => (
                        <tr key={line.id} className="border-b border-default-100 hover:bg-default-50">
                          <td className="px-3 py-2 text-default-600">{line.category}</td>
                          <td className="px-3 py-2 text-foreground">{line.description}</td>
                          <td className="px-3 py-2 text-right text-default-600">{formatCurrency(line.previousAmount)}</td>
                          <td className="px-3 py-2 text-right text-default-600">{formatCurrency(line.newAmount)}</td>
                          <td className="px-3 py-2 text-right font-medium text-foreground">
                            {line.delta >= 0 ? "+" : ""}{formatCurrency(line.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 pt-1">
                  {order.status === "draft" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onPress={() => updateChangeOrderStatus(project.id, order.id, "released")}
                    >
                      Release to client
                    </Button>
                  )}
                  {order.status === "released" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => updateChangeOrderStatus(project.id, order.id, "accepted")}
                      >
                        Mark accepted
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => updateChangeOrderStatus(project.id, order.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === "timeline" && (
        <Card className="shadow-sm">
          <Card.Content className="p-5">
            <div className="space-y-0">
              {project.timeline.map((event) => (
                <div key={event.id} className="relative pl-8 pb-6 border-l border-default-200 last:pb-0 last:border-l-0">
                  <div className="absolute left-0 top-0 w-2 h-2 rounded-full bg-primary -translate-x-[5px] mt-2" />
                  <div className="text-xs text-default-400 mb-0.5">{formatDateTime(event.timestamp)}</div>
                  <div className="text-sm font-semibold text-foreground">{event.title}</div>
                  <p className="text-sm text-default-500 mt-0.5">{event.description}</p>
                  {event.amountBefore !== undefined && event.amountAfter !== undefined && (
                    <p className="text-xs text-default-400 mt-1">
                      {formatCurrency(event.amountBefore)} → {formatCurrency(event.amountAfter)}
                      {event.category && ` · ${event.category}`}
                    </p>
                  )}
                  <span className="text-[0.65rem] uppercase tracking-wide text-default-400 mt-0.5 block">
                    {event.type.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Analytics tab */}
      {activeTab === "analytics" && budgetStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-sm">
              <Card.Content className="p-4 flex flex-col gap-1">
                <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Budget revisions</span>
                <span className="text-xl font-bold text-foreground">{budgetStats.fromInitial}</span>
              </Card.Content>
            </Card>
            <Card className="shadow-sm">
              <Card.Content className="p-4 flex flex-col gap-1">
                <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Accepted COs</span>
                <span className="text-xl font-bold text-foreground">{budgetStats.acceptedChangeOrders}</span>
              </Card.Content>
            </Card>
            <Card className="shadow-sm">
              <Card.Content className="p-4 flex flex-col gap-1">
                <span className="text-xs text-default-500 font-medium uppercase tracking-wide">Timeline events</span>
                <span className="text-xl font-bold text-foreground">{project.timeline.length}</span>
              </Card.Content>
            </Card>
          </div>
          <Card className="shadow-sm">
            <Card.Content className="p-5">
              <h3 className="text-lg font-bold text-foreground mb-4">Category variance from initial</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-default-200">
                      <th className="text-left px-3 py-2 text-default-500 font-medium">Category</th>
                      <th className="text-right px-3 py-2 text-default-500 font-medium">Initial</th>
                      <th className="text-right px-3 py-2 text-default-500 font-medium">Current</th>
                      <th className="text-right px-3 py-2 text-default-500 font-medium">Change</th>
                      <th className="text-right px-3 py-2 text-default-500 font-medium"># COs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys({ ...initialByCategory, ...categoryBreakdown }).map((category) => {
                      const initial = initialByCategory[category] ?? 0;
                      const current = categoryBreakdown[category] ?? 0;
                      const diff = current - initial;
                      const touchCount = project.changeOrders.filter((order) =>
                        order.lines.some((line) => line.category === category),
                      ).length;
                      return (
                        <tr key={category} className="border-b border-default-100 hover:bg-default-50">
                          <td className="px-3 py-2 text-default-600">{category}</td>
                          <td className="px-3 py-2 text-right text-foreground">{formatCurrency(initial)}</td>
                          <td className="px-3 py-2 text-right text-foreground">{formatCurrency(current)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${diff > 0 ? "text-warning" : diff < 0 ? "text-success" : "text-foreground"}`}>
                            {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground">{touchCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  );
}

function SelectionsTab({
  projectId,
  project,
  selections,
  libraryItems,
}: {
  projectId: string;
  project: import("../types").Project;
  selections: import("../types").ProjectSelection[];
  libraryItems: import("../types").LibraryItem[];
}) {
  const { role } = useAuth();
  const isBuilder = role === "admin" || role === "client";
  const { updateProjectSelection, deleteProjectSelection, toggleDecideLater, updateProjectLastVisited, submitProjectProposal, submitProjectSelections } = useApp();

  const [activeCategoryKey, setActiveCategoryKey] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recommended");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [decideLaterKeys, setDecideLaterKeys] = useState<Set<string>>(new Set());
  const [homeownerActiveSlotKey, setHomeownerActiveSlotKey] = useState<string | undefined>();
  const isHomeowner = role === "end_user";
  const [comparedItems, setComparedItems] = useState<any[]>([]);

  useEffect(() => {
    if (project?.lastVisitedCategoryKey && homeownerActiveSlotKey === undefined) {
      setHomeownerActiveSlotKey(project.lastVisitedCategoryKey);
    }
  }, [project?.lastVisitedCategoryKey]);

  useEffect(() => {
    if (project?.decideLaterSlots) {
      const keys = new Set<string>();
      project.decideLaterSlots.forEach((s) => {
        const parts = s.split("::");
        keys.add(parts[0]);
      });
      setDecideLaterKeys(keys);
    }
  }, [project?.decideLaterSlots]);

  function handleToggleDecideLater(slotKey: string, decideLater: boolean) {
    toggleDecideLater(projectId, slotKey, "", decideLater);
    setDecideLaterKeys((prev) => {
      const next = new Set(prev);
      if (decideLater) next.add(slotKey);
      else next.delete(slotKey);
      return next;
    });
  }

  function handleVisitSlot(slotKey: string) {
    setHomeownerActiveSlotKey(slotKey);
    updateProjectLastVisited(projectId, slotKey);
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const categoryTree = useMemo(() => {
    return buildCategoryTree(masterCategoriesData.sections as any);
  }, []);

  const wizardSteps = useMemo(() => getWizardStepsFromTree(categoryTree), [categoryTree]);

  useEffect(() => {
    if (wizardSteps.length > 0 && !activeCategoryKey) {
      setActiveCategoryKey(wizardSteps[0].categoryKey);
    }
  }, [wizardSteps, activeCategoryKey]);

  const isCategoryLocked = useMemo(() => {
    if (!isHomeowner) return false;
    const isUnlocked = project.unlockedCategoryKeys?.includes(activeCategoryKey) ||
      project.unlockedCategoryKeys?.some((key) => activeCategoryKey.startsWith(key + " - "));
    if (isUnlocked) return false;
    return !!project.proposalSigned || project.status === "selections_submitted" || project.status === "selections_complete";
  }, [project, activeCategoryKey, isHomeowner]);

  const selectionsByCategoryKey = useMemo(() => {
    const map = new Map<string, import("../types").ProjectSelection[]>();
    selections.forEach((s) => {
      const key = s.category;
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    });
    return map;
  }, [selections]);

  const activeCompletedCategoryKeys = useMemo(() => {
    return new Set(selections.filter((s) => s.state === "confirmed").map((s) => s.category));
  }, [selections]);

  const activeSkippedCategoryKeys = useMemo(() => {
    return new Set(selections.filter((s) => s.state === "skipped").map((s) => s.category));
  }, [selections]);

  const hoSections = useMemo(() => {
    if (!isHomeowner && !isMobile) return [];
    return categoryTree.map((sectionNode) => ({
      key: sectionNode.id,
      title: sectionNode.label,
      icon: sectionNode.icon || "📁",
      slots: getWizardStepsFromTree([sectionNode]).map((step) => {
        const categorySelections = selectionsByCategoryKey.get(step.categoryKey) || [];
        const stepSelections = categorySelections.filter((s) => s.state === "confirmed");
        const skippedSel = categorySelections.find((s) => s.state === "skipped");
        const latestSel = stepSelections[stepSelections.length - 1];
        const libItem = latestSel
          ? libraryItems.find((i) => i.id === latestSel.libraryItemId)
          : libraryItems.find((i) => i.categoryKey === step.categoryKey && !!i.imageUrl);
        const stepLibraryItems = libraryItems.filter((i) => i.categoryKey === step.categoryKey);

        const selectedItems = stepSelections.map((sel) => {
          const matchingLibItem = libraryItems.find((i) => i.id === sel.libraryItemId);
          return {
            selectionId: sel.id,
            libraryItemId: sel.libraryItemId || "",
            quantity: sel.quantity || 1,
            priceUsed: sel.priceUsed || matchingLibItem?.priceMin || 0,
            manufacturer: matchingLibItem?.manufacturer,
            model: matchingLibItem?.model,
            product: matchingLibItem?.product,
            level: matchingLibItem?.level,
            finish: matchingLibItem?.finish,
            size: matchingLibItem?.size,
            vendor: matchingLibItem?.vendor,
            imageUrl: sel.imageUrl || matchingLibItem?.imageUrl,
            specifications: matchingLibItem?.specifications,
          };
        });

        return {
          slotKey: step.categoryKey,
          slotLabel: step.label || step.categoryKey.split(" - ").pop() || step.categoryKey,
          sectionTitle: sectionNode.label,
          selectionId: latestSel?.id || skippedSel?.id,
          libraryItemId: latestSel?.libraryItemId,
          state: latestSel ? latestSel.state : (skippedSel ? "skipped" : undefined),
          isSkipped: !!skippedSel,
          manufacturer: libItem?.manufacturer,
          model: libItem?.model,
          product: libItem?.product,
          finish: libItem?.finish,
          size: (libItem as any)?.size,
          vendor: (libItem as any)?.vendor,
          specifications: (libItem as any)?.specifications,
          tags: (libItem as any)?.tags,
          level: libItem?.level,
          priceMin: libItem?.priceMin,
          priceMax: libItem?.priceMax,
          imageUrl: latestSel?.imageUrl || libItem?.imageUrl,
          galleryImages: (libItem as any)?.galleryImages,
          isDecideLater: decideLaterKeys.has(step.categoryKey) || decideLaterKeys.has(`${step.categoryKey}::`),
          selectedItems,
          availableItems: stepLibraryItems.map((item) => ({
            id: item.id,
            manufacturer: item.manufacturer,
            model: item.model,
            product: item.product,
            imageUrl: item.imageUrl,
            priceMin: item.priceMin,
            priceMax: item.priceMax,
            level: item.level,
            tags: item.tags,
            galleryImages: (item as any).galleryImages,
            specifications: item.specifications,
            finish: item.finish,
            size: item.size,
            vendor: item.vendor,
          })),
        };
      }),
    })).filter((s) => s.slots.length > 0);
  }, [isHomeowner, isMobile, categoryTree, selectionsByCategoryKey, libraryItems, decideLaterKeys]);

  const filteredAndSortedItems = useMemo(() => {
    let items = libraryItems.filter((i) => i.categoryKey === activeCategoryKey);

    if (levelFilter !== "all") {
      items = items.filter((i) => i.level === levelFilter);
    }

    items = [...items].sort((a, b) => {
      if (sortBy === "price-asc") {
        return a.priceMin - b.priceMin;
      }
      if (sortBy === "price-desc") {
        return b.priceMin - a.priceMin;
      }
      if (sortBy === "name") {
        const nameA = `${a.manufacturer} ${a.model}`.toLowerCase();
        const nameB = `${b.manufacturer} ${b.model}`.toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return a.priceMin - b.priceMin;
    });

    return items;
  }, [libraryItems, activeCategoryKey, levelFilter, sortBy]);

  function handleSelectItem(categoryKey: string, libraryItemId: string, priceMin: number, quantity?: number) {
    updateProjectSelection(projectId, categoryKey, {
      libraryItemId,
      priceUsed: priceMin,
      quantity: quantity ?? 1,
      state: "confirmed",
      slotLabel: libraryItemId,
    });
  }

  function handleUpdateSelectionProperty(selectionId: string, categoryKey: string, updates: { quantity?: number; slotLabel?: string }) {
    updateProjectSelection(projectId, categoryKey, {
      id: selectionId,
      ...updates,
    });
  }

  function handleDeleteSelectionSlot(selectionId: string) {
    deleteProjectSelection(projectId, selectionId);
  }

  function handleSkipCategory(categoryKey: string) {
    const isSkipped = activeSkippedCategoryKeys.has(categoryKey);
    if (isSkipped) {
      const skipped = selections.find((s) => s.category === categoryKey && s.state === "skipped");
      if (skipped) {
        deleteProjectSelection(projectId, skipped.id);
      }
    } else {
      updateProjectSelection(projectId, categoryKey, {
        state: "skipped",
      });
    }
  }

  function toggleCompare(item: any) {
    setComparedItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        return prev.filter((i) => i.id !== item.id);
      }
      if (prev.length >= 3) {
        alert("You can compare up to 3 items at a time.");
        return prev;
      }
      return [...prev, item];
    });
  }

  function handleResumeSelections() {
    if (!project?.lastVisitedCategoryKey) return;
    const categoryKey = project.lastVisitedCategoryKey;
    if (isHomeowner) {
      setHomeownerActiveSlotKey(categoryKey);
    } else {
      setActiveCategoryKey(categoryKey);
    }
  }

  const overallProgress = useMemo(() => {
    const stats = getCompletionStats(categoryTree, activeCompletedCategoryKeys, activeSkippedCategoryKeys);
    return {
      completed: stats.completed,
      total: stats.total,
      percent: stats.percentage,
    };
  }, [categoryTree, activeCompletedCategoryKeys, activeSkippedCategoryKeys]);

  const mappedSelectionsForTree = useMemo(() => {
    return selections.map((s) => ({
      ...s,
      categoryKey: s.category,
      state: s.state || "confirmed",
    } as any));
  }, [selections]);

  return (
    <div className="space-y-6">
      {/* Progress Bar Header */}
      <Card className="shadow-sm">
        <Card.Content className="p-4 flex items-center gap-6">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold text-default-500 mb-1">
              <span>Project Selection Progress</span>
              <span>{overallProgress.completed} of {overallProgress.total} completed ({overallProgress.percent}%)</span>
            </div>
            <div className="w-full h-2 bg-default-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${overallProgress.percent}%` }}
              />
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Resume Selections Banner */}
      {project.lastVisitedCategoryKey && (
        <Card className="shadow-sm border border-primary">
          <Card.Content className="p-4 flex items-center justify-between gap-4">
            <span className="text-sm text-foreground">
              Welcome back! Resume your sheet choices at <strong>{project.lastVisitedCategoryKey.split(" - ").slice(-1)[0]}</strong>.
            </span>
            <Button variant="primary" size="sm" onPress={handleResumeSelections}>
              Resume Sheet Selection
            </Button>
          </Card.Content>
        </Card>
      )}

      {isHomeowner || isMobile ? (
        <HomeownerSelectionsTab
          sections={hoSections}
          proposalSigned={!!project.proposalSigned}
          unlockedCategoryKeys={project.unlockedCategoryKeys || []}
          onSelectItem={handleSelectItem}
          onRemoveSelection={(slotKey) => {
            const catSels = selectionsByCategoryKey.get(slotKey) || [];
            catSels.forEach((s) => handleDeleteSelectionSlot(s.id));
          }}
          onToggleDecideLater={handleToggleDecideLater}
          decideLaterKeys={decideLaterKeys}
          lastVisitedCategoryKey={homeownerActiveSlotKey}
          onVisitSlot={handleVisitSlot}
          onSkipCategory={handleSkipCategory}
          onRemoveSelectionItem={handleDeleteSelectionSlot}
          onUpdateQuantity={(selectionId, slotKey, quantity) =>
            handleUpdateSelectionProperty(selectionId, slotKey, { quantity })
          }
          onSubmitSelections={async () => { submitProjectSelections(project.id); }}
          onSubmitProposal={async (body) => { submitProjectProposal(project.id, body); }}
          proposalPdfUrl={project.proposalPdfUrl}
          projectStatus={project.status}
        />
      ) : (
        <div
          className="grid gap-6 items-start"
          style={{ gridTemplateColumns: isSidebarCollapsed ? "60px 1fr 350px" : "280px 1fr 350px", minHeight: "75vh" }}
        >
          {/* Left sidebar */}
          <CategorySidebarTree
            tree={categoryTree}
            activeCategoryKey={activeCategoryKey}
            completedCategoryKeys={activeCompletedCategoryKeys}
            skippedCategoryKeys={activeSkippedCategoryKeys}
            onSelectCategory={(key) => setActiveCategoryKey(key)}
            selections={mappedSelectionsForTree}
            proposalSigned={project.proposalSigned}
            unlockedCategoryKeys={project.unlockedCategoryKeys}
            collapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
          />

          {/* Middle workspace */}
          <section className="flex flex-col gap-6 min-w-0">
            {activeCategoryKey ? (
              <div>
                <CategoryBreadcrumb
                  tree={categoryTree}
                  categoryKey={activeCategoryKey}
                  onNavigate={(key) => setActiveCategoryKey(key)}
                />

                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground m-0">{activeCategoryKey.split(" - ").pop()}</h2>
                  <div className="flex gap-2">
                    {activeSkippedCategoryKeys.has(activeCategoryKey) ? (
                      <Button variant="secondary" size="sm" isDisabled={isCategoryLocked} onPress={() => handleSkipCategory(activeCategoryKey)}>
                        Undo Skip
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" isDisabled={isCategoryLocked} onPress={() => handleSkipCategory(activeCategoryKey)}>
                        Skip Category
                      </Button>
                    )}
                  </div>
                </div>

                {isCategoryLocked && (
                  <Card className="mb-6 border border-warning bg-warning-50 dark:bg-warning-50/10">
                    <Card.Content className="flex items-center gap-2 px-4 py-3">
                      <Lock size={14} className="text-warning" />
                      <span className="text-sm text-foreground">This category is locked. Please contact your builder or PM to make changes.</span>
                    </Card.Content>
                  </Card>
                )}

                {/* Selected Items Strip */}
                {activeCategoryKey && !activeSkippedCategoryKeys.has(activeCategoryKey) && selectionsByCategoryKey.get(activeCategoryKey) && selectionsByCategoryKey.get(activeCategoryKey)!.length > 0 && (
                  <Card className="mb-6 shadow-sm border border-default-200">
                    <Card.Content className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-foreground">Selected for this Slot</span>
                            <Chip size="sm" variant="soft" color="accent">
                              {selectionsByCategoryKey.get(activeCategoryKey)!.length} Item(s)
                            </Chip>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {selectionsByCategoryKey.get(activeCategoryKey)!.map((sel) => {
                              const libItem = libraryItems.find((i) => i.id === sel.libraryItemId);
                              return (
                                <div
                                  key={sel.id}
                                  className="flex items-center gap-2 p-2 rounded-lg bg-default-50 cursor-pointer hover:bg-default-100 transition-colors shrink-0"
                                  onClick={() => { if (libItem) setDetailItem(libItem); }}
                                >
                                  <img
                                    src={sel.imageUrl || "/placeholder.png"}
                                    alt={sel.product || ""}
                                    className="w-10 h-10 rounded object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=No+Image"; }}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-foreground truncate max-w-[120px]">{sel.manufacturer} {sel.model}</div>
                                    <div className="text-xs text-default-500">{formatCurrency((sel.priceUsed || 0) * (sel.quantity || 1))} (Qty: {sel.quantity || 1})</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-default-500">Subtotal</div>
                          <div className="text-lg font-bold text-foreground">
                            {formatCurrency(
                              selectionsByCategoryKey.get(activeCategoryKey)!.reduce((sum, sel) => sum + (sel.priceUsed || 0) * (sel.quantity || 1), 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                )}

                {/* Selected Items for this Slot list */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-default-500 uppercase tracking-wider mb-3">Selected Items for this Slot</h4>
                  {activeSkippedCategoryKeys.has(activeCategoryKey) ? (
                    <Card className="border border-dashed border-default-300 bg-default-50">
                      <Card.Content className="p-5">
                        <p className="text-sm text-default-500">This category has been marked as <strong>Skipped</strong> (not included in scope).</p>
                      </Card.Content>
                    </Card>
                  ) : (!selectionsByCategoryKey.get(activeCategoryKey) || selectionsByCategoryKey.get(activeCategoryKey)!.length === 0) ? (
                    <Card className="border border-dashed border-default-300 bg-default-50">
                      <Card.Content className="p-5">
                        <p className="text-sm text-default-500">No selection has been made for this category yet. Review options below.</p>
                      </Card.Content>
                    </Card>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectionsByCategoryKey.get(activeCategoryKey)!.map((sel) => (
                        <Card key={sel.id} className="shadow-sm border border-default-200 bg-default-50">
                          <Card.Content className="p-4 flex items-start gap-4">
                            <div className="w-14 h-14 shrink-0">
                              <ProductImage imageUrl={sel.imageUrl} alt={sel.product || ""} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {sel.level && <LevelBadge level={sel.level} />}
                                <span className="text-sm font-semibold text-foreground">{sel.manufacturer} {sel.model}</span>
                              </div>
                              <p className="text-xs text-default-500 mt-0.5">{sel.product} {sel.finish && `· ${sel.finish}`}</p>
                            </div>

                            <div className="flex flex-wrap gap-3 items-center justify-end">
                              <div className="flex flex-col">
                                <label className="text-[0.65rem] text-default-500 font-semibold">Label</label>
                                <input
                                  type="text"
                                  value={sel.slotLabel || ""}
                                  onChange={(e) => handleUpdateSelectionProperty(sel.id, activeCategoryKey, { slotLabel: e.target.value })}
                                  placeholder="e.g. Ground Floor"
                                  disabled={isCategoryLocked}
                                  className="w-[110px] px-2 py-1 text-xs rounded-md border border-default-200 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[0.65rem] text-default-500 font-semibold">Qty</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSelectionProperty(sel.id, activeCategoryKey, { quantity: Math.max(1, (sel.quantity || 1) - 1) })}
                                    disabled={isCategoryLocked}
                                    className="w-6 h-6 text-sm font-bold rounded border border-default-200 bg-background text-foreground cursor-pointer hover:bg-default-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >-</button>
                                  <span className="w-5 text-center text-sm font-bold text-foreground">{sel.quantity || 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateSelectionProperty(sel.id, activeCategoryKey, { quantity: (sel.quantity || 1) + 1 })}
                                    disabled={isCategoryLocked}
                                    className="w-6 h-6 text-sm font-bold rounded border border-default-200 bg-background text-foreground cursor-pointer hover:bg-default-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >+</button>
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[0.65rem] text-default-500">Subtotal</span>
                                <span className="text-sm font-bold text-primary">{formatCurrency((sel.priceUsed || 0) * (sel.quantity || 1))}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteSelectionSlot(sel.id)}
                                disabled={isCategoryLocked}
                                className="text-danger hover:text-danger/80 disabled:opacity-50 p-1"
                                title="Delete selection"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available catalog options */}
                <div>
                  <h4 className="text-xs font-bold text-default-500 uppercase tracking-wider mb-3">Available Options in Catalog</h4>

                  {activeCategoryKey && !activeSkippedCategoryKeys.has(activeCategoryKey) && (
                    <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          ["all", "All Levels"],
                          ["1", "Level 1 (Value)"],
                          ["2", "Level 2 (Mid)"],
                          ["3", "Level 3 (Premium)"],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              levelFilter === key
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-default-100 text-default-600 hover:bg-default-200"
                            }`}
                            onClick={() => setLevelFilter(key)}
                          >{label}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-default-500">Sort by:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-default-200 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="recommended">Recommended</option>
                          <option value="price-asc">Price: Low → High</option>
                          <option value="price-desc">Price: High → Low</option>
                          <option value="name">Name: A-Z</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {filteredAndSortedItems.length === 0 ? (
                    <Card className="border border-dashed border-default-300">
                      <Card.Content className="p-8 text-center">
                        <p className="text-default-500 text-sm">
                          {libraryItems.filter((i) => i.categoryKey === activeCategoryKey).length === 0
                            ? "No items matching this category found in Library."
                            : "No items matching the active filters found."}
                        </p>
                      </Card.Content>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredAndSortedItems.map((item) => {
                        const categorySelections = selectionsByCategoryKey.get(activeCategoryKey) || [];
                        const itemSelections = categorySelections.filter(s => s.libraryItemId === item.id);
                        const isSelected = itemSelections.length > 0;
                        const totalQty = itemSelections.reduce((sum, s) => sum + (s.quantity || 1), 0);

                        return (
                          <SelectionItemCard
                            key={item.id}
                            item={item as any}
                            isSelected={isSelected}
                            selectedQuantity={totalQty}
                            onSelect={() => handleSelectItem(activeCategoryKey, item.id, item.priceMin)}
                            onDeselect={() => { itemSelections.forEach(s => handleDeleteSelectionSlot(s.id)); }}
                            onOpenDetail={() => setDetailItem(item)}
                            multiSelect={true}
                            showCompare={true}
                            isComparing={comparedItems.some((i) => i.id === item.id)}
                            onToggleCompare={() => toggleCompare(item)}
                            isLocked={isCategoryLocked}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-default-500">
                Select a category from the tree on the left.
              </div>
            )}
          </section>

          {/* Right aside selections summary */}
          <aside className="flex flex-col gap-4">
            <MockSelectionsSummaryPanel
              projectId={projectId}
              selections={selections}
              project={project}
              isBuilder={isBuilder}
              onSelectCategory={(key) => setActiveCategoryKey(key)}
              flatCategories={wizardSteps.map((step) => step.categoryKey)}
            />
          </aside>
        </div>
      )}

      {/* Item Detail Modal */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onSelect={() => {
            handleSelectItem(activeCategoryKey, detailItem.id, detailItem.priceMin);
            setDetailItem(null);
          }}
          isSelected={selections.some((s) => s.libraryItemId === detailItem.id && s.state === "confirmed")}
          selectedQuantity={selections.filter((s) => s.libraryItemId === detailItem.id && s.state === "confirmed").reduce((sum, s) => sum + (s.quantity || 1), 0)}
          onDeselect={() => {
            const itemSelections = selections.filter((s) => s.libraryItemId === detailItem.id);
            itemSelections.forEach((s) => handleDeleteSelectionSlot(s.id));
            setDetailItem(null);
          }}
          isAdmin={isBuilder}
          isLocked={isCategoryLocked}
        />
      )}
    </div>
  );
}

interface MockSelectionsSummaryPanelProps {
  projectId: string;
  selections: import("../types").ProjectSelection[];
  project: import("../types").Project;
  isBuilder: boolean;
  onSelectCategory: (categoryKey: string) => void;
  flatCategories?: string[];
}

function MockSelectionsSummaryPanel({
  projectId,
  selections,
  project,
  isBuilder,
  onSelectCategory,
  flatCategories = [],
}: MockSelectionsSummaryPanelProps) {
  const { updateProjectSelection, submitProjectProposal, unlockProjectCategories } = useApp();

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDiscountType, setEditDiscountType] = useState<"percent" | "flat">("percent");
  const [editDiscountVal, setEditDiscountVal] = useState<string>("0");
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureType, setSignatureType] = useState<"drawn" | "typed">("typed");
  const [typedName, setTypedName] = useState(project.clientName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocksPanelOpen, setIsLocksPanelOpen] = useState(false);
  const [selectedUnlockedKeys, setSelectedUnlockedKeys] = useState<string[]>(project.unlockedCategoryKeys || []);
  const signatureRef = useRef<SignatureCanvas>(null);

  const confirmedSelections = useMemo(() => {
    return selections.filter((s) => s.state === "confirmed");
  }, [selections]);

  const financials = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;

    confirmedSelections.forEach((s) => {
      const qty = s.quantity ?? 1;
      const price = s.priceUsed ?? 0;
      const itemCost = price * qty;
      subtotal += itemCost;

      let discount = 0;
      if (s.discountPercent && s.discountPercent > 0) {
        discount = itemCost * (s.discountPercent / 100);
      } else if (s.discountFlat && s.discountFlat > 0) {
        discount = s.discountFlat;
      }
      totalDiscount += discount;
    });

    const finalCost = Math.max(0, subtotal - totalDiscount);
    const budget = project.initialBudget || 0;
    const variance = finalCost - budget;

    return { subtotal, totalDiscount, finalCost, variance };
  }, [confirmedSelections, project.initialBudget]);

  const groupedSelections = useMemo(() => {
    const map: Record<string, import("../types").ProjectSelection[]> = {};
    confirmedSelections.forEach((s) => {
      if (!map[s.category]) { map[s.category] = []; }
      map[s.category].push(s);
    });
    return map;
  }, [confirmedSelections]);

  function handleStartEditDiscount(item: import("../types").ProjectSelection) {
    setEditingItemId(item.id);
    if (item.discountPercent && item.discountPercent > 0) {
      setEditDiscountType("percent");
      setEditDiscountVal(item.discountPercent.toString());
    } else if (item.discountFlat && item.discountFlat > 0) {
      setEditDiscountType("flat");
      setEditDiscountVal(item.discountFlat.toString());
    } else {
      setEditDiscountType("percent");
      setEditDiscountVal("0");
    }
  }

  function handleSaveDiscount(item: import("../types").ProjectSelection) {
    const parsed = parseFloat(editDiscountVal) || 0;
    const updates: { discountPercent: number; discountFlat: number } = { discountPercent: 0, discountFlat: 0 };
    if (editDiscountType === "percent") {
      updates.discountPercent = Math.min(100, Math.max(0, parsed));
    } else {
      updates.discountFlat = Math.max(0, parsed);
    }
    updateProjectSelection(projectId, item.category, { id: item.id, ...updates });
    setEditingItemId(null);
  }

  function handleSaveLocks() {
    unlockProjectCategories(projectId, selectedUnlockedKeys);
    setIsLocksPanelOpen(false);
  }

  function handleSubmitSign() {
    setIsSubmitting(true);
    let signatureImageBase64: string | undefined;
    if (signatureType === "drawn" && !signatureRef.current?.isEmpty()) {
      signatureImageBase64 = signatureRef.current?.toDataURL("image/png");
    }
    submitProjectProposal(projectId, {
      signatureType,
      typedName: signatureType === "typed" ? typedName : undefined,
      signatureImageBase64,
    });
    setIsSubmitting(false);
    setIsSignModalOpen(false);
  }

  const isLockedForHomeowner = project.proposalSigned;

  return (
    <Card className="shadow-sm sticky top-4">
      <Card.Content className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default-200 pb-3">
          <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
            <span>Selections Summary</span>
            {isLockedForHomeowner ? (
              <Chip size="sm" variant="soft" color="warning"><Lock size={10} /> Locked</Chip>
            ) : (
              <Chip size="sm" variant="soft" color="success"><Unlock size={10} /> Editable</Chip>
            )}
          </h3>
          {isBuilder && isLockedForHomeowner && (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => { setSelectedUnlockedKeys(project.unlockedCategoryKeys || []); setIsLocksPanelOpen(!isLocksPanelOpen); }}
              className="min-w-0 px-2"
            >
              <Lock size={12} />
            </Button>
          )}
        </div>

        {/* Locks panel */}
        {isLocksPanelOpen && isBuilder && (
          <Card className="shadow-sm border border-default-200">
            <Card.Content className="p-4 flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-foreground">Allow client changes for specific categories:</h4>
              <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1 p-1 border border-default-200 rounded-md bg-background">
                {flatCategories.map((key) => {
                  const label = key.split(" - ").slice(-1)[0];
                  const isChecked = selectedUnlockedKeys.includes(key);
                  return (
                    <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer px-1 py-0.5 rounded hover:bg-default-50">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) { setSelectedUnlockedKeys([...selectedUnlockedKeys, key]); }
                          else { setSelectedUnlockedKeys(selectedUnlockedKeys.filter((k) => k !== key)); }
                        }}
                        className="accent-primary"
                      />
                      <span className="text-foreground">{label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onPress={handleSaveLocks} className="flex-1">Save Locks</Button>
                <Button variant="secondary" size="sm" onPress={() => setIsLocksPanelOpen(false)}>Cancel</Button>
              </div>
            </Card.Content>
          </Card>
        )}

        {/* Selections list */}
        <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
          {confirmedSelections.length === 0 ? (
            <div className="text-center py-6 text-default-500 text-sm">No selections confirmed yet.</div>
          ) : (
            Object.entries(groupedSelections).map(([categoryKey, items]) => (
              <div key={categoryKey} className="border-b border-dashed border-default-200 pb-2 last:border-b-0">
                <div
                  className="text-[0.65rem] font-bold text-primary uppercase mb-1 flex items-center justify-between cursor-pointer hover:text-primary/80"
                  onClick={() => onSelectCategory(categoryKey)}
                >
                  <span>{categoryKey.split(" - ").slice(-1)[0]}</span>
                  <ChevronRight size={10} />
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const qty = item.quantity ?? 1;
                    const itemSubtotal = (item.priceUsed ?? 0) * qty;
                    let discountAmt = 0;
                    if (item.discountPercent && item.discountPercent > 0) {
                      discountAmt = itemSubtotal * (item.discountPercent / 100);
                    } else if (item.discountFlat && item.discountFlat > 0) {
                      discountAmt = item.discountFlat;
                    }
                    const finalItemCost = Math.max(0, itemSubtotal - discountAmt);
                    const hasDiscount = discountAmt > 0;
                    const isUnlockedCategory = project.unlockedCategoryKeys?.includes(item.category);

                    return (
                      <div key={item.id} className="flex gap-2.5 items-start bg-default-50 p-1.5 rounded-lg">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.product} className="w-10 h-10 object-cover rounded border border-default-200" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-default-200 flex items-center justify-center text-[0.5rem] text-default-500">No Image</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">{item.manufacturer} {item.model}</div>
                          <div className="text-[0.65rem] text-default-500">Qty: {qty} · Level {item.level}</div>

                          {editingItemId === item.id ? (
                            <div className="flex flex-col gap-1 mt-1.5 p-1.5 rounded border border-default-200 bg-background">
                              <div className="flex gap-1">
                                <select
                                  value={editDiscountType}
                                  onChange={(e) => setEditDiscountType(e.target.value as any)}
                                  className="text-[0.65rem] px-1 py-0.5 rounded border border-default-200 bg-background text-foreground"
                                >
                                  <option value="percent">% Discount</option>
                                  <option value="flat">$ Flat</option>
                                </select>
                                <input
                                  type="number"
                                  value={editDiscountVal}
                                  onChange={(e) => setEditDiscountVal(e.target.value)}
                                  className="w-14 text-[0.65rem] px-1 py-0.5 rounded border border-default-200 bg-background text-foreground"
                                  min="0"
                                />
                              </div>
                              <div className="flex gap-1">
                                <Button variant="primary" size="sm" onPress={() => handleSaveDiscount(item)} className="min-w-0 px-2 text-[0.65rem] h-6">Save</Button>
                                <Button variant="secondary" size="sm" onPress={() => setEditingItemId(null)} className="min-w-0 px-2 text-[0.65rem] h-6">Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {hasDiscount ? (
                                <>
                                  <span className="text-xs text-default-400 line-through">{formatCurrency(itemSubtotal)}</span>
                                  <span className="text-xs font-bold text-success">{formatCurrency(finalItemCost)}</span>
                                  <Chip size="sm" variant="soft" color="success" className="text-[0.55rem] h-4">
                                    {item.discountPercent ? `${item.discountPercent}% off` : `$${item.discountFlat} off`}
                                  </Chip>
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-foreground">{formatCurrency(itemSubtotal)}</span>
                              )}
                              {isBuilder && (
                                <button
                                  onClick={() => handleStartEditDiscount(item)}
                                  className="text-primary hover:text-primary/80 p-0.5"
                                  title="Edit Discount"
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </div>
                          )}
                          {isLockedForHomeowner && isUnlockedCategory && (
                            <div className="text-[0.55rem] font-bold text-success mt-0.5">Category Unlocked for changes</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial summary */}
        <Card className="shadow-sm border border-default-200">
          <Card.Content className="p-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-default-500">Subtotal:</span>
              <strong className="text-foreground">{formatCurrency(financials.subtotal)}</strong>
            </div>
            {financials.totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-success">
                <span>Total Discounts:</span>
                <strong>-{formatCurrency(financials.totalDiscount)}</strong>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-default-200 pt-1.5">
              <span className="text-foreground">Total Selections Cost:</span>
              <strong className="text-foreground">{formatCurrency(financials.finalCost)}</strong>
            </div>
            {project.proposalSigned && (
              <div className={`flex justify-between text-xs ${financials.variance > 0 ? "text-warning" : "text-success"}`}>
                <span>Variance Overage:</span>
                <strong>{financials.variance >= 0 ? "+" : ""}{formatCurrency(financials.variance)}</strong>
              </div>
            )}
          </Card.Content>
        </Card>

        {/* Action buttons */}
        {isLockedForHomeowner ? (
          <div className="flex flex-col gap-2">
            {project.proposalPdfUrl && (
              <Button
                variant="secondary"
                size="sm"
                onPress={() => alert("Mock PDF generated: " + project.proposalPdfUrl)}
                className="w-full"
              >
                <Download size={14} /> Download Signed Proposal
              </Button>
            )}
            {!isBuilder && project.unlockedCategoryKeys && project.unlockedCategoryKeys.length > 0 && (
              <Button variant="primary" size="sm" onPress={() => setIsSignModalOpen(true)} className="w-full">
                Sign Updated Proposal
              </Button>
            )}
          </div>
        ) : (
          confirmedSelections.length > 0 && (
            <Button variant="primary" size="sm" onPress={() => setIsSignModalOpen(true)} className="w-full">
              Sign & Finalize Selections
            </Button>
          )
        )}
      </Card.Content>

      {/* Signature Modal */}
      {isSignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full shadow-xl">
            <Card.Content className="p-6 flex flex-col gap-4 relative">
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="absolute top-3 right-3 text-default-400 hover:text-default-600"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-foreground m-0">Sign Selections Proposal</h3>
              <p className="text-sm text-default-500 m-0">
                By signing, you finalize the current selections total of <strong>{formatCurrency(financials.finalCost)}</strong>. The sheet will lock for further changes until unlocked by your manager.
              </p>

              <div className="flex gap-4 border-b border-default-200 pb-3">
                {(["typed", "drawn"] as const).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer text-foreground">
                    <input
                      type="radio"
                      name="sigType"
                      checked={signatureType === type}
                      onChange={() => setSignatureType(type)}
                      className="accent-primary"
                    />
                    {type === "typed" ? "Typed Signature" : "Drawn Signature"}
                  </label>
                ))}
              </div>

              {signatureType === "typed" ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-default-600">Type your full name:</label>
                  <Input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                  <div className="mt-2 p-3 border border-dashed border-default-200 bg-default-50 rounded-lg text-center">
                    <span className="font-serif italic text-xl text-primary">{typedName || "Your Signature"}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-default-600">Draw your signature below:</label>
                  <div className="border border-default-200 rounded-lg overflow-hidden">
                    <SignatureCanvas
                      ref={signatureRef}
                      canvasProps={{ className: "sigCanvas", style: { width: "100%", height: 120, background: "#fff" } as React.CSSProperties }}
                    />
                  </div>
                  <Button variant="secondary" size="sm" onPress={() => signatureRef.current?.clear()} className="self-end">
                    Clear Canvas
                  </Button>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <Button variant="primary" onPress={handleSubmitSign} isDisabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Submitting..." : "Submit Signature"}
                </Button>
                <Button variant="secondary" onPress={() => setIsSignModalOpen(false)} isDisabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}
    </Card>
  );
}
