import React from "react";
import "../styles/DashboardCards.css";

export default function DashboardCards({ clients, subscriptions, payments }) {
  return (
    <div className="cards-container">
      <div className="card card1">
        <h3>Total Restaurants</h3>
        <p>{clients}</p>
      </div>

      <div className="card card2">
        <h3>Active Subscriptions</h3>
        <p>{subscriptions}</p>
      </div>

      <div className="card card3">
        <h3>Payments Today</h3>
        <p>{payments}</p>
      </div>
    </div>
  );
}