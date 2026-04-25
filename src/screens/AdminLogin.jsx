import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../styles/AdminLogin.css";
import DineLogo from "../assets/images/DineE.jpeg";
import { useNavigate } from "react-router-dom";

const ALLOWED_EMAIL = "minahilamir2012@gmail.com";

export default function AdminLogin() {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  // Forgot password state
  const [showForgot,        setShowForgot]        = useState(false);
  const [forgotEmail,       setForgotEmail]       = useState("");
  const [forgotLoading,     setForgotLoading]     = useState(false);
  const [forgotSuccess,     setForgotSuccess]     = useState(false);
  const [forgotError,       setForgotError]       = useState("");

  const navigate = useNavigate();

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      setError("Access denied. Unauthorized email address.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      switch (err.code) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Incorrect password. Please try again.");
          break;
        case "auth/user-not-found":
          setError("No account found with this email.");
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.");
          break;
        case "auth/network-request-failed":
          setError("Network error. Please check your connection.");
          break;
        default:
          setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess(false);

    const trimmed = forgotEmail.trim().toLowerCase();

    // Only allow the registered admin email
    if (trimmed !== ALLOWED_EMAIL) {
      setForgotError("This email is not authorized for this admin panel.");
      return;
    }

    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setForgotSuccess(true);
      setForgotError("");
    } catch (err) {
      switch (err.code) {
        case "auth/user-not-found":
          setForgotError("No Firebase account found for this email.");
          break;
        case "auth/invalid-email":
          setForgotError("Invalid email address format.");
          break;
        case "auth/network-request-failed":
          setForgotError("Network error. Check your connection.");
          break;
        case "auth/too-many-requests":
          setForgotError("Too many requests. Please wait and try again.");
          break;
        default:
          setForgotError("Failed to send reset email. Try again.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Forgot Password Modal ──────────────────────────────────────────────────
  const ForgotModal = () => (
    <div className="al-forgot-modal-overlay" onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotError(""); setForgotEmail(""); }}>
      <div className="al-forgot-modal" onClick={e => e.stopPropagation()}>

        {/* Icon */}
        <div className="al-forgot-icon-box">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C17859" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h2 className="al-forgot-title">Reset Password</h2>
        <p className="al-forgot-desc">
          Enter your admin email. We'll send a password reset link via Firebase Authentication.
        </p>

        {forgotSuccess ? (
          /* ── Success state ── */
          <div className="al-forgot-success-box">
            <div className="al-forgot-success-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="al-forgot-success-text">
              Reset link sent to <strong>{ALLOWED_EMAIL}</strong>. Check your inbox (and spam folder).
            </p>
            <button
              className="al-btn-login al-forgot-done-btn"
              onClick={() => { setShowForgot(false); setForgotSuccess(false); setForgotEmail(""); }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleForgotPassword} noValidate className="al-form">
            <div className="al-input-wrap">
              <span className="al-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input
                className="al-input-field"
                type="email"
                placeholder="Admin Email"
                value={forgotEmail}
                onChange={e => { setForgotEmail(e.target.value); setForgotError(""); }}
                required
                autoComplete="email"
              />
            </div>

            {forgotError && (
              <div className="al-error-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {forgotError}
              </div>
            )}

            <div className="al-forgot-modal-btns">
              <button
                type="button"
                className="al-forgot-cancel-btn"
                onClick={() => { setShowForgot(false); setForgotError(""); setForgotEmail(""); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="al-btn-login al-forgot-submit-btn"
                disabled={forgotLoading}
              >
                {forgotLoading ? <span className="al-spinner" /> : "Send Reset Link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="al-root">

      {/* Forgot Password Modal */}
      {showForgot && <ForgotModal />}

      <div className="al-card">

        {/* ══════ LEFT — IMAGE PANEL ══════ */}
        <div className="al-left">
          <div className="al-overlay" />
          <div className="al-circle-tl" />
          <div className="al-circle-br" />
          <div className="al-doodle-ring" />

          <div className="al-logo-area">
            <div className="al-logo-box">
              <img src={DineLogo} alt="DineEase" className="al-logo-img" />
            </div>
            <div className="al-logo-text-wrap">
              <span className="al-logo-name">DineEase</span>
              <span className="al-logo-tagline">Savour the flavour, one bite at a time</span>
            </div>
          </div>

          <div className="al-hero-images">
            <img
              className="al-hero-img al-hero-img-1"
              src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=85"
              alt="Gourmet dish"
              onError={(e) => { e.target.style.background = "#d4a574"; e.target.src = ""; }}
            />
            <img
              className="al-hero-img al-hero-img-2"
              src="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&q=85"
              alt="Fresh salad"
              onError={(e) => { e.target.style.background = "#FDF8F0"; e.target.src = ""; }}
            />
            <img
              className="al-hero-img al-hero-img-3"
              src="https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=450&q=85"
              alt="Delicious food"
              onError={(e) => { e.target.style.background = "#c8976a"; e.target.src = ""; }}
            />
          </div>

          <div className="al-left-badge">
            <span className="al-badge-dot" />
            Admin Dashboard
          </div>

          <span className="al-bolt al-bolt-1">⚡</span>
          <span className="al-bolt al-bolt-2">⚡</span>
        </div>

        {/* ══════ RIGHT — LOGIN PANEL ══════ */}
        <div className="al-right">
          <div className="al-right-bg-circle" />

          <div className="al-right-header">
            <h1 className="al-title">Welcome, Admin</h1>
            <p className="al-subtitle">
              Log in to manage subscriptions &amp; operations
            </p>
          </div>

          <form onSubmit={handleLogin} noValidate className="al-form">

            <div className="al-input-wrap">
              <span className="al-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input
                className="al-input-field"
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                required
                autoComplete="email"
              />
            </div>

            <div className="al-input-wrap">
              <span className="al-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                className="al-input-field"
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="al-eye-btn"
                onClick={() => setShowPass(!showPass)}
                aria-label="Toggle password"
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <div className="al-error-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* ── Forgot Password Link ── */}
            <div className="al-forgot-row">
              <button
                type="button"
                className="al-forgot-link"
                onClick={() => {
                  setForgotEmail(email); // pre-fill with whatever they typed
                  setForgotError("");
                  setForgotSuccess(false);
                  setShowForgot(true);
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="al-btn-login"
              disabled={loading}
            >
              {loading ? <span className="al-spinner" /> : "Log In"}
            </button>

          </form>

          <p className="al-footer-note">
            🔒 Authorized personnel only
          </p>
        </div>

      </div>
    </div>
  );
}