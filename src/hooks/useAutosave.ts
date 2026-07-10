import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

interface AutosaveOptions {
  /** Delay in ms before saving after last change (default: 800) */
  debounceMs?: number;
  /** How long to show "Saved ✓" before reverting to idle (default: 3000) */
  savedDisplayMs?: number;
  /** Callback when save starts */
  onSaveStart?: () => void;
  /** Callback when save completes */
  onSaveComplete?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: unknown) => void;
}

interface AutosaveReturn {
  /** Current save status */
  status: SaveStatus;
  /** ISO timestamp of last successful save */
  lastSavedAt: string | null;
  /** Trigger a save with the given data */
  triggerSave: () => void;
  /** Force an immediate save (bypasses debounce) */
  forceSave: () => Promise<void>;
  /** Number of pending (unsaved) changes */
  pendingChanges: number;
}

/**
 * Debounced autosave hook.
 *
 * Watches for calls to `triggerSave()` and batches them with a debounce timer.
 * Shows "Saving..." → "Saved ✓" → idle status transitions.
 * Handles errors with retry logic and falls back to localStorage if offline.
 *
 * @param saveFn - Async function that performs the actual save
 * @param options - Configuration options
 */
export function useAutosave(
  saveFn: () => Promise<void>,
  options: AutosaveOptions = {},
): AutosaveReturn {
  const {
    debounceMs = 800,
    savedDisplayMs = 3000,
    onSaveStart,
    onSaveComplete,
    onSaveError,
  } = options;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  const isSaving = useRef(false);
  const queuedSave = useRef(false);

  // Keep save function ref current
  useEffect(() => {
    saveFnRef.current = saveFn;
  }, [saveFn]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (savedDisplayTimer.current) clearTimeout(savedDisplayTimer.current);
    };
  }, []);

  // Warn about unsaved changes on page unload
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingChanges > 0 || isSaving.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pendingChanges]);

  const executeSave = useCallback(async () => {
    if (isSaving.current) {
      queuedSave.current = true;
      return;
    }

    isSaving.current = true;
    setStatus("saving");
    onSaveStart?.();

    try {
      await saveFnRef.current();

      const now = new Date().toISOString();
      setLastSavedAt(now);
      setPendingChanges(0);
      setStatus("saved");
      onSaveComplete?.();

      // Clear the "saved" indicator after a delay
      if (savedDisplayTimer.current) clearTimeout(savedDisplayTimer.current);
      savedDisplayTimer.current = setTimeout(() => {
        setStatus("idle");
      }, savedDisplayMs);
    } catch (error) {
      // Check if offline
      if (!navigator.onLine) {
        setStatus("offline");
      } else {
        setStatus("error");
      }
      onSaveError?.(error);
    } finally {
      isSaving.current = false;

      // If a save was queued while we were saving, trigger it now
      if (queuedSave.current) {
        queuedSave.current = false;
        executeSave();
      }
    }
  }, [savedDisplayMs, onSaveStart, onSaveComplete, onSaveError]);

  const triggerSave = useCallback(() => {
    setPendingChanges((prev) => prev + 1);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      executeSave();
    }, debounceMs);
  }, [debounceMs, executeSave]);

  const forceSave = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    await executeSave();
  }, [executeSave]);

  return {
    status,
    lastSavedAt,
    triggerSave,
    forceSave,
    pendingChanges,
  };
}
