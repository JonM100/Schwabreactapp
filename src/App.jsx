import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import Navbar from "./Navbar";
import "./App.css";

const App = () => {
  const [graphData, setGraphData] = useState({
    strikes: [],
    totalGex: [],
    totalVanna: [],
    totalCharm: [],
    totalOi: [],
    totalVolume: [],
    spotPrice: 0,
    annotations: {
      totalGex: [],
      totalVanna: [],
      totalCharm: [],
      totalOi: [],
      totalVolume: [],
    },
    vannaXRange: [0, 0],
  });
  const [ticker, setTicker] = useState("SPY");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef(null);

  const fetchInitialData = async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/market-data?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`
      );
      const data = await response.json();
      console.log("[2D] Initial Data Response:", data);
      if (data.error) {
        console.error("[2D] Initial Data Error:", data.error);
      } else {
        setGraphData(data);
        setLastRefresh(new Date().toLocaleString());
      }
    } catch (err) {
      console.error("[2D] Fetch Initial Data Error:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [ticker, fromDate, toDate]);

  const connectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `http://localhost:5001/market-stream?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[2D] SSE Message:", message);
      if (message.heartbeat) return;

      if (message.initialData || message.graphData) {
        const newData = message.initialData || message.graphData;
        setGraphData(newData);
        setLastRefresh(new Date().toLocaleString());
      } else if (message.error) {
        console.error("[2D] SSE Error from server:", message.error);
      }
    };

    eventSourceRef.current.onerror = (err) => {
      console.error("[2D] SSE Error:", err);
      setIsStreaming(false);
    };
  };

  const startStream = () => {
    if (!isStreaming) {
      setIsStreaming(true);
      connectSSE();
    }
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchInitialData();
  };

  const calculateGexMetrics = () => {
    const totalGex = graphData.totalGex.reduce((sum, value) => sum + value, 0);
    let flipPoint = null;
    for (let i = 0; i < graphData.strikes.length - 1; i++) {
      if (graphData.totalGex[i] * graphData.totalGex[i + 1] < 0) {
        const x0 = graphData.strikes[i];
        const x1 = graphData.strikes[i + 1];
        const y0 = graphData.totalGex[i];
        const y1 = graphData.totalGex[i + 1];
        flipPoint = x0 - (y0 * (x1 - x0)) / (y1 - y0);
        break;
      }
    }
    return { totalGex, flipPoint };
  };

  const { totalGex, flipPoint } = calculateGexMetrics();

  const createBarData = (key, title, positiveColor, negativeColor) => {
    const dataWithIndex = graphData.strikes.map((strike, idx) => ({
      strike,
      value: graphData[key][idx] || 0,
    }));

    // Filter out zero values for bar data
    const positiveData = dataWithIndex
      .filter(d => d.value > 0)
      .map(d => ({ y: d.strike, x: d.value }));
    const negativeData = dataWithIndex
      .filter(d => d.value < 0)
      .map(d => ({ y: d.strike, x: d.value }));

    // Top 5 peaks for annotations
    const positivePeaks = dataWithIndex
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const negativePeaks = dataWithIndex
      .filter(d => d.value < 0)
      .sort((a, b) => a.value - b.value)
      .slice(0, 5);

    const peakAnnotations = [...positivePeaks, ...negativePeaks].map(peak => ({
      y: peak.strike,
      x: peak.value,
      text: `${peak.value.toFixed(2)}`,
      showarrow: true,
      arrowhead: 1,
      ax: peak.value > 0 ? 20 : -20,
      ay: -10,
    }));

    return [
      {
        y: positiveData.map(d => d.y),
        x: positiveData.map(d => d.x),
        type: "bar",
        orientation: "h",
        name: `${title} (Positive)`,
        marker: { color: positiveColor },
        width: 0.8,
      },
      {
        y: negativeData.map(d => d.y),
        x: negativeData.map(d => d.x),
        type: "bar",
        orientation: "h",
        name: `${title} (Negative)`,
        marker: { color: negativeColor },
        width: 0.8,
      },
      ...(peakAnnotations.length > 0
        ? [{
            type: "scatter",
            mode: "text",
            y: peakAnnotations.map(a => a.y),
            x: peakAnnotations.map(a => a.x),
            text: peakAnnotations.map(a => a.text),
            textposition: "top center",
            showlegend: false,
            hoverinfo: "none",
          }]
        : []),
    ];
  };

  const getXRange = (key) => {
    const values = graphData[key].map(val => val || 0);
    return [Math.min(...values, 0) * 1.1, Math.max(...values, 0) * 1.1];
  };

  const layout = {
    width: 600,
    height: 700,
    barmode: "relative",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    font: { family: "Arial, sans-serif", size: 12, color: "#e0e0e0" },
    xaxis: {
      title: "Value",
      zeroline: true,
      showgrid: false,
      titlefont: { color: "#e0e0e0" },
      tickfont: { color: "#e0e0e0" },
    },
    yaxis: {
      title: "Strike Price",
      zeroline: false,
      showgrid: false,
      type: "linear",
      autorange: true,
      titlefont: { color: "#e0e0e0" },
      tickfont: { color: "#e0e0e0" },
    },
    legend: {
      x: 1,
      y: 1,
      bgcolor: "rgba(30, 30, 30, 0.8)",
      font: { color: "#e0e0e0" },
    },
    annotations: [],
    hovermode: "closest", // Enable interactive tooltips
  };

  const spotPriceLine = (key) => ({
    type: "scatter",
    mode: "lines",
    y: [graphData.spotPrice, graphData.spotPrice],
    x: key === "totalVanna" ? graphData.vannaXRange : getXRange(key),
    line: { color: "#ffffff", width: 2, dash: "dash" },
    name: "Spot Price",
  });

  const gammaFlipLine = flipPoint
    ? {
        type: "scatter",
        mode: "lines",
        y: [flipPoint, flipPoint],
        x: getXRange("totalGex"),
        line: { color: "#00ff00", width: 2, dash: "dot" },
        name: "Gamma Flip",
      }
    : null;

  return (
    <div className="app-container">
      <Navbar />
      <h1 className="app-title">Options Exposure Dashboard (2D)</h1>
      <div className="stream-controls">
        <button onClick={startStream} disabled={isStreaming}>
          Start Stream
        </button>
        <button onClick={stopStream} disabled={!isStreaming}>
          Stop Stream
        </button>
        <span className={`status-indicator ${isStreaming ? "status-on" : "status-off"}`}></span>
      </div>
      <div className="refresh-timer">
        Last Refreshed: {lastRefresh || "Waiting for data..."}
      </div>
      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-group">
          <label htmlFor="ticker">Ticker:</label>
          <input
            type="text"
            id="ticker"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g., SPY, SPX)"
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
      <div className="chart-row">
        <div className="chart-container">
          <h2>GEX Levels</h2>
          <div className="chart-info">
            <p>Spot Price: ${graphData.spotPrice.toFixed(2)}</p>
            <p>Total GEX: {totalGex.toFixed(2)}</p>
            <p>Gamma Flip Point: {flipPoint ? flipPoint.toFixed(2) : "N/A"}</p>
          </div>
          <Plot
            data={[
              ...createBarData("totalGex", "GEX", "#1f77b4", "#ff7f0e"),
              spotPriceLine("totalGex"),
              ...(gammaFlipLine ? [gammaFlipLine] : []),
            ]}
            layout={{
              ...layout,
              xaxis: { ...layout.xaxis, range: getXRange("totalGex") },
              title: { text: `Gamma Exposure (GEX) - ${ticker}`, font: { color: "#ffffff" } },
            }}
          />
        </div>
        <div className="chart-container">
          <h2>Vanna Levels</h2>
          <div className="chart-info">
            <p>Spot Price: ${graphData.spotPrice.toFixed(2)}</p>
          </div>
          <Plot
            data={[...createBarData("totalVanna", "Vanna", "#2ca02c", "#d62728"), spotPriceLine("totalVanna")]}
            layout={{
              ...layout,
              xaxis: { ...layout.xaxis, range: getXRange("totalVanna") },
              title: { text: `Vanna Exposure - ${ticker}`, font: { color: "#ffffff" } },
            }}
          />
        </div>
      </div>
      <div className="chart-row">
        <div className="chart-container">
          <h2>Charm Levels</h2>
          <div className="chart-info">
            <p>Spot Price: ${graphData.spotPrice.toFixed(2)}</p>
          </div>
          <Plot
            data={[...createBarData("totalCharm", "Charm", "#fca708", "#fca708"), spotPriceLine("totalCharm")]}
            layout={{
              ...layout,
              xaxis: { ...layout.xaxis, range: getXRange("totalCharm") },
              title: { text: `Charm Exposure - ${ticker}`, font: { color: "#ffffff" } },
            }}
          />
        </div>
        <div className="chart-container">
          <h2>Total OI</h2>
          <div className="chart-info">
            <p>Spot Price: ${graphData.spotPrice.toFixed(2)}</p>
          </div>
          <Plot
            data={[...createBarData("totalOi", "OI", "#2ca02c", "#d62728"), spotPriceLine("totalOi")]}
            layout={{
              ...layout,
              xaxis: { ...layout.xaxis, range: getXRange("totalOi") },
              title: { text: `Open Interest (OI) - ${ticker}`, font: { color: "#ffffff" } },
            }}
          />
        </div>
      </div>
      <div className="chart-row">
        <div className="chart-container">
          <h2>Total Volume</h2>
          <div className="chart-info">
            <p>Spot Price: ${graphData.spotPrice.toFixed(2)}</p>
          </div>
          <Plot
            data={[...createBarData("totalVolume", "Volume", "#2ca02c", "#d62728"), spotPriceLine("totalVolume")]}
            layout={{
              ...layout,
              xaxis: { ...layout.xaxis, range: getXRange("totalVolume") },
              title: { text: `Volume - ${ticker}`, font: { color: "#ffffff" } },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;