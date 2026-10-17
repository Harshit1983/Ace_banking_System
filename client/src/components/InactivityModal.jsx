import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_THRESHOLD_MS = 14 * 60 * 1000; // 14 minutes (1 minute warning)
const STORAGE_KEY = "ace_bank_last_active";

export default function InactivityModal({ onTimeout }) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [extending, setExtending] = useState(false);
  const stayButtonRef = useRef(null);

  // Record user activity and broadcast across tabs
  const recordActivity = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
  }, []);

  // Extend session by refreshing JWT and resetting activity timestamp
  const handleStayLoggedIn = async () => {
    setExtending(true);
    try {
      const response = await api.post("/auth/refresh-session");
      if (response.data?.token) {
        localStorage.setItem("ace_bank_token", response.data.token);
      }
      recordActivity();
      setShowWarning(false);
    } catch (err) {
      console.error("Session extension failed:", err);
      // If refresh fails with 401, token is already expired
      if (err.response?.status === 401) {
        onTimeout();
      }
    } finally {
      setExtending(false);
    }
  };

  useEffect(() => {
    // Initialize activity timestamp if absent
    if (!localStorage.getItem(STORAGE_KEY)) {
      recordActivity();
    }

    // Meaningful user interaction events to reset activity timer
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    let lastThrottled = 0;

    const handleUserInteraction = () => {
      // Throttle localStorage writes to once every 2 seconds
      const now = Date.now();
      if (now - lastThrottled > 2000) {
        lastThrottled = now;
        recordActivity();
      }
    };

    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserInteraction, { passive: true })
    );

    // Cross-tab coordination: reset when another tab has activity
    const handleStorageEvent = (event) => {
      if (event.key === STORAGE_KEY) {
        setShowWarning(false);
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    // Periodic check interval every second
    const intervalId = setInterval(() => {
      const token = localStorage.getItem("ace_bank_token");
      if (!token) return;

      const lastActive = Number(localStorage.getItem(STORAGE_KEY)) || Date.now();
      const elapsed = Date.now() - lastActive;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(intervalId);
        setShowWarning(false);
        localStorage.removeItem("ace_bank_token");
        localStorage.removeItem(STORAGE_KEY);
        onTimeout();
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        const remaining = Math.max(
          0,
          Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000)
        );
        setSecondsRemaining(remaining);
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserInteraction)
      );
      window.removeEventListener("storage", handleStorageEvent);
      clearInterval(intervalId);
    };
  }, [recordActivity, onTimeout]);

  // Focus the "Stay Logged In" button when modal appears for keyboard accessibility
  useEffect(() => {
    if (showWarning && stayButtonRef.current) {
      stayButtonRef.current.focus();
    }
  }, [showWarning]);

  if (!showWarning) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
    >
      <div className="modal-dialog inactivity-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="inactivity-badge">⚠️ Security Timeout</div>
          <h3 id="inactivity-title">Session Inactivity Warning</h3>
        </div>

        <div className="modal-body inactivity-body">
          <p>
            You have been inactive for nearly 15 minutes. For your security, your ACE
            Banking session will automatically end in:
          </p>

          <div className="countdown-display" aria-live="polite">
            <span className="countdown-number">{secondsRemaining}</span>
            <span className="countdown-label">seconds</span>
          </div>

          <p className="inactivity-hint">
            Click <strong>Stay Logged In</strong> to refresh your session and continue banking, or
            allow the timer to expire to log out safely.
          </p>

          <div className="inactivity-actions">
            <button
              ref={stayButtonRef}
              type="button"
              className="submit-button primary-btn"
              onClick={handleStayLoggedIn}
              disabled={extending}
            >
              {extending ? "Refreshing session..." : "Stay Logged In"}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                localStorage.removeItem("ace_bank_token");
                localStorage.removeItem(STORAGE_KEY);
                onTimeout();
              }}
            >
              Log Out Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
