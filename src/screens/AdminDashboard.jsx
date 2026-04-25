import React, { useEffect, useState } from "react";
import { database, auth } from "../firebase";
import { ref, onValue, update, remove, set } from "firebase/database";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../styles/AdminDashboard.css";
import DineLogo from "../assets/images/DineE.jpeg";

export default function AdminDashboard() {
  const [restaurants, setRestaurants]           = useState([]);
  const [notifications, setNotifications]       = useState([]);
  const [activeTab, setActiveTab]               = useState("clients");
  const [search, setSearch]                     = useState("");
  const [filterStatus, setFilterStatus]         = useState("All");
  const [showNotifPanel, setShowNotifPanel]     = useState(false);
  const [rejectModal, setRejectModal]           = useState(null);
  const [deactivateModal, setDeactivateModal]   = useState(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const navigate = useNavigate();

  // ── 1. Load restaurants & auto-check expiry ───────────────────────────────
  // AUTO-EXPIRY RULE:
  //   Sirf paymentStatus = "Expired" set karo
  //   status ko BILKUL mat chho — chahe "Active" ho ya "Deactivated"
  //   Kyunki:
  //     Deactivated + Expired → Expired dikhao (paymentStatus check pehle)
  //     Deactivated only      → Deactivated by Admin
  //     Active + Expired      → Expired
  //     Active + Valid        → Dashboard
  useEffect(() => {
    const restaurantsRef = ref(database, "restaurants");
    const unsub = onValue(restaurantsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        const now = new Date();

        list.forEach((r) => {
          if (
            r.licenseExpiresAt &&
            new Date(r.licenseExpiresAt) < now &&
            r.paymentStatus !== "Expired"
          ) {
            // ONLY paymentStatus set karo — status BILKUL mat badlo
            update(ref(database, `restaurants/${r.id}`), {
              paymentStatus:     "Expired",
              updatedAt:         now.toISOString(),
              deactivatedReason: "License expired",
            });
          }
        });

        setRestaurants(list);
      } else {
        setRestaurants([]);
      }
    });

    return () => unsub();
  }, []);

  // ── 2. Load admin notifications ───────────────────────────────────────────
  useEffect(() => {
    const notifRef = ref(database, "adminNotifications");
    const unsub = onValue(notifRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setNotifications(list);
      } else {
        setNotifications([]);
      }
    });
    return () => unsub();
  }, []);

  // ── ACTIVATE ──────────────────────────────────────────────────────────────
  // ACTIVATE RULE:
  //   Agar paymentStatus === "Expired":
  //     → sirf status = "Active" karo, paymentStatus "Expired" rehne do
  //     → Restaurant ko naya plan lena hoga login par
  //   Agar paymentStatus !== "Expired" (sirf Deactivated by admin):
  //     → status = "Active" + paymentStatus = "Paid" (full activate)
  const handleActivate = (id) => {
    const restaurant = restaurants.find((r) => r.id === id);

    if (restaurant?.paymentStatus === "Expired") {
      // Expired account — only unblock, don't reset paymentStatus
      update(ref(database, `restaurants/${id}`), {
        status:            "Active",
        deactivatedReason: null,
        updatedAt:         new Date().toISOString(),
      });
    } else {
      // Admin-deactivated (not expired) — full activate
      update(ref(database, `restaurants/${id}`), {
        status:             "Active",
        paymentStatus:      "Paid",
        deactivatedReason:  null,
        updatedAt:          new Date().toISOString(),
        licenseActivatedAt: new Date().toISOString(),
      });
    }
  };

  // ── DEACTIVATE with reason ────────────────────────────────────────────────
  // paymentStatus intentionally NOT changed
  // Login check: paymentStatus === "Expired" pehle → Expired message
  //              status === "Deactivated" baad    → Deactivated by Admin
  const handleDeactivateConfirm = async () => {
    if (!deactivateModal) return;
    const { id, email, name } = deactivateModal;
    const reason = deactivateReason || "Deactivated by admin";
    const now = new Date().toISOString();

    await update(ref(database, `restaurants/${id}`), {
      status:            "Deactivated",
      updatedAt:         now,
      deactivatedReason: reason,
    });

    if (email) {
      const blacklistKey = email.replace(/\./g, "_").replace(/@/g, "_at_");
      await set(ref(database, `blacklistedEmails/${blacklistKey}`), {
        email,
        reason,
        blacklistedAt:  now,
        restaurantName: name || "",
      });
    }

    setDeactivateModal(null);
    setDeactivateReason("");
  };

  // ── REJECT & DELETE ───────────────────────────────────────────────────────
  const handleReject = async (id) => {
    const res = restaurants.find(r => r.id === id);
    const now = new Date().toISOString();

    if (res?.email) {
      const blacklistKey = res.email.replace(/\./g, "_").replace(/@/g, "_at_");
      await set(ref(database, `blacklistedEmails/${blacklistKey}`), {
        email:          res.email,
        reason:         "Rejected by admin — restaurant not verified",
        blacklistedAt:  now,
        restaurantName: res.restaurantName || "",
      });
    }

    await remove(ref(database, `restaurants/${id}`));
    setRejectModal(null);
  };

  const openInGoogleMaps = (res) => {
    const query = encodeURIComponent(
      `${res.restaurantName || ""} ${res.address || ""} ${res.area || ""} ${res.city || ""} Pakistan`
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const callRestaurant = (phone) => {
    window.open(`tel:${phone}`, "_self");
  };

  const markAllRead = () => {
    notifications.forEach((n) => {
      if (!n.read) update(ref(database, `adminNotifications/${n.id}`), { read: true });
    });
  };

  const clearNotif = (notifId) => {
    remove(ref(database, `adminNotifications/${notifId}`));
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const total       = restaurants.length;
  const active      = restaurants.filter((r) => r.status === "Active" && r.paymentStatus !== "Expired").length;
  //const deactivated = restaurants.filter((r) => r.status === "Deactivated" && r.paymentStatus !== "Expired").length;
  const expired     = restaurants.filter((r) => r.paymentStatus === "Expired").length;
  const pending     = restaurants.filter((r) => r.status === "Pending" || !r.status).length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = restaurants.filter((r) => {
    const matchSearch =
      (r.restaurantName || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "All"
        ? true
        : filterStatus === "Expired"
        ? r.paymentStatus === "Expired"
        : filterStatus === "Deactivated"
        ? r.status === "Deactivated" && r.paymentStatus !== "Expired"
        : r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const planCounts = restaurants.reduce((acc, r) => {
    const plan = r.plan || "Free";
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {});

  const getExpiryLabel = (r) => {
    if (!r.licenseExpiresAt) return "—";
    const exp  = new Date(r.licenseExpiresAt);
    const now  = new Date();
    const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diff < 0)  return <span className="db-expiry-expired">Expired</span>;
    if (diff <= 3) return <span className="db-expiry-soon">Expires in {diff}d</span>;
    return <span className="db-expiry-ok">{exp.toLocaleDateString("en-US", { day:"numeric", month:"short", year:"numeric" })}</span>;
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  // PRIORITY (same as login check):
  //   1. paymentStatus === "Expired"                            → Expired
  //   2. status === "Deactivated" (paymentStatus !== "Expired") → Deactivated by Admin
  //   3. status === "Active"                                    → Active
  //   4. else                                                   → Pending
  const getStatusBadge = (res) => {
    if (res.paymentStatus === "Expired") {
      return (
        <span className="db-status db-status-expired">
          <span className="db-status-dot" />
          ⏰ Expired
        </span>
      );
    }
    if (res.status === "Deactivated") {
      return (
        <span className="db-status db-status-deactivated">
          <span className="db-status-dot" />
          🔒 Deactivated by Admin
        </span>
      );
    }
    if (res.status === "Active") {
      return (
        <span className="db-status db-status-active">
          <span className="db-status-dot" />
          Active
          {res.paymentStatus === "Paid" && <span className="db-paid-tag">✓ Paid</span>}
        </span>
      );
    }
    return (
      <span className="db-status db-status-pending">
        <span className="db-status-dot" />
        {res.status || "Pending"}
        {res.paymentStatus === "Paid" && <span className="db-paid-tag">✓ Paid</span>}
      </span>
    );
  };

  const DEACTIVATE_REASONS = [
    "Restaurant not found on Google Maps",
    "Subscription expired",
    "Payment not received / invalid",
    "Fake or fraudulent registration",
    "Duplicate registration",
    "Violation of terms of service",
  ];

  return (
    <div className="db-root">

      {/* ══════ REJECT CONFIRM MODAL ══════ */}
      {rejectModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(42,20,8,0.55)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000
        }}>
          <div style={{
            background:"#fff", borderRadius:18, padding:32, maxWidth:420, width:"90%",
            boxShadow:"0 16px 48px rgba(42,20,8,0.18)"
          }}>
            <div style={{ fontSize:32, marginBottom:12, textAlign:"center" }}>⚠️</div>
            <h3 style={{ fontSize:17, fontWeight:800, color:"#2A1408", marginBottom:8, textAlign:"center" }}>
              Reject & Delete Restaurant?
            </h3>
            <p style={{ fontSize:13, color:"#7A5040", textAlign:"center", marginBottom:16, lineHeight:1.6 }}>
              <strong>"{rejectModal.name}"</strong> will be permanently deleted from DineEase.
              This action cannot be undone.
            </p>
            <div style={{
              background:"#FEEAEA", borderRadius:10, padding:12, marginBottom:20,
              fontSize:12, color:"#E74C3C", fontWeight:600, lineHeight:1.6
            }}>
              🚫 The email <strong>{rejectModal.email}</strong> will be blacklisted and cannot be used to register again.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setRejectModal(null)} style={{
                flex:1, padding:"11px 0", borderRadius:10, border:"1px solid #E8D5C8",
                background:"#FAF4EF", color:"#7A5040", fontWeight:700, fontSize:13, cursor:"pointer"
              }}>Cancel</button>
              <button onClick={() => handleReject(rejectModal.id)} style={{
                flex:1, padding:"11px 0", borderRadius:10, border:"none",
                background:"#E74C3C", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer"
              }}>Yes, Reject & Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ DEACTIVATE WITH REASON MODAL ══════ */}
      {deactivateModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(42,20,8,0.55)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000
        }}>
          <div style={{
            background:"#fff", borderRadius:18, padding:32, maxWidth:460, width:"90%",
            boxShadow:"0 16px 48px rgba(42,20,8,0.18)"
          }}>
            <div style={{ fontSize:32, marginBottom:12, textAlign:"center" }}>🔒</div>
            <h3 style={{ fontSize:17, fontWeight:800, color:"#2A1408", marginBottom:8, textAlign:"center" }}>
              Deactivate Restaurant?
            </h3>
            <p style={{ fontSize:13, color:"#7A5040", textAlign:"center", marginBottom:16, lineHeight:1.6 }}>
              Select a reason for deactivating <strong>"{deactivateModal.name}"</strong>.
            </p>
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:12, fontWeight:700, color:"#2A1408", marginBottom:8 }}>Select Reason:</p>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {DEACTIVATE_REASONS.map(r => (
                  <label key={r} style={{
                    display:"flex", alignItems:"center", gap:10, cursor:"pointer",
                    padding:"8px 12px", borderRadius:8,
                    background: deactivateReason === r ? "#FEF5E6" : "#FAF4EF",
                    border: deactivateReason === r ? "1.5px solid #E67E22" : "1px solid #E8D5C8",
                    fontSize:13, color:"#5A3E30", fontWeight: deactivateReason === r ? 700 : 500,
                  }}>
                    <input type="radio" name="reason" value={r}
                      checked={deactivateReason === r}
                      onChange={() => setDeactivateReason(r)}
                      style={{ accentColor:"#E67E22" }}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div style={{
              background:"#FFF3E6", borderRadius:10, padding:12, marginBottom:20,
              fontSize:12, color:"#E67E22", fontWeight:600, lineHeight:1.6
            }}>
              🚫 The email <strong>{deactivateModal.email}</strong> will be blacklisted. This restaurant cannot re-register.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setDeactivateModal(null); setDeactivateReason(""); }} style={{
                flex:1, padding:"11px 0", borderRadius:10, border:"1px solid #E8D5C8",
                background:"#FAF4EF", color:"#7A5040", fontWeight:700, fontSize:13, cursor:"pointer"
              }}>Cancel</button>
              <button onClick={handleDeactivateConfirm} disabled={!deactivateReason} style={{
                flex:1, padding:"11px 0", borderRadius:10, border:"none",
                background: deactivateReason ? "#E67E22" : "#ccc",
                color:"#fff", fontWeight:800, fontSize:13,
                cursor: deactivateReason ? "pointer" : "not-allowed",
              }}>Deactivate & Blacklist</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ SIDEBAR ══════ */}
      <aside className="db-sidebar">
        <div className="db-sidebar-top">
          <div className="db-logo-wrap">
            <img src={DineLogo} alt="DineEase" className="db-logo-img" />
            <div>
              <span className="db-logo-name">DineEase</span>
              <span className="db-logo-sub">Admin Panel</span>
            </div>
          </div>
        </div>

        <nav className="db-nav">
          <button className={`db-nav-item ${activeTab === "clients" ? "active" : ""}`} onClick={() => setActiveTab("clients")}>
            <span className="db-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </span>
            Client Management
            <span className="db-nav-badge">{total}</span>
          </button>

          <button className={`db-nav-item ${activeTab === "subscriptions" ? "active" : ""}`} onClick={() => setActiveTab("subscriptions")}>
            <span className="db-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </span>
            Subscriptions
            <span className="db-nav-badge">{active}</span>
          </button>

          <button className={`db-nav-item ${activeTab === "payments" ? "active" : ""}`} onClick={() => setActiveTab("payments")}>
            <span className="db-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
            Payments
          </button>

          <button className={`db-nav-item ${activeTab === "blacklist" ? "active" : ""}`} onClick={() => setActiveTab("blacklist")}>
            <span className="db-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </span>
            Blacklisted
          </button>
        </nav>

        <div className="db-sidebar-footer">
          <div className="db-admin-info">
            <div className="db-admin-avatar">M</div>
            <div>
              <span className="db-admin-name">Manahil Aamir</span>
              <span className="db-admin-role">Super Admin</span>
            </div>
          </div>
          <button className="db-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="db-main">

        <header className="db-header">
          <div className="db-header-left">
            <h1 className="db-page-title">
              {activeTab === "clients"       && "Client Management"}
              {activeTab === "subscriptions" && "Subscription & Licensing"}
              {activeTab === "payments"      && "Payment Monitoring"}
              {activeTab === "blacklist"     && "Blacklisted Emails"}
            </h1>
            <span className="db-breadcrumb">Dashboard / {activeTab}</span>
          </div>
          <div className="db-header-right">
            <div className="db-header-date">
              {new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
            </div>
            <button className="db-notif-btn"
              onClick={() => { setShowNotifPanel(!showNotifPanel); if (!showNotifPanel) markAllRead(); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && <span className="db-notif-badge">{unreadCount}</span>}
            </button>
          </div>
        </header>

        {showNotifPanel && (
          <div className="db-notif-panel">
            <div className="db-notif-panel-header">
              <h3 className="db-notif-panel-title">Payment Notifications</h3>
              <button className="db-notif-clear-all" onClick={() => notifications.forEach(n => clearNotif(n.id))}>Clear All</button>
            </div>
            {notifications.length === 0 ? (
              <div className="db-notif-empty">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`db-notif-item ${!n.read ? "unread" : ""}`}>
                  <div className="db-notif-icon">{n.type === "payment_success" ? "💳" : "⏳"}</div>
                  <div className="db-notif-content">
                    <p className="db-notif-msg">{n.message || `${n.restaurantName} — ${n.plan} — $${n.amount}`}</p>
                    <span className="db-notif-time">
                      {n.timestamp ? new Date(n.timestamp).toLocaleString("en-US", { dateStyle:"medium", timeStyle:"short" }) : "—"}
                    </span>
                  </div>
                  <button className="db-notif-dismiss" onClick={() => clearNotif(n.id)}>✕</button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="db-content">

          {/* Stat Cards */}
          <div className="db-cards">
            <div className="db-card db-card-1">
              <div className="db-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="db-card-body">
                <span className="db-card-label">Total Clients</span>
                <span className="db-card-value">{total}</span>
                <span className="db-card-sub">Registered restaurants</span>
              </div>
            </div>
            <div className="db-card db-card-2">
              <div className="db-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="db-card-body">
                <span className="db-card-label">Active</span>
                <span className="db-card-value">{active}</span>
                <span className="db-card-sub">Running subscriptions</span>
              </div>
            </div>
            <div className="db-card db-card-3">
              <div className="db-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="db-card-body">
                <span className="db-card-label">Pending</span>
                <span className="db-card-value">{pending}</span>
                <span className="db-card-sub">Awaiting approval</span>
              </div>
            </div>
            <div className="db-card" style={{ borderLeft:"4px solid #E67E22" }}>
              <div className="db-card-icon" style={{ background:"#FEF5E6", color:"#E67E22" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E67E22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="db-card-body">
                <span className="db-card-label" style={{ color:"#E67E22" }}>Expired</span>
                <span className="db-card-value" style={{ color:"#E67E22" }}>{expired}</span>
                <span className="db-card-sub">License time ended</span>
              </div>
            </div>
          </div>

          {/* ══════ TAB: CLIENT MANAGEMENT ══════ */}
          {activeTab === "clients" && (
            <div className="db-panel">
              <div className="db-panel-header">
                <div className="db-panel-title-wrap">
                  <h2 className="db-panel-title">Registered Restaurants</h2>
                  <span className="db-panel-count">{filtered.length} total</span>
                </div>
                <div className="db-panel-controls">
                  <div className="db-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input className="db-search" placeholder="Search by name or email..."
                      value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <div className="db-filter-tabs">
                    {["All","Active","Pending","Deactivated","Expired"].map(s => (
                      <button key={s} className={`db-filter-tab ${filterStatus === s ? "active" : ""}`}
                        onClick={() => setFilterStatus(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Restaurant</th>
                      <th>Contact</th>
                      <th>Plan</th>
                      <th>License Expires</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan="7" className="db-empty">No restaurants found</td></tr>
                    ) : (
                      filtered.map((res, i) => (
                        <tr key={res.id} className="db-tr">
                          <td className="db-td-num">{String(i + 1).padStart(2,"0")}</td>
                          <td>
                            <div className="db-name-cell">
                              <div className="db-avatar">{(res.restaurantName || "R")[0].toUpperCase()}</div>
                              <div>
                                <div className="db-name-text">{res.restaurantName || "—"}</div>
                                {(res.area || res.city) && (
                                  <div style={{ fontSize:11, color:"#9B7060", marginTop:2 }}>
                                    📍 {[res.area, res.city].filter(Boolean).join(", ")}
                                  </div>
                                )}
                                {/* Expired priority over Deactivated in label */}
                                {res.paymentStatus === "Expired" && (
                                  <div style={{ fontSize:10, color:"#E67E22", marginTop:2, fontWeight:700 }}>
                                    ⏰ License expired — subscription time ended
                                  </div>
                                )}
                                {res.status === "Deactivated" && res.paymentStatus !== "Expired" && res.deactivatedReason && (
                                  <div style={{ fontSize:10, color:"#E74C3C", marginTop:2, fontWeight:600 }}>
                                    🔒 Deactivated by Admin: {res.deactivatedReason}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              <span className="db-td-email">{res.email || "—"}</span>
                              {res.phone && (
                                <button onClick={() => callRestaurant(res.phone)} style={{
                                  display:"inline-flex", alignItems:"center", gap:4,
                                  background:"#E8F8EC", border:"1px solid #B7E8C5",
                                  borderRadius:6, padding:"2px 8px", cursor:"pointer",
                                  fontSize:11, fontWeight:700, color:"#16A34A", width:"fit-content"
                                }}>
                                  📞 {res.phone}
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`db-plan db-plan-${(res.plan || "free").toLowerCase().split(" ")[0]}`}>
                              {res.plan || "Free"}
                            </span>
                          </td>
                          <td>{getExpiryLabel(res)}</td>
                          <td>{getStatusBadge(res)}</td>
                          <td>
                            <div className="db-actions" style={{ flexWrap:"wrap", gap:5 }}>
                              <button className="db-btn"
                                onClick={() => openInGoogleMaps(res)}
                                title={res.status === "Pending" ? "VERIFY ON MAPS BEFORE ACTIVATING" : "Verify on Google Maps"}
                                style={{
                                  background: res.status === "Pending" ? "#FFE5B4" : "#E8F0FE",
                                  color: res.status === "Pending" ? "#E67E22" : "#1A73E8",
                                  border: res.status === "Pending" ? "2px solid #E67E22" : "1px solid #C5D8FC",
                                  display:"flex", alignItems:"center", gap:4,
                                  fontWeight: res.status === "Pending" ? "700" : "500",
                                }}>
                                🗺️ {res.status === "Pending" ? "VERIFY MAPS" : "Maps"}
                              </button>
                              <button className="db-btn db-btn-activate"
                                onClick={() => handleActivate(res.id)}
                                disabled={res.status === "Active" && res.paymentStatus !== "Expired"}>
                                ✓ Activate
                              </button>
                              <button className="db-btn db-btn-deactivate"
                                onClick={() => setDeactivateModal({ id: res.id, name: res.restaurantName, email: res.email })}
                                disabled={res.status === "Deactivated" && res.paymentStatus !== "Expired"}>
                                Deactivate
                              </button>
                              <button className="db-btn"
                                onClick={() => setRejectModal({ id: res.id, name: res.restaurantName, email: res.email })}
                                style={{
                                  background:"#FEEAEA", color:"#E74C3C",
                                  border:"1px solid #FFAAAA", display:"flex", alignItems:"center", gap:4
                                }}>
                                🗑️ Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════ TAB: SUBSCRIPTIONS ══════ */}
          {activeTab === "subscriptions" && (
            <div className="db-panel">
              <div className="db-panel-header">
                <div className="db-panel-title-wrap">
                  <h2 className="db-panel-title">Subscription & Licensing</h2>
                  <span className="db-panel-count">{active} active licenses</span>
                </div>
              </div>
              <div className="db-sub-cards">
                {Object.entries(planCounts).length === 0 ? (
                  <p className="db-empty-msg">No subscription data yet.</p>
                ) : (
                  Object.entries(planCounts).map(([plan, count]) => (
                    <div key={plan} className="db-sub-card">
                      <div className="db-sub-card-top">
                        <span className={`db-plan db-plan-${plan.toLowerCase().split(" ")[0]}`}>{plan}</span>
                        <span className="db-sub-count">{count}</span>
                      </div>
                      <div className="db-sub-bar-bg">
                        <div className="db-sub-bar-fill" style={{ width:`${(count/total)*100}%` }} />
                      </div>
                      <span className="db-sub-pct">{total > 0 ? Math.round((count/total)*100) : 0}% of clients</span>
                    </div>
                  ))
                )}
              </div>
              <div className="db-table-wrap" style={{ marginTop:24 }}>
                <table className="db-table">
                  <thead>
                    <tr><th>#</th><th>Restaurant</th><th>Email</th><th>Plan</th><th>License Expires</th><th>License Status</th><th>Manage</th></tr>
                  </thead>
                  <tbody>
                    {restaurants.length === 0 ? (
                      <tr><td colSpan="7" className="db-empty">No data available</td></tr>
                    ) : (
                      restaurants.map((res, i) => (
                        <tr key={res.id} className="db-tr">
                          <td className="db-td-num">{String(i+1).padStart(2,"0")}</td>
                          <td>
                            <div className="db-name-cell">
                              <div className="db-avatar">{(res.restaurantName || "R")[0].toUpperCase()}</div>
                              <span className="db-name-text">{res.restaurantName || "—"}</span>
                            </div>
                          </td>
                          <td className="db-td-email">{res.email || "—"}</td>
                          <td><span className={`db-plan db-plan-${(res.plan||"free").toLowerCase().split(" ")[0]}`}>{res.plan||"Free"}</span></td>
                          <td>{getExpiryLabel(res)}</td>
                          <td>{getStatusBadge(res)}</td>
                          <td>
                            <div className="db-actions">
                              <button className="db-btn db-btn-activate"
                                onClick={() => handleActivate(res.id)}
                                disabled={res.status === "Active" && res.paymentStatus !== "Expired"}>
                                Activate
                              </button>
                              <button className="db-btn db-btn-deactivate"
                                onClick={() => setDeactivateModal({ id: res.id, name: res.restaurantName, email: res.email })}
                                disabled={res.status === "Deactivated" && res.paymentStatus !== "Expired"}>
                                Deactivate
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════ TAB: PAYMENTS ══════ */}
          {activeTab === "payments" && (
            <div className="db-panel">
              <div className="db-panel-header">
                <div className="db-panel-title-wrap">
                  <h2 className="db-panel-title">Payment Monitoring</h2>
                  <span className="db-panel-count">Live feed</span>
                </div>
                <div className="db-live-badge"><span className="db-live-dot"/>Live</div>
              </div>
              <div className="db-pay-summary">
                <div className="db-pay-card">
                  <span className="db-pay-label">Total Revenue</span>
                  <span className="db-pay-value">${restaurants.reduce((s,r) => s+(r.paymentAmount||0),0)}</span>
                  <span className="db-pay-sub">All time collected</span>
                </div>
                <div className="db-pay-card">
                  <span className="db-pay-label">Active Licenses</span>
                  <span className="db-pay-value">{active}</span>
                  <span className="db-pay-sub">Currently running</span>
                </div>
                <div className="db-pay-card">
                  <span className="db-pay-label">Pending Payments</span>
                  <span className="db-pay-value">{pending}</span>
                  <span className="db-pay-sub">Awaiting payment</span>
                </div>
                <div className="db-pay-card" style={{ borderTop:"3px solid #E67E22" }}>
                  <span className="db-pay-label" style={{ color:"#E67E22" }}>Expired Licenses</span>
                  <span className="db-pay-value" style={{ color:"#E67E22" }}>{expired}</span>
                  <span className="db-pay-sub">License time ended</span>
                </div>
              </div>
              <div className="db-webhook-section">
                <h3 className="db-webhook-title">Recent Payment Events</h3>
                <div className="db-webhook-list">
                  {notifications.length === 0 ? (
                    <div className="db-empty-msg">No payment events yet.</div>
                  ) : (
                    notifications.slice(0,8).map((n) => (
                      <div key={n.id} className={`db-webhook-row ${!n.read ? "db-webhook-unread" : ""}`}>
                        <div className={`db-webhook-dot ${n.type==="payment_success" ? "success" : "warn"}`}/>
                        <div className="db-webhook-info">
                          <span className="db-webhook-event">{n.type==="payment_success" ? "payment.success" : "subscription.pending"}</span>
                          <span className="db-webhook-restaurant">{n.restaurantName||"—"}</span>
                        </div>
                        <span className={`db-webhook-status ${n.type==="payment_success" ? "success" : "warn"}`}>
                          {n.type==="payment_success" ? "✓ Paid" : "⏳ Pending"}
                        </span>
                        <span className="db-webhook-plan">{n.plan||"—"}</span>
                        <span className="db-webhook-amount">${n.amount||0}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="db-table-wrap" style={{ marginTop:24 }}>
                <table className="db-table">
                  <thead>
                    <tr><th>#</th><th>Restaurant</th><th>Plan</th><th>Amount</th><th>Paid At</th><th>License Expires</th><th>Payment Status</th></tr>
                  </thead>
                  <tbody>
                    {restaurants.length === 0 ? (
                      <tr><td colSpan="7" className="db-empty">No payment data available</td></tr>
                    ) : (
                      restaurants.map((res,i) => (
                        <tr key={res.id} className="db-tr">
                          <td className="db-td-num">{String(i+1).padStart(2,"0")}</td>
                          <td>
                            <div className="db-name-cell">
                              <div className="db-avatar">{(res.restaurantName||"R")[0].toUpperCase()}</div>
                              <span className="db-name-text">{res.restaurantName||"—"}</span>
                            </div>
                          </td>
                          <td><span className={`db-plan db-plan-${(res.plan||"free").toLowerCase().split(" ")[0]}`}>{res.plan||"Free"}</span></td>
                          <td className="db-td-amount">{res.paymentAmount ? `$${res.paymentAmount}` : "$0"}</td>
                          <td className="db-td-date">
                            {res.paidAt ? new Date(res.paidAt).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                          </td>
                          <td>{getExpiryLabel(res)}</td>
                          <td>
                            <span className={`db-status ${
                              res.paymentStatus === "Expired" ? "db-status-expired" :
                              res.paymentStatus === "Paid"    ? "db-status-active"  :
                              "db-status-pending"
                            }`}>
                              <span className="db-status-dot"/>
                              {res.paymentStatus === "Expired" ? "⏰ Expired" : (res.paymentStatus || "Unpaid")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════ TAB: BLACKLISTED ══════ */}
          {activeTab === "blacklist" && (
            <BlacklistTab database={database} />
          )}

        </div>

        <footer className="db-footer">
          <span>© {new Date().getFullYear()} DineEase — Admin Panel</span>
          <span>Savour the flavour, one bite at a time</span>
        </footer>
      </div>
    </div>
  );
}

// ── Blacklist Tab ─────────────────────────────────────────────────────────────
function BlacklistTab({ database }) {
  const [blacklist, setBlacklist] = useState([]);

  useEffect(() => {
    const blRef = ref(database, "blacklistedEmails");
    const unsub = onValue(blRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.keys(data).map(k => ({ key: k, ...data[k] }))
          .sort((a,b) => new Date(b.blacklistedAt) - new Date(a.blacklistedAt));
        setBlacklist(list);
      } else {
        setBlacklist([]);
      }
    });
    return () => unsub();
  }, [database]);

  const removeFromBlacklist = async (key) => {
    await remove(ref(database, `blacklistedEmails/${key}`));
  };

  return (
    <div className="db-panel">
      <div className="db-panel-header">
        <div className="db-panel-title-wrap">
          <h2 className="db-panel-title">Blacklisted Emails</h2>
          <span className="db-panel-count">{blacklist.length} blocked</span>
        </div>
        <div style={{ fontSize:12, color:"#E74C3C", fontWeight:600, padding:"6px 14px", background:"#FEEAEA", borderRadius:8, border:"1px solid #FFAAAA" }}>
          🚫 These emails cannot register again
        </div>
      </div>
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr><th>#</th><th>Email</th><th>Restaurant</th><th>Reason</th><th>Blacklisted On</th><th>Action</th></tr>
          </thead>
          <tbody>
            {blacklist.length === 0 ? (
              <tr><td colSpan="6" className="db-empty">No blacklisted emails</td></tr>
            ) : (
              blacklist.map((item, i) => (
                <tr key={item.key} className="db-tr">
                  <td className="db-td-num">{String(i+1).padStart(2,"0")}</td>
                  <td className="db-td-email">{item.email}</td>
                  <td className="db-name-text">{item.restaurantName || "—"}</td>
                  <td style={{ fontSize:12, color:"#E74C3C" }}>{item.reason || "—"}</td>
                  <td className="db-td-date">
                    {item.blacklistedAt ? new Date(item.blacklistedAt).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                  </td>
                  <td>
                    <button onClick={() => removeFromBlacklist(item.key)} style={{
                      padding:"5px 12px", borderRadius:8, border:"1px solid #B7E8C5",
                      background:"#E8F8EC", color:"#16A34A", fontWeight:700, fontSize:12, cursor:"pointer"
                    }}>✓ Unblock</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}