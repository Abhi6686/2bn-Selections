import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { vendorName } from "../store/library";

export function Layout() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          2BN Selections
          <span>{vendorName}</span>
        </div>
        <nav>
          <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} end>
            Dashboard
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Material Library
          </NavLink>
          <NavLink
            to="/projects/new"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            New Project
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-user">Signed in as {username}</p>
          <button type="button" className="btn btn-secondary btn-sm sidebar-logout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
