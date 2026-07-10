import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasPassword: boolean;
}

export function PasswordModal({ isOpen, onClose, hasPassword }: PasswordModalProps) {
  const { configurePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await configurePassword(password);
      toast.success(
        hasPassword
          ? "Password reset successfully!"
          : "Password configured successfully! You can now log in using your email and password."
      );
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to configure password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontFamily: "Playfair Display, serif" }}>
            {hasPassword ? "Change Account Password" : "Set Account Password"}
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: "0.25rem 0.6rem" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>
              {hasPassword
                ? "Enter your new password below to change the password for your account."
                : "Set a password for your account so you can log in directly using your email and password next time."}
            </p>

            <div className="field" style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="newPassword" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                style={{ padding: "0.6rem 0.85rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
              />
            </div>

            <div className="field" style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="confirmPassword" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                style={{ padding: "0.6rem 0.85rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
              />
            </div>

            {error && (
              <p className="login-error" style={{ margin: 0, color: "var(--danger)", fontSize: "0.85rem" }}>
                ⚠️ {error}
              </p>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : hasPassword ? "Update Password" : "Save Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
