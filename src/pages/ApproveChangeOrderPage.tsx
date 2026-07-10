import { useRef, useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import { approveChangeOrder, verifyChangeOrder } from "../api/projects";
import { formatCurrency } from "../utils/format";

export function ApproveChangeOrderPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const changeOrderId = searchParams.get("id") ?? "";
  const signatureRef = useRef<SignatureCanvas>(null);

  // States
  const [changeOrder, setChangeOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [typedName, setTypedName] = useState("");
  const [signatureMode, setSignatureMode] = useState<"drawn" | "typed" | "both">("drawn");
  const [geoConsent, setGeoConsent] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Load change order details securely via token
  useEffect(() => {
    if (token && changeOrderId) {
      verifyChangeOrder({ token, changeOrderId })
        .then((res) => {
          setChangeOrder(res.changeOrder);
          setLoading(false);
        })
        .catch(() => {
          setFetchError("This sign-in or approval link is invalid or has expired.");
          setLoading(false);
        });
    } else {
      setFetchError("Missing secure token or change order reference.");
      setLoading(false);
    }
  }, [token, changeOrderId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !changeOrderId) {
      setStatusMessage("Invalid approval link.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    let geoLatitude: number | undefined;
    let geoLongitude: number | undefined;

    if (geoConsent && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        geoLatitude = position.coords.latitude;
        geoLongitude = position.coords.longitude;
      } catch {
        // GPS optional
      }
    }

    const signatureImageBase64 =
      signatureMode !== "typed" ? signatureRef.current?.toDataURL("image/png") : undefined;

    try {
      const result = await approveChangeOrder({
        token,
        changeOrderId,
        signatureType: signatureMode,
        typedName: typedName || undefined,
        signatureImageBase64,
        geoLatitude,
        geoLongitude,
        geoConsent,
      });

      setIsComplete(true);
      setStatusMessage(
        result.status === "approved"
          ? "Change order approved. Thank you!"
          : `Signature recorded (${result.approvalCount} of ${result.requiredApprovals} spouses approved).`,
      );
    } catch {
      setStatusMessage("Unable to submit approval. The link may have expired.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="save-status-dot" style={{ animation: "pulse 1s infinite alternate", width: 24, height: 24, background: "var(--accent)", margin: "0 auto 16px" }} />
          <p>Loading change order details...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-brand luxury-logo-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div className="luxury-logo-transparent w-24 h-12 flex items-center justify-center" style={{ marginBottom: "8px" }}>
              <img src="/logo_transparent.png" alt="2bn Selections" className="w-full h-full object-contain relative z-10" />
            </div>
            <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent" style={{ fontSize: "1.65rem", margin: 0, fontWeight: "bold" }}>2bn Selections</h1>
            <p style={{ margin: 0 }}>Verification Error</p>
          </div>
          <p className="login-subtitle" style={{ color: "var(--danger)" }}>{fetchError}</p>
          <a href="/" className="btn btn-secondary btn-sm" style={{ marginTop: 12, display: "inline-block" }}>
            Return to Selections
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ width: "min(640px, 100%)", padding: "2.5rem 2rem" }}>
        <div className="login-brand luxury-logo-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div className="luxury-logo-transparent w-24 h-12 flex items-center justify-center" style={{ marginBottom: "8px" }}>
            <img src="/logo_transparent.png" alt="2bn Selections" className="w-full h-full object-contain relative z-10" />
          </div>
          <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent" style={{ fontSize: "1.65rem", margin: 0, fontWeight: "bold" }}>2bn Selections</h1>
          <p style={{ margin: 0 }}>Change Order Approval</p>
        </div>

        {isComplete ? (
          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <div style={{ width: 48, height: 48, background: "#dcfce7", color: "var(--success)", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", margin: "0 auto 16px" }}>
              ✓
            </div>
            <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Approval Submitted</h2>
            <p className="login-subtitle" style={{ margin: "0 0 1.5rem" }}>{statusMessage}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              The project budget has been updated and a stamped PDF specification is archived. You can close this tab now.
            </p>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p className="login-subtitle" style={{ margin: "1rem 0" }}>
              Please review the adjustment specifications below and sign to authorize this budget change order.
            </p>

            {/* Change Order Detailed Spec Display */}
            <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem" }}>{changeOrder.projectName}</h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>CO #{changeOrder.number} — {changeOrder.title}</span>
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: changeOrder.totalDelta > 0 ? "var(--warning)" : "var(--success)" }}>
                  {changeOrder.totalDelta >= 0 ? "+" : ""}{formatCurrency(changeOrder.totalDelta)}
                </div>
              </div>

              {changeOrder.notes && (
                <p style={{ margin: "0.75rem 0", fontSize: "0.85rem", background: "var(--bg)", padding: "0.5rem 0.75rem", borderRadius: 6, color: "var(--text-muted)" }}>
                  <strong>Notes:</strong> {changeOrder.notes}
                </p>
              )}

              <table className="table" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Swap Details</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {changeOrder.lines.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td>{line.category.split(" - ").slice(-1)[0]}</td>
                      <td>{line.description}</td>
                      <td style={{ color: line.delta > 0 ? "var(--warning)" : "var(--success)", fontWeight: 600 }}>
                        {line.delta >= 0 ? "+" : ""}{formatCurrency(line.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {changeOrder.requiredApprovals > 1 && (
                <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  👥 Note: Dual spouse approval mode is active. Signed: {changeOrder.approvalCount} of {changeOrder.requiredApprovals}.
                </div>
              )}
            </div>

            {/* Legal Name */}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="typedName">Full Legal Name</label>
              <input
                id="typedName"
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                placeholder="e.g. John H. Doe"
                required
              />
            </div>

            {/* Signature Method */}
            <div className="field" style={{ margin: 0 }}>
              <label>Authorization Method</label>
              <select
                value={signatureMode}
                onChange={(event) =>
                  setSignatureMode(event.target.value as "drawn" | "typed" | "both")
                }
              >
                <option value="drawn">Draw Signature (Canvas)</option>
                <option value="typed">Type Name only (Digital Seal)</option>
                <option value="both">Draw + Type Name</option>
              </select>
            </div>

            {/* Drawing Canvas */}
            {signatureMode !== "typed" && (
              <div className="field" style={{ margin: 0 }}>
                <label>Draw Signature</label>
                <div className="signature-canvas-container">
                  <SignatureCanvas
                    ref={signatureRef}
                    penColor="#1C1C1C"
                    canvasProps={{ width: 540, height: 160, className: "signature-canvas" }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: "flex-end", marginTop: 8 }}
                  onClick={() => signatureRef.current?.clear()}
                >
                  Clear Pad
                </button>
              </div>
            )}

            {/* Cursive Typed Preview */}
            {signatureMode !== "drawn" && typedName && (
              <div style={{ padding: "1rem", border: "1px dashed var(--accent)", borderRadius: "var(--radius-sm)", background: "var(--bg)", textAlign: "center" }}>
                <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: "2rem", color: "var(--accent-hover)", fontStyle: "italic" }}>
                  {typedName}
                </span>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>Electronic Seal Signature</div>
              </div>
            )}

            {/* Geolocation Log */}
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8, margin: 0, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={geoConsent}
                onChange={(event) => setGeoConsent(event.target.checked)}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Include approximate device location in audit trail</span>
            </label>

            {statusMessage && <p className="login-error">{statusMessage}</p>}

            <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting} style={{ marginTop: 12 }}>
              {isSubmitting ? "Recording signature..." : "Authorize Change Order"}
            </button>

            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", margin: "8px 0 0", lineHeight: 1.4 }}>
              IP address recorded for security audit. Electronically signing constitutes legal authorization of selections adjustment terms.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
