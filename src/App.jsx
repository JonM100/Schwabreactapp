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
    putCallTotals: { callOi: 0, putOi: 0, callVolume: 0, putVolume: 0 },
    optionsData: {},
    expirationDates: [],
    expDatesWithTime: {},
  });
  const [gammaProfile, setGammaProfile] = useState({
    levels: [],
    totalGamma: [],
    totalGammaExNext: [],
    totalGammaExFri: [],
    flipPoint: null,
  });
  const [ticker, setTicker] = useState("SPY");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef(null);

  // Normal PDF for Black-Scholes
  const normPdf = (x) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);

  // Black-Scholes Gamma
  const blackScholesGamma = (S, K, T, r, sigma) => {
    if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0;
    try {
      const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
      const gamma = normPdf(d1) / (S * sigma * Math.sqrt(T));
      return isNaN(gamma) || !isFinite(gamma) ? 0 : gamma;
    } catch (e) {
      return 0;
    }
  };

  const calculateGammaProfile = (data = graphData) => {
    if (
      !data.optionsData ||
      !data.expirationDates ||
      !data.expDatesWithTime ||
      !data.spotPrice
    ) {
      return {
        levels: [],
        totalGamma: [],
        totalGammaExNext: [],
        totalGammaExFri: [],
        flipPoint: null,
      };
    }

    // Define range of spot prices
    const spotPrice = data.spotPrice;
    const fromPrice = spotPrice * 0.8;
    const toPrice = spotPrice * 1.2;
    const numPoints = 60;
    const levels = Array.from(
      { length: numPoints },
      (_, i) => fromPrice + (i * (toPrice - fromPrice)) / (numPoints - 1)
    );

    // Find next expiry and next monthly expiry
    const expirationDates = data.expirationDates.map(date => new Date(date));
    const nextExpiry = new Date(Math.min(...expirationDates.map(date => date.getTime())));
    const thirdFridays = expirationDates.filter(date => {
      const day = date.getDate();
      const weekday = date.getDay();
      return weekday === 4 && day >= 15 && day <= 21;
    });
    const nextMonthlyExp = new Date(Math.min(...thirdFridays.map(date => date.getTime())));

    // Calculate gamma exposure for each level
    const sigma = 0.2; // Should come from backend
    const r = 0.01;
    const totalGamma = [];
    const totalGammaExNext = [];
    const totalGammaExFri = [];

    for (const level of levels) {
      let gammaAll = 0;
      let gammaExNext = 0;
      let gammaExFri = 0;

      for (const symbol in data.optionsData) {
        const option = data.optionsData[symbol];
        const { strikePrice, oi, expirationDate, optionType } = option;
        if (!strikePrice || !oi || !expirationDate || !optionType) continue;

        const expDateStr = new Date(expirationDate).toISOString().split("T")[0];
        const t = data.expDatesWithTime[expDateStr] || 30 / 365;
        const gamma = blackScholesGamma(level, strikePrice, t, r, sigma);
        const multiplier = optionType === "call" ? 1 : -1;
        const gammaEx = multiplier * gamma * oi * 100 * level * level * 0.01;

        gammaAll += gammaEx;
        if (expDateStr !== nextExpiry.toISOString().split("T")[0]) {
          gammaExNext += gammaEx;
        }
        if (expDateStr !== nextMonthlyExp.toISOString().split("T")[0]) {
          gammaExFri += gammaEx;
        }
      }

      totalGamma.push(gammaAll / 10 ** 9);
      totalGammaExNext.push(gammaExNext / 10 ** 9);
      totalGammaExFri.push(gammaExFri / 10 ** 9);
    }

    // Calculate gamma flip point
    let flipPoint = null;
    for (let i = 0; i < totalGamma.length - 1; i++) {
      if (totalGamma[i] * totalGamma[i + 1] < 0) {
        const negGamma = totalGamma[i];
        const posGamma = totalGamma[i + 1];
        const negStrike = levels[i];
        const posStrike = levels[i + 1];
        flipPoint = posStrike - ((posStrike - negStrike) * posGamma) / (posGamma - negGamma);
        break;
      }
    }

    return { levels, totalGamma, totalGammaExNext, totalGammaExFri, flipPoint };
  };

  const fetchInitialData = async () => {
    try {
      const response = await fetch(
        `http://localhost:5002/market-data?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`
      );
      const data = await response.json();
      console.log("[2D] Initial Data Response:", data);
      if (data.error) {
        console.error("[2D] Initial Data Error:", data.error);
      } else {
        setGraphData(data);
        setLastRefresh(new Date().toLocaleString());
        const profile = calculateGammaProfile(data);
        setGammaProfile(profile);
      }
    } catch (err) {
      console.error("[2D] Fetch Initial Data Error:", err);
    }
  };

  const connectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      console.log("[2D] Closed existing SSE connection");
    }

    const url = `http://localhost:5002/market-stream?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.onopen = () => {
      console.log("[2D] SSE connection opened successfully");
    };

    eventSourceRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[2D] SSE Message:", message);
      if (message.heartbeat) return;

      if (message.initialData || message.graphData) {
        const newData = message.initialData || message.graphData;
        setGraphData(newData);
        setLastRefresh(new Date().toLocaleString());
        const profile = calculateGammaProfile(newData);
        setGammaProfile(profile);
      } else if (message.error) {
        console.error("[2D] SSE Error from server:", message.error);
      }
    };

    eventSourceRef.current.onerror = (err) => {
      console.error("[2D] SSE Error:", err);
      setIsStreaming(false);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    };
  };

  const startStream = () => {
    if (!isStreaming) {
      console.log("[2D] Starting stream...");
      setIsStreaming(true);
      connectSSE();
    } else {
      console.log("[2D] Stream already active");
    }
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("[2D] Stream stopped manually");
    }
    setIsStreaming(false);
  };

  const handleTickerChange = () => {
    if (isStreaming) {
      stopStream();
      fetchInitialData().then(() => startStream());
    } else {
      fetchInitialData();
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        console.log("[2D] Cleaned up SSE on unmount");
      }
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTickerChange();
  };

  const totalGex = graphData.totalGex.reduce((sum, value) => sum + value, 0) / 10 ** 9;
  const flipPoint = gammaProfile.flipPoint;

  const createBarData = (key, title, positiveColor, negativeColor) => {
    const dataWithIndex = graphData.strikes.map((strike, idx) => ({
      strike,
      value: (graphData[key][idx] || 0) / 10 ** 9,
    }));

    const positiveData = dataWithIndex
      .filter(d => d.value > 0)
      .map(d => ({ y: d.strike, x: d.value }));
    const negativeData = dataWithIndex
      .filter(d => d.value < 0)
      .map(d => ({ y: d.strike, x: d.value }));

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
    const values = graphData[key].map(val => (val || 0) / 10 ** 9);
    return [Math.min(...values, 0) * 1.1, Math.max(...values, 0) * 1.1];
  };

  const getYRangeAroundSpot = () => {
    const zoomRange = 20;
    const spotPrice = graphData.spotPrice || 0;
    return [spotPrice - zoomRange, spotPrice + zoomRange];
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
      range: getYRangeAroundSpot(),
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
    hovermode: "closest",
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

  const createPieData = (type) => {
    const { callOi, putOi, callVolume, putVolume } = graphData.putCallTotals;
    const isOi = type === "oi";
    const calls = isOi ? callOi : callVolume;
    const puts = isOi ? putOi : putVolume;
    const total = calls + puts || 1;
    const ratio = calls === 0 ? 0 : puts / calls;
    return {
      values: [puts, calls],
      labels: ["Puts", "Calls"],
      type: "pie",
      marker: {
        colors: ["#ff003c", "#00ff99"],
      },
      textinfo: "label+percent",
      textposition: "inside",
      hoverinfo: "label+percent",
      title: { text: `${isOi ? "OI" : "Vol"} PCR: ${ratio.toFixed(2)}`, font: { color: "#00f7ff", size: 14 } },
    };
  };

  const pieLayout = {
    width: 250,
    height: 250,
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    font: { family: "Arial, sans-serif", size: 12, color: "#e0e0e0" },
    showlegend: false,
    margin: { t: 40, b: 40, l: 40, r: 40 },
  };

  const gammaProfileLayout = {
    width: 800,
    height: 500,
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    font: { family: "Arial, sans-serif", size: 12, color: "#e0e0e0" },
    xaxis: {
      title: "Index Price",
      showgrid: true,
      zeroline: false,
      titlefont: { color: "#e0e0e0" },
      tickfont: { color: "#e0e0e0" },
      range: [graphData.spotPrice * 0.8, graphData.spotPrice * 1.2],
    },
    yaxis: {
      title: "Gamma Exposure ($ billions/1% move)",
      showgrid: true,
      zeroline: true,
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
    shapes: [
      {
        type: "rect",
        x0: graphData.spotPrice * 0.8,
        x1: gammaProfile.flipPoint || graphData.spotPrice,
        y0: Math.min(...gammaProfile.totalGamma, 0) * 1.1 || -1,
        y1: Math.max(...gammaProfile.totalGamma, 0) * 1.1 || 1,
        fillcolor: "rgba(255, 0, 0, 0.1)",
        line: { width: 0 },
      },
      {
        type: "rect",
        x0: gammaProfile.flipPoint || graphData.spotPrice,
        x1: graphData.spotPrice * 1.2,
        y0: Math.min(...gammaProfile.totalGamma, 0) * 1.1 || -1,
        y1: Math.max(...gammaProfile.totalGamma, 0) * 1.1 || 1,
        fillcolor: "rgba(0, 255, 0, 0.1)",
        line: { width: 0 },
      },
    ],
  };

  const gammaProfileData = [
    {
      x: gammaProfile.levels,
      y: gammaProfile.totalGamma,
      type: "scatter",
      mode: "lines",
      name: "All Expiries",
      line: { color: "#1f77b4" },
    },
    {
      x: gammaProfile.levels,
      y: gammaProfile.totalGammaExNext,
      type: "scatter",
      mode: "lines",
      name: "Ex-Next Expiry",
      line: { color: "#ff7f0e" },
    },
    {
      x: gammaProfile.levels,
      y: gammaProfile.totalGammaExFri,
      type: "scatter",
      mode: "lines",
      name: "Ex-Next Monthly Expiry",
      line: { color: "#2ca02c" },
    },
    {
      type: "scatter",
      mode: "lines",
      x: [graphData.spotPrice, graphData.spotPrice],
      y: [Math.min(...gammaProfile.totalGamma, 0) * 1.1 || -1, Math.max(...gammaProfile.totalGamma, 0) * 1.1 || 1],
      line: { color: "#ff0000", width: 1 },
      name: `Spot: ${graphData.spotPrice.toFixed(0)}`,
    },
    ...(gammaProfile.flipPoint
      ? [
          {
            type: "scatter",
            mode: "lines",
            x: [gammaProfile.flipPoint, gammaProfile.flipPoint],
            y: [Math.min(...gammaProfile.totalGamma, 0) * 1.1 || -1, Math.max(...gammaProfile.totalGamma, 0) * 1.1 || 1],
            line: { color: "#00ff00", width: 1 },
            name: `Gamma Flip: ${gammaProfile.flipPoint.toFixed(0)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="app-container">
      <Navbar />
      <div className="pcr-pie-container">
        <div className="pcr-pie">
          <Plot data={[createPieData("oi")]} layout={pieLayout} />
        </div>
        <div className="pcr-pie">
          <Plot data={[createPieData("volume")]} layout={pieLayout} />
        </div>
      </div>
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
      <div className="chart-row">
        <div className="chart-container">
          <h2>Gamma Exposure Profile</h2>
          <Plot
            data={gammaProfileData}
            layout={{
              ...gammaProfileLayout,
              title: { text: `Gamma Exposure Profile - ${ticker}`, font: { color: "#ffffff" } },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default App;