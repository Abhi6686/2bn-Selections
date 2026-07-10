import { isApiMode } from "../config/api";
import { ApiProjectDetailPage } from "./ApiProjectDetailPage";
import { ProjectDetailPage } from "./ProjectDetailPage";

export function ProjectRoutePage() {
  if (isApiMode) {
    return <ApiProjectDetailPage />;
  }
  return <ProjectDetailPage />;
}
