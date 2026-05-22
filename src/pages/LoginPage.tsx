import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { vendorName } from "../store/library";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    const success = login(username, password);
    if (success) {
      navigate("/", { replace: true });
      return;
    }
    setErrorMessage("Invalid username or password. Please try again.");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>2BN Selections</h1>
          <p>{vendorName}</p>
        </div>

        <p className="login-subtitle">Sign in to manage projects, selections, and budgets.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">User ID</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your user ID"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {errorMessage && <p className="login-error">{errorMessage}</p>}

          <button type="submit" className="btn btn-primary btn-lg login-submit">
            Sign in
          </button>
        </form>

        <p className="login-footer">Authorized users only · 2BN Project Selections</p>
      </div>
    </div>
  );
}
