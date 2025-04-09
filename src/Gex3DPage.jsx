import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import Navbar from "./Navbar";
import "./App.css";

const Gex3DPage = () => {
  const [graphData, setGraphData] = useState({
    strikes: [],
    expirationDates: [],
    optionsData: {},
  });
  const [ticker, setTicker] = useState("SPY");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const fetchInitialData = async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/market-data-3d?ticker=${ticker}&fromDate=${fromDate}&toDate=${toDate}`
      );
      const data = await response.json();
      if (data.error) {
        console.error("[3D] Server Error:", data.error);
      } else {
        setGraphData(data);
      }
    } catch (err) {
      console.error("[3D] Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [ticker, fromDate, toDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchInitialData();
  };

  const prepare3DGexData = () => {
    const { strikes, expirationDates, optionsData } = graphData;
    const expirations = [...expirationDates]
      .map(date => date.split(":")[0])
      .sort((a, b) => new Date(a) - new Date(b));

    const zData = expirations.map(exp =>
      strikes.map(strike => {
        const expCode = exp.replace(/-/g, "").slice(2);
        const call = `${ticker.padEnd(6)}${expCode}C${(strike * 1000).toString().padStart(8, "0")}`;
        const put = `${ticker.padEnd(6)}${expCode}P${(strike * 1000).toString().padStart(8, "0")}`;
        const callGex = (optionsData[call]?.oi || 0) * (optionsData[call]?.gamma || 0);
        const putGex = (optionsData[put]?.oi || 0) * (optionsData[put]?.gamma || 0);
        return (callGex - putGex) * 100;
      })
    );

    return {
      x: strikes,
      y: expirations,
      z: zData,
      type: "surface",
      colorscale: "Viridis",
      showscale: true,
    };
  };

  const layout = {
    width: 800,
    height: 800,
    title: {
      text: `3D Net GEX Surface - ${ticker}`,
      font: { color: "#00f7ff", size: 22 },
    },
    scene: {
      xaxis: {
        title: "Strike Price",
        titlefont: { color: "#e0e0e0" },
        tickfont: { color: "#e0e0e0" },
        backgroundcolor: "#121212",
        gridcolor: "#333",
        color: "#e0e0e0",
      },
      yaxis: {
        title: "Expiration Date",
        titlefont: { color: "#e0e0e0" },
        tickfont: { color: "#e0e0e0" },
        backgroundcolor: "#121212",
        gridcolor: "#333",
        color: "#e0e0e0",
      },
      zaxis: {
        title: "Net GEX (Call - Put)",
        titlefont: { color: "#e0e0e0" },
        tickfont: { color: "#e0e0e0" },
        backgroundcolor: "#121212",
        gridcolor: "#444",
        color: "#e0e0e0",
      },
      bgcolor: "#121212",
    },
    paper_bgcolor: "#121212",
    plot_bgcolor: "#121212",
    font: { color: "#e0e0e0" },
  };

  return (
    <div className="app-container">
      <Navbar />
      <h1 className="app-title">3D GEX Dashboard</h1>
      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-group">
          <label htmlFor="ticker">Ticker:</label>
          <input
            type="text"
            id="ticker"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g., SPY)"
          />
        </div>
        <div className="input-group">
          <label htmlFor="fromDate">From Date:</label>
          <input
            type="date"
            id="fromDate"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="toDate">To Date:</label>
          <input
            type="date"
            id="toDate"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>
        <button type="submit">Update</button>
      </form>
      <div className="chart-container-3d">
        <h2>3D Net GEX Surface</h2>
        <Plot data={[prepare3DGexData()]} layout={layout} />
      </div>
    </div>
  );
};

export default Gex3DPage;
