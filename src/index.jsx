import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MarketProvider } from "./MarketContext";
import App from "./App.jsx";
import Gex3DPage from "./Gex3DPage.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MarketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/3d-gex" element={<Gex3DPage />} />
        </Routes>
      </BrowserRouter>
    </MarketProvider>
  </React.StrictMode>
);