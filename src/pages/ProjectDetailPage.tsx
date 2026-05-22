import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChangeSelectionModal } from "../components/ChangeSelectionModal";
import { LevelBadge } from "../components/LevelBadge";
import { SelectionProductCard } from "../components/SelectionProductCard";
import { useApp } from "../context/AppContext";
import type { ChangeOrderLine } from "../types";
import { countBudgetChanges, groupByCategory } from "../utils/budget";
import { formatCurrency, formatDateTime } from "../utils/format";
import { isMixedLevelProject } from "../utils/project";

type TabId = "selections" | "budget" | "change-orders" | "timeline" | "analytics";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    state,
    updateProjectSelection,
    createChangeOrder,
    updateChangeOrderStatus,
    changeOrderMinimum,
  } = useApp();
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
      <div className="empty-state">
        <h2>Project not found</h2>
        <Link to="/">Back to dashboard</Link>
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
    <div>
      <div className="page-header">
        <div>
          <Link to="/" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            ← Dashboard
          </Link>
          <h1>{project.name}</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {project.clientName} · {project.address || "No address"} ·{" "}
            {isMixedLevelProject(project) ? (
              <span className="level-summary-badge">All levels</span>
            ) : (
              <LevelBadge level={project.defaultLevel} />
            )}
          </p>
        </div>
      </div>

      {recentNotifications.length > 0 && (
        <div className="alert">
          <strong>Budget alert:</strong> {recentNotifications[0].description}
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="label">Initial budget</div>
          <div className="value">{formatCurrency(project.initialBudget)}</div>
        </div>
        <div className="stat">
          <div className="label">Current budget</div>
          <div className="value">{formatCurrency(project.currentBudget)}</div>
        </div>
        <div className="stat">
          <div className="label">Variance</div>
          <div className="value" style={{ color: budgetDelta > 0 ? "var(--warning)" : undefined }}>
            {budgetDelta >= 0 ? "+" : ""}
            {formatCurrency(budgetDelta)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Change orders</div>
          <div className="value">{project.changeOrders.length}</div>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            ["selections", "Selections"],
            ["budget", "Budget history"],
            ["change-orders", "Change orders"],
            ["timeline", "Timeline"],
            ["analytics", "Analytics"],
          ] as [TabId, string][]
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={`tab${activeTab === tabId ? " active" : ""}`}
            onClick={() => setActiveTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "selections" && (
        <SelectionsTab
          projectId={project.id}
          selections={project.selections}
          libraryItems={state.libraryItems}
          onUpdate={updateProjectSelection}
        />
      )}

      {activeTab === "budget" && (
        <div className="card">
          <h3>Budget snapshots</h3>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Label</th>
                <th>Source</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {project.budgetSnapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{formatDateTime(snapshot.recordedAt)}</td>
                  <td>{snapshot.label}</td>
                  <td>{snapshot.source}</td>
                  <td>{formatCurrency(snapshot.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "change-orders" && (
        <div>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h3>Create change order</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Minimum delta: {formatCurrency(changeOrderMinimum)} (per spec sheets)
            </p>
            <form onSubmit={handleCreateChangeOrder}>
              <div className="field">
                <label>Title</label>
                <input value={coTitle} onChange={(event) => setCoTitle(event.target.value)} />
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={coNotes} onChange={(event) => setCoNotes(event.target.value)} rows={2} />
              </div>
              <p style={{ fontSize: "0.85rem" }}>Quick add from category:</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {Object.keys(categoryBreakdown).map((category) => (
                  <button
                    key={category}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => addCoLineFromSelection(category)}
                  >
                    + {category.split(" - ").pop()}
                  </button>
                ))}
              </div>
              {coLines.map((line, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 100px 100px",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <input
                    placeholder="Category"
                    value={line.category}
                    onChange={(event) => {
                      const next = [...coLines];
                      next[index] = { ...line, category: event.target.value };
                      setCoLines(next);
                    }}
                  />
                  <input
                    placeholder="Description"
                    value={line.description}
                    onChange={(event) => {
                      const next = [...coLines];
                      next[index] = { ...line, description: event.target.value };
                      setCoLines(next);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Was"
                    value={line.previousAmount || ""}
                    onChange={(event) => {
                      const next = [...coLines];
                      next[index] = {
                        ...line,
                        previousAmount: parseFloat(event.target.value) || 0,
                      };
                      setCoLines(next);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Now"
                    value={line.newAmount || ""}
                    onChange={(event) => {
                      const next = [...coLines];
                      next[index] = {
                        ...line,
                        newAmount: parseFloat(event.target.value) || 0,
                      };
                      setCoLines(next);
                    }}
                  />
                </div>
              ))}
              <button type="submit" className="btn btn-primary">
                Draft change order
              </button>
            </form>
          </div>

          {project.changeOrders.map((order) => (
            <article key={order.id} className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>
                  CO #{order.number}: {order.title}
                </h3>
                <span className={`status-pill ${order.status}`}>{order.status}</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Created {formatDateTime(order.createdAt)}
                {order.releasedAt && ` · Released ${formatDateTime(order.releasedAt)}`}
                {order.acceptedAt && ` · Accepted ${formatDateTime(order.acceptedAt)}`}
              </p>
              <p style={{ fontWeight: 700, fontSize: "1.25rem" }}>
                {order.totalDelta >= 0 ? "+" : ""}
                {formatCurrency(order.totalDelta)}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line: ChangeOrderLine) => (
                    <tr key={line.id}>
                      <td>{line.category}</td>
                      <td>{line.description}</td>
                      <td>{formatCurrency(line.previousAmount)}</td>
                      <td>{formatCurrency(line.newAmount)}</td>
                      <td>
                        {line.delta >= 0 ? "+" : ""}
                        {formatCurrency(line.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                {order.status === "draft" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      updateChangeOrderStatus(project.id, order.id, "released")
                    }
                  >
                    Release to client
                  </button>
                )}
                {order.status === "released" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        updateChangeOrderStatus(project.id, order.id, "accepted")
                      }
                    >
                      Mark accepted
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        updateChangeOrderStatus(project.id, order.id, "rejected")
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="card timeline">
          {project.timeline.map((event) => (
            <div key={event.id} className="timeline-item">
              <div className="timeline-date">{formatDateTime(event.timestamp)}</div>
              <div>
                <strong>{event.title}</strong>
                <p style={{ margin: "0.25rem 0", color: "var(--text-muted)" }}>
                  {event.description}
                </p>
                {event.amountBefore !== undefined && event.amountAfter !== undefined && (
                  <p style={{ fontSize: "0.85rem" }}>
                    {formatCurrency(event.amountBefore)} → {formatCurrency(event.amountAfter)}
                    {event.category && ` · ${event.category}`}
                  </p>
                )}
                <span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {event.type.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "analytics" && budgetStats && (
        <div>
          <div className="stat-row">
            <div className="stat">
              <div className="label">Budget revisions</div>
              <div className="value">{budgetStats.fromInitial}</div>
            </div>
            <div className="stat">
              <div className="label">Accepted COs</div>
              <div className="value">{budgetStats.acceptedChangeOrders}</div>
            </div>
            <div className="stat">
              <div className="label">Timeline events</div>
              <div className="value">{project.timeline.length}</div>
            </div>
          </div>
          <div className="card">
            <h3>Category variance from initial</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Initial</th>
                  <th>Current</th>
                  <th>Change</th>
                  <th># of COs touching</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys({ ...initialByCategory, ...categoryBreakdown }).map((category) => {
                  const initial = initialByCategory[category] ?? 0;
                  const current = categoryBreakdown[category] ?? 0;
                  const touchCount = project.changeOrders.filter((order) =>
                    order.lines.some((line) => line.category === category),
                  ).length;
                  return (
                    <tr key={category}>
                      <td>{category}</td>
                      <td>{formatCurrency(initial)}</td>
                      <td>{formatCurrency(current)}</td>
                      <td style={{ color: current - initial > 0 ? "var(--warning)" : undefined }}>
                        {current - initial >= 0 ? "+" : ""}
                        {formatCurrency(current - initial)}
                      </td>
                      <td>{touchCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionsTab({
  projectId,
  selections,
  libraryItems,
  onUpdate,
}: {
  projectId: string;
  selections: import("../types").ProjectSelection[];
  libraryItems: import("../types").LibraryItem[];
  onUpdate: (
    projectId: string,
    category: string,
    libraryItem: import("../types").LibraryItem,
    priceUsed: number,
  ) => void;
}) {
  const [changingSelectionId, setChangingSelectionId] = useState<string | null>(null);

  const changingSelection = selections.find(
    (selection) => selection.libraryItemId === changingSelectionId,
  );

  return (
    <>
      <div className="selections-grid">
        {selections.map((selection) => {
          const libraryItem = libraryItems.find(
            (item) => item.id === selection.libraryItemId,
          );

          return (
            <SelectionProductCard
              key={selection.libraryItemId}
              selection={selection}
              libraryItem={libraryItem}
              onChangeClick={() => setChangingSelectionId(selection.libraryItemId)}
            />
          );
        })}
      </div>

      {changingSelection && (
        <ChangeSelectionModal
          selection={changingSelection}
          libraryItems={libraryItems}
          onClose={() => setChangingSelectionId(null)}
          onConfirm={(item, priceUsed) => {
            onUpdate(projectId, changingSelection.category, item, priceUsed);
            setChangingSelectionId(null);
          }}
        />
      )}
    </>
  );
}
