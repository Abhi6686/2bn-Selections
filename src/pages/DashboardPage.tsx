import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { ArrowUpRight, ArrowDownRight, FolderOpen, DollarSign, Layers, CheckSquare, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { useProjects, useRecycleBin, useDeleteProject, useRestoreProject } from "../api/hooks";
import { isApiMode } from "../config/api";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDateTime } from "../utils/format";


export function DashboardPage() {
  const { state, setActiveProjectId, resetDemoData } = useApp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const recycleBinQuery = useRecycleBin();
  const deleteProjectMutation = useDeleteProject();
  const restoreProjectMutation = useRestoreProject();

  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [deleteConfirmProjId, setDeleteConfirmProjId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteTypedText, setDeleteTypedText] = useState("");
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  const activeProjects = isApiMode
    ? (projectsQuery.data ?? [])
    : state.projects;

  const recycledProjects = isApiMode
    ? (recycleBinQuery.data ?? [])
    : [];

  const projects = showRecycleBin ? recycledProjects : activeProjects;

  useEffect(() => {
    if (role === "end_user" && activeProjects.length === 1) {
      const singleProj = activeProjects[0];
      setActiveProjectId(singleProj.id);
      navigate(`/projects/${singleProj.id}`, { replace: true });
    }
  }, [role, activeProjects, navigate, setActiveProjectId]);

  if (isApiMode && (projectsQuery.isLoading || recycleBinQuery.isLoading)) {
    return (
      <div className="flex items-center justify-center py-20 bg-background">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  const totalBudget = activeProjects.reduce((sum, p) => sum + (p.currentBudget || p.initialBudget || 0), 0);

  const handleOpenDeleteConfirm = (e: React.MouseEvent, projId: string, projName: string, permanent = false) => {
    e.stopPropagation();
    setDeleteConfirmProjId(projId);
    setDeleteConfirmName(projName);
    setIsPermanentDelete(permanent);
    setDeleteTypedText("");
  };

  const handleConfirmDelete = async () => {
    if (deleteTypedText !== "CONFIRM") {
      alert("Please type CONFIRM in capital letters to proceed.");
      return;
    }
    if (!deleteConfirmProjId) return;

    try {
      await deleteProjectMutation.mutateAsync({
        projectId: deleteConfirmProjId,
        permanent: isPermanentDelete,
      });
      setDeleteConfirmProjId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  const handleRestore = async (e: React.MouseEvent, projId: string) => {
    e.stopPropagation();
    try {
      await restoreProjectMutation.mutateAsync(projId);
    } catch (err: any) {
      alert(err.message || "Failed to restore project");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section with modern design */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-secondary">Builder Console</span>
          <h1 className="text-4xl font-extrabold font-serif tracking-tight mt-1 text-foreground">
            {showRecycleBin ? "Recycle Bin" : "Project Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {showRecycleBin 
              ? "View, restore, or permanently delete archived projects." 
              : "Track client selections, budgets, and change orders from start to finish."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(role === "admin" || role === "project_manager") && (
            <Button
              variant={showRecycleBin ? "premium" : "outline"}
              size="sm"
              onClick={() => setShowRecycleBin(!showRecycleBin)}
            >
              {showRecycleBin ? "Show Active Projects" : "♻️ Show Recycle Bin"}
            </Button>
          )}
          {!isApiMode && (
            <Button variant="outline" size="sm" onClick={resetDemoData}>
              Reset Demo Data
            </Button>
          )}
          <Button variant="premium" size="lg" onClick={() => navigate("/projects/new")}>
            + New Project
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {!showRecycleBin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md border-l-4 border-l-primary relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Projects</p>
                <p className="text-3xl font-extrabold text-foreground">{activeProjects.length}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Layers size={22} />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md border-l-4 border-l-secondary relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Combined Budget</p>
                <p className="text-3xl font-extrabold text-foreground">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="p-3 bg-secondary/15 rounded-xl text-secondary">
                <DollarSign size={22} />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md border-l-4 border-l-accent relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Projects</p>
                <p className="text-3xl font-extrabold text-foreground">{activeProjects.length > 0 ? activeProjects.length : 0}</p>
              </div>
              <div className="p-3 bg-accent/15 rounded-xl text-accent-foreground">
                <CheckSquare size={22} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Projects List Section */}
      {projects.length === 0 ? (
        <Card className="border-dashed border-2 py-16 px-8 bg-card/50">
          <CardContent className="p-0">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-4 rounded-2xl bg-muted text-muted-foreground">
                <FolderOpen size={40} />
              </div>
              <h2 className="text-xl font-bold font-serif">
                {showRecycleBin ? "Recycle Bin is empty" : "No projects yet"}
              </h2>
              <p className="text-muted-foreground max-w-sm text-sm">
                {showRecycleBin
                  ? "Deleted projects will appear here for recovery."
                  : "Create your first build project and guide your clients through selecting materials."}
              </p>
              {!showRecycleBin && (
                <Button variant="premium" size="lg" onClick={() => navigate("/projects/new")} className="mt-2">
                  + Launch Project Wizard
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const budgetDelta = (project.currentBudget || 0) - (project.initialBudget || 0);
            const changeOrderCount = 0;
            const isOverBudget = budgetDelta > 0;
            const isUnderBudget = budgetDelta < 0;

            return (
              <Card
                key={project.id}
                className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer border border-border bg-card flex flex-col justify-between relative overflow-hidden"
                onClick={() => {
                  if (showRecycleBin) return;
                  setActiveProjectId(project.id);
                  navigate(`/projects/${project.id}`);
                }}
              >
                {/* Delete / Action overlay icons */}
                {(role === "admin" || role === "project_manager") && (
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    {showRecycleBin ? (
                      <>
                        <button
                          onClick={(e) => handleRestore(e, project.id)}
                          className="p-1.5 rounded-lg bg-background/80 hover:bg-emerald-600 hover:text-white border border-border text-muted-foreground transition-all"
                          title="Restore Project"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={(e) => handleOpenDeleteConfirm(e, project.id, project.name, true)}
                          className="p-1.5 rounded-lg bg-background/80 hover:bg-destructive hover:text-white border border-border text-muted-foreground transition-all"
                          title="Permanently Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => handleOpenDeleteConfirm(e, project.id, project.name, false)}
                        className="p-1.5 rounded-lg bg-background/80 hover:bg-destructive hover:text-white border border-border text-muted-foreground transition-all"
                        title="Delete Project (Recycle)"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}

                <CardHeader className="p-6 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-2 pr-12">
                    <CardTitle className="text-xl font-bold font-serif text-foreground truncate max-w-[90%]">
                      {project.name}
                    </CardTitle>
                  </div>
                  {project.clientName && (
                    <p className="text-xs font-semibold text-muted-foreground">{project.clientName}</p>
                  )}
                </CardHeader>

                <CardContent className="px-6 py-2">
                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/60">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Budget</p>
                      <p className="text-base font-bold mt-0.5 text-foreground">{formatCurrency(project.currentBudget)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">vs Initial Budget</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {budgetDelta !== 0 && (
                          isOverBudget
                            ? <ArrowUpRight size={14} className="text-destructive" />
                            : <ArrowDownRight size={14} className="text-emerald-600" />
                        )}
                        <p className={`text-base font-bold ${isOverBudget ? "text-destructive" : isUnderBudget ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {budgetDelta >= 0 ? "+" : ""}{formatCurrency(budgetDelta)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="px-6 py-4 flex justify-between items-center bg-muted/40 rounded-b-2xl border-t border-border/40 text-[10px] font-semibold text-muted-foreground">
                  <span>
                    {changeOrderCount > 0 ? `${changeOrderCount} Change Orders` : "No Change Orders"}
                  </span>
                  <span>
                    Updated {formatDateTime(project.updatedAt)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirmProjId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold font-serif">
                {isPermanentDelete ? "Permanent Deletion" : "Confirm Project Deletion"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isPermanentDelete 
                ? `Are you sure you want to permanently delete "${deleteConfirmName}"? This action CANNOT be undone and all selections will be lost.` 
                : `Are you sure you want to move "${deleteConfirmName}" to the Recycle Bin? You can restore it later.`}
            </p>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Type <span className="text-foreground font-mono font-extrabold bg-muted px-1.5 py-0.5 rounded border border-border">CONFIRM</span> in CAPITAL letters:
              </label>
              <input
                type="text"
                placeholder="CONFIRM"
                value={deleteTypedText}
                onChange={(e) => setDeleteTypedText(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-destructive/30"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmProjId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteTypedText !== "CONFIRM"}
              >
                {isPermanentDelete ? "Delete Permanently" : "Move to Recycle Bin"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

