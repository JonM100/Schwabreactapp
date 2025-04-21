import React, { useContext, useEffect } from "react";
import Plot from "react-plotly.js";
import { MarketContext } from "./MarketContext";
import Navbar from "./Navbar";
import InputForm from "./InputForm";
import "./App.css";

const Gex3DPage = () => {
  const {
    graphData3D,
    ticker,
    setTicker,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    fetchInitialData3D,
    handleTickerChange,
  } = useContext(MarketContext);

  useEffect(() => {
    fetchInitialData3D();
  }, [ticker, fromDate, toDate, fetchInitialData3D]);

  const prepare3DGexData = () => {
    const { strikes, expirationDates, optionsData } = graphData3D;
    const expirations = [...expirationDates]
      .map((date) => date.split(":")[0])
      .sort((a, b) => new Date(a) - new Date(b));

    const zData = expirations.map((exp) =>
      strikes.map((strike) => {
        const expCode = exp.replace(/-/g, "").slice(2);
        const call = `${ticker.padEnd(6)}${expCode}C${(strike * 1000)
          .toString()
          .padStart(8, "0")}`;
        const put = `${ticker.padEnd(6)}${expCode}P${(strike * 1000)
          .toString()
          .padStart(8, "0")}`;
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
      <InputForm
        ticker={ticker}
        setTicker={setTicker}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        handleSubmit={handleTickerChange}
      />
      <div className="chart-container-3d">
        <h2>3D Net GEX Surface</h2>
        <Plot data={[prepare3DGexData()]} layout={layout} />
      </div>
    </div>
  );
};

export default Gex3DPage;
