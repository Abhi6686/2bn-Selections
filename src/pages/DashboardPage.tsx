import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatDateTime } from "../utils/format";
import { getProjectLevelSummary } from "../utils/project";

export function DashboardPage() {
  const { state, setActiveProjectId, resetDemoData } = useApp();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Project Dashboard</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Track selections, budgets, and change orders from start to finish.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/projects/new" className="btn btn-primary">
            + New Project
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetDemoData}>
            Reset demo
          </button>
        </div>
      </div>

      {state.projects.length === 0 ? (
        <div className="card empty-state">
          <h2>No projects yet</h2>
          <p>Create your first project and walk through categories by budget level.</p>
          <Link to="/projects/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            Start project wizard
          </Link>
        </div>
      ) : (
        <div className="card-grid">
          {state.projects.map((project) => {
            const budgetDelta = project.currentBudget - project.initialBudget;
            const pendingOrders = project.changeOrders.filter(
              (order) => order.status === "released" || order.status === "draft",
            ).length;

            return (
              <article key={project.id} className="card">
                <h3>{project.name}</h3>
                <p style={{ color: "var(--text-muted)", margin: "0 0 1rem" }}>
                  {project.clientName} · {getProjectLevelSummary(project)}
                </p>
                <div className="stat-row" style={{ marginBottom: "0.75rem" }}>
                  <div className="stat" style={{ padding: "0.75rem" }}>
                    <div className="label">Current budget</div>
                    <div className="value" style={{ fontSize: "1.1rem" }}>
                      {formatCurrency(project.currentBudget)}
                    </div>
                  </div>
                  <div className="stat" style={{ padding: "0.75rem" }}>
                    <div className="label">vs initial</div>
                    <div
                      className="value"
                      style={{
                        fontSize: "1.1rem",
                        color: budgetDelta > 0 ? "var(--warning)" : budgetDelta < 0 ? "var(--success)" : undefined,
                      }}
                    >
                      {budgetDelta >= 0 ? "+" : ""}
                      {formatCurrency(budgetDelta)}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {project.changeOrders.length} change orders · {pendingOrders} open · Updated{" "}
                  {formatDateTime(project.updatedAt)}
                </p>
                <Link
                  to={`/projects/${project.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: "1rem", display: "inline-block" }}
                  onClick={() => setActiveProjectId(project.id)}
                >
                  Open project
                </Link>
              </article>
            );
          })}
        </div>
      )}

      <section style={{ marginTop: "2.5rem" }}>
        <h2>Industry best practices (built into this prototype)</h2>
        <div className="card" style={{ marginTop: "1rem" }}>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-muted)" }}>
            <li>Versioned budget snapshots with full audit timeline</li>
            <li>Change order workflow: Draft → Released → Accepted / Rejected</li>
            <li>$500 minimum change order threshold (per spec sheets)</li>
            <li>Category-level budget breakdown and variance from initial allowance</li>
            <li>Alerts when selection changes exceed CO threshold without formal CO</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
