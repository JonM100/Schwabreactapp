import React, { useContext } from "react";
import { MarketContext } from "./MarketContext";
import Navbar from "./Navbar";
import InputForm from "./InputForm";
import StreamControls from "./StreamControls";
import ChartContainer from "./ChartContainer";
import PcrPieCharts from "./PcrPieCharts";
import "./App.css";

const App = () => {
  const {
    graphData2D,
    ticker,
    fromDate,
    toDate,
    lastRefresh,
    isStreaming,
    startStream,
    stopStream,
    setTicker,
    setFromDate,
    setToDate,
    handleTickerChange,
  } = useContext(MarketContext);

  const calculateGexMetrics = () => {
    const totalGex = graphData2D.totalGex.reduce((sum, value) => sum + value, 0);
    let flipPoint = null;
    for (let i = 0; i < graphData2D.strikes.length - 1; i++) {
      if (graphData2D.totalGex[i] * graphData2D.totalGex[i + 1] < 0) {
        const x0 = graphData2D.strikes[i];
        const x1 = graphData2D.strikes[i + 1];
        const y0 = graphData2D.totalGex[i];
        const y1 = graphData2D.totalGex[i + 1];
        flipPoint = x0 - (y0 * (x1 - x0)) / (y1 - y0);
        break;
      }
    }
    return { totalGex, flipPoint };
  };

  const { totalGex, flipPoint } = calculateGexMetrics();

  return (
    <div className="app-container">
      <Navbar />
      <PcrPieCharts putCallTotals={graphData2D.putCallTotals} />
      <h1 className="app-title">Options Exposure Dashboard (2D)</h1>
      <StreamControls
        isStreaming={isStreaming}
        startStream={startStream}
        stopStream={stopStream}
      />
      <div className="refresh-timer">
        Last Refreshed: {lastRefresh || "Waiting for data..."}
      </div>
      <InputForm
        ticker={ticker}
        setTicker={setTicker}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        handleSubmit={handleTickerChange}
      />
      <div className="chart-row">
        <ChartContainer
          title={`Gamma Exposure (GEX) - ${ticker}`}
          dataKey="totalGex"
          graphData={graphData2D}
          spotPrice={graphData2D.spotPrice}
          positiveColor="#00ff99"
          negativeColor="#ff003c"
          flipPoint={flipPoint}
          chartInfo={{
            "Spot Price": `$${graphData2D.spotPrice.toFixed(2)}`,
            "Total GEX": totalGex.toFixed(2),
            "Gamma Flip Point": flipPoint ? flipPoint.toFixed(2) : "N/A",
          }}
        />
        <ChartContainer
          title={`Vanna Exposure - ${ticker}`}
          dataKey="totalVanna"
          graphData={graphData2D}
          spotPrice={graphData2D.spotPrice}
          positiveColor="#00ff99"
          negativeColor="#ff003c"
          chartInfo={{
            "Spot Price": `$${graphData2D.spotPrice.toFixed(2)}`,
          }}
        />
      </div>
      <div className="chart-row">
        <ChartContainer
          title={`Charm Exposure - ${ticker}`}
          dataKey="totalCharm"
          graphData={graphData2D}
          spotPrice={graphData2D.spotPrice}
          positiveColor="#ff003c"
          negativeColor="#00ff99"
          chartInfo={{
            "Spot Price": `$${graphData2D.spotPrice.toFixed(2)}`,
          }}
        />
        <ChartContainer
          title={`Open Interest (OI) - ${ticker}`}
          dataKey="totalOi"
          graphData={graphData2D}
          spotPrice={graphData2D.spotPrice}
          positiveColor="#00ff99"
          negativeColor="#ff003c"
          chartInfo={{
            "Spot Price": `$${graphData2D.spotPrice.toFixed(2)}`,
          }}
        />
      </div>
      <div className="chart-row">
        <ChartContainer
          title={`Volume - ${ticker}`}
          dataKey="totalVolume"
          graphData={graphData2D}
          spotPrice={graphData2D.spotPrice}
          positiveColor="#00ff99"
          negativeColor="#ff003c"
          chartInfo={{
            "Spot Price": `$${graphData2D.spotPrice.toFixed(2)}`,
          }}
        />
      </div>
    </div>
  );
};

export default App;