import React, { useContext, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { MarketContext } from "./MarketContext";
import Navbar from "./Navbar";
import InputForm from "./InputForm";
import "./App.css";

const Gex3DPage = () => {
  const {
    graphData3D,
    ticker3D,
    setTicker3D,
    fromDate3D,
    setFromDate3D,
    toDate3D,
    setToDate3D,
    fetchInitialData3D,
    handleTickerChange3D,
  } = useContext(MarketContext);

  // Store previous values to prevent unnecessary fetches
  const prevValues = useRef({ ticker3D, fromDate3D, toDate3D });

  useEffect(() => {
    // Log state changes to debug reloads
    if (
      prevValues.current.ticker3D !== ticker3D ||
      prevValues.current.fromDate3D !== fromDate3D ||
      prevValues.current.toDate3D !== toDate3D
    ) {
      console.log("[3D] useEffect triggered:", {
        ticker3D,
        fromDate3D,
        toDate3D,
        prevTicker3D: prevValues.current.ticker3D,
        prevFromDate3D: prevValues.current.fromDate3D,
        prevToDate3D: prevValues.current.toDate3D,
      });
      fetchInitialData3D();
      prevValues.current = { ticker3D, fromDate3D, toDate3D };
    } else {
      console.log("[3D] useEffect skipped: No state changes");
    }
  }, [ticker3D, fromDate3D, toDate3D, fetchInitialData3D]);

  const prepare3DGexData = () => {
    const { strikes, expirationDates, optionsData } = graphData3D;
    const spotPrice = Object.values(optionsData)[0]?.strikePrice || 0; // Approximate spotPrice
    const expirations = [...expirationDates]
      .map((date) => date.split(":")[0])
      .sort((a, b) => new Date(a) - new Date(b)); // Ascending order, earliest first
    const sortedStrikes = [...strikes].sort((a, b) => {
      const distA = Math.abs(a - spotPrice);
      const distB = Math.abs(b - spotPrice);
      return distA - distB || a - b; // Ascending from midpoint
    });

    const zData = expirations.map((exp) =>
      sortedStrikes.map((strike) => {
        const expCode = exp.replace(/-/g, "").slice(2);
        const call = `${ticker3D.padEnd(6)}${expCode}C${(strike * 1000)
          .toString()
          .padStart(8, "0")}`;
        const put = `${ticker3D.padEnd(6)}${expCode}P${(strike * 1000)
          .toString()
          .padStart(8, "0")}`;
        const callGex = (optionsData[call]?.oi || 0) * (optionsData[call]?.gamma || 0);
        const putGex = (optionsData[put]?.oi || 0) * (optionsData[put]?.gamma || 0);
        return (callGex - putGex) * 100;
      })
    );

    return {
      x: sortedStrikes,
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
      text: `3D Net GEX Surface - ${ticker3D}`,
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
      <InputForm
        ticker={ticker3D}
        setTicker={setTicker3D}
        fromDate={fromDate3D}
        setFromDate={setFromDate3D}
        toDate={toDate3D}
        setToDate={setToDate3D}
        handleSubmit={handleTickerChange3D}
      />
      <div className="chart-container-3d">
        <h2>3D Net GEX Surface</h2>
        <Plot data={[prepare3DGexData()]} layout={layout} />
      </div>
    </div>
  );
};

export default Gex3DPage;