import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppProvider } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { ApproveChangeOrderPage } from "./pages/ApproveChangeOrderPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { MagicLinkPage } from "./pages/MagicLinkPage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectRoutePage } from "./pages/ProjectRoutePage";
import { SelectionTemplatesPage } from "./pages/SelectionTemplatesPage";
import { RoomTypesPage } from "./pages/RoomTypesPage";
import { UsersPage } from "./pages/UsersPage";


export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/magic" element={<MagicLinkPage />} />
            <Route path="/approve/co" element={<ApproveChangeOrderPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/projects/new" element={<NewProjectPage />} />
                <Route path="/projects/:projectId" element={<ProjectRoutePage />} />
                <Route path="/templates" element={<SelectionTemplatesPage />} />
                <Route path="/room-configurator" element={<RoomTypesPage />} />
                <Route path="/team" element={<UsersPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
