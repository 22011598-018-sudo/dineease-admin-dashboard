import React from "react";
import { FaInstagram, FaTwitter } from "react-icons/fa";
import '../styles/Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <p>© 2026 DineEase. All Rights Reserved.</p>
      <div className="social-icons">
        <FaInstagram />
        <FaTwitter />
      </div>
    </footer>
  );
}