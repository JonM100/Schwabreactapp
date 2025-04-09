import React from "react";
import { NavLink } from "react-router-dom";
import "./App.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <NavLink
        to="/"
        className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
      >
        2D Graphs
      </NavLink>
      <NavLink
        to="/3d-gex"
        className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
      >
        3D GEX
      </NavLink>
    </nav>
  );
};

export default Navbar;
