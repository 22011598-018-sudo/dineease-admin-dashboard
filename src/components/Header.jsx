import React from "react";
import { FaEllipsisV } from "react-icons/fa";
import '../styles/Header.css';
import logo from "../assets/images/DineEaseLogo.jpeg";

export default function Header({ pageTitle, onLogout }) {
  return (
    <header className="header">
      <div className="header-left">
        <img src={logo} alt="Logo" className="logo" />
        <h2>{pageTitle}</h2>
      </div>
      <div className="header-right">
        <FaEllipsisV className="dots-icon" onClick={onLogout} />
      </div>
    </header>
  );
}