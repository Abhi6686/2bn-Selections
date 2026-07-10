import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function MagicLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithMagicLink, isAuthenticated } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(true);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setErrorMessage("Missing sign-in token.");
      setIsVerifying(false);
      return;
    }

    loginWithMagicLink(token)
      .then(() => navigate("/", { replace: true }))
      .catch(() => setErrorMessage("This sign-in link is invalid or has expired."))
      .finally(() => setIsVerifying(false));
  }, [token, loginWithMagicLink, navigate]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Signing you in…</h1>
        {isVerifying && <p>Please wait while we verify your link.</p>}
        {errorMessage && <p className="login-error">{errorMessage}</p>}
      </div>
    </div>
  );
}
