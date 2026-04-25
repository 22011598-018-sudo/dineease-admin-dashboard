import React from "react";
import "../styles/Sidebar.css";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">DineEase Admin</div>
      <ul>
        <li className="active">Dashboard</li>
        <li>Clients</li>
        <li>Subscription</li>
        <li>Payments</li>
      </ul>
    </div>
  );
}