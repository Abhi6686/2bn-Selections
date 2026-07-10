import type { Types } from "mongoose";
import { BudgetSnapshotModel } from "../models/BudgetSnapshot.js";
import { ProjectSelectionModel } from "../models/ProjectSelection.js";
import { TimelineEventModel } from "../models/TimelineEvent.js";

export async function recalculateProjectBudget(projectId: Types.ObjectId): Promise<{
  total: number;
  byCategory: Record<string, number>;
}> {
  const selections = await ProjectSelectionModel.find({
    projectId,
    state: "confirmed",
    priceUsed: { $exists: true },
  });

  const byCategory: Record<string, number> = {};
  let total = 0;

  for (const selection of selections) {
    const amount = (selection.priceUsed ?? 0) * (selection.quantity ?? 1);
    total += amount;
    byCategory[selection.categoryKey] = (byCategory[selection.categoryKey] ?? 0) + amount;
  }

  return { total, byCategory };
}

export async function recordBudgetSnapshot(input: {
  projectId: Types.ObjectId;
  label: string;
  total: number;
  byCategory: Record<string, number>;
  source: "initial" | "change_order" | "manual" | "selection_change";
  changeOrderId?: Types.ObjectId;
}): Promise<void> {
  await BudgetSnapshotModel.create({
    projectId: input.projectId,
    label: input.label,
    total: input.total,
    byCategory: input.byCategory,
    source: input.source,
    changeOrderId: input.changeOrderId,
    recordedAt: new Date(),
  });
}

export async function appendTimeline(input: {
  projectId: Types.ObjectId;
  type: string;
  title: string;
  description?: string;
  amountBefore?: number;
  amountAfter?: number;
  category?: string;
  changeOrderId?: Types.ObjectId;
  actorId?: Types.ObjectId;
}): Promise<void> {
  await TimelineEventModel.create(input);
}

export async function syncProjectBudgetFromSelections(
  project: {
    _id: Types.ObjectId;
    currentBudget: number;
    initialBudget: number;
    save(): Promise<unknown>;
  },
  label: string,
) {
  const { total, byCategory } = await recalculateProjectBudget(project._id);
  const previousBudget = project.currentBudget;
  project.currentBudget = total;

  if (project.initialBudget === 0 && total > 0) {
    project.initialBudget = total;
  }

  await project.save();

  if (previousBudget !== total) {
    await recordBudgetSnapshot({
      projectId: project._id,
      label,
      total,
      byCategory,
      source: "selection_change",
    });
  }

  return project;
}
