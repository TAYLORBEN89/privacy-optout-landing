import { useEffect, useState } from "react";
import { authErrorMessage, stripAuthError } from "../authError";

export function AuthErrorNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("auth_error");
    if (code === null) return;
    setMessage(authErrorMessage(code));
    const next = stripAuthError(window.location.href);
    window.history.replaceState({}, "", next);
  }, []);

  if (!message) return null;
  return (
    <p className="panel" role="alert">
      {message}
    </p>
  );
}
