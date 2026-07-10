import type { SaveStatus } from "../hooks/useAutosave";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt: string | null;
  pendingChanges: number;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/**
 * Persistent save status indicator.
 * Shows: idle (hidden) → "Saving..." → "All changes saved at X:XX PM" → idle
 * Also shows error/offline states with appropriate messaging.
 */
export function SaveStatusIndicator({
  status,
  lastSavedAt,
  pendingChanges,
}: SaveStatusIndicatorProps) {
  if (status === "idle" && !lastSavedAt) return null;

  return (
    <div className={`save-status save-status--${status}`} role="status" aria-live="polite">
      {status === "saving" && (
        <>
          <span className="save-status-dot save-status-dot--pulse" />
          <span className="save-status-text">Saving...</span>
        </>
      )}

      {status === "saved" && (
        <>
          <span className="save-status-check">✓</span>
          <span className="save-status-text">
            All changes saved{lastSavedAt ? ` at ${formatTime(lastSavedAt)}` : ""}
          </span>
        </>
      )}

      {status === "error" && (
        <>
          <span className="save-status-error">!</span>
          <span className="save-status-text">
            Save failed — will retry automatically
          </span>
        </>
      )}

      {status === "offline" && (
        <>
          <span className="save-status-offline">○</span>
          <span className="save-status-text">
            Offline — changes saved locally ({pendingChanges} pending)
          </span>
        </>
      )}

      {status === "idle" && lastSavedAt && (
        <span className="save-status-text save-status-text--muted">
          Last saved at {formatTime(lastSavedAt)}
        </span>
      )}
    </div>
  );
}
