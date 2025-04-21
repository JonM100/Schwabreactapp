import React from "react";
import Plot from "react-plotly.js";
import "./App.css";

const PcrPieCharts = ({ putCallTotals }) => {
  const createPieData = (type) => {
    const { callOi, putOi, callVolume, putVolume } = putCallTotals;
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
      title: {
        text: `${isOi ? "OI" : "Vol"} PCR: ${ratio.toFixed(2)}`,
        font: { color: "#00f7ff", size: 14 },
      },
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

  return (
    <div className="pcr-pie-container">
      <div className="pcr-pie">
        <Plot data={[createPieData("oi")]} layout={pieLayout} />
      </div>
      <div className="pcr-pie">
        <Plot data={[createPieData("volume")]} layout={pieLayout} />
      </div>
    </div>
  );
};

export default PcrPieCharts;