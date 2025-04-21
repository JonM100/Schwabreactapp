import React from "react";
import Plot from "react-plotly.js";
import "./App.css";

const ChartContainer = ({
  title,
  dataKey,
  graphData,
  spotPrice,
  positiveColor,
  negativeColor,
  flipPoint,
  chartInfo,
}) => {
  const createBarData = () => {
    const dataWithIndex = graphData.strikes.map((strike, idx) => ({
      strike,
      value: graphData[dataKey][idx] || 0,
    }));

    const positiveData = dataWithIndex
      .filter((d) => d.value > 0)
      .map((d) => ({ y: d.strike, x: d.value }));
    const negativeData = dataWithIndex
      .filter((d) => d.value < 0)
      .map((d) => ({ y: d.strike, x: d.value }));

    const positivePeaks = dataWithIndex
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const negativePeaks = dataWithIndex
      .filter((d) => d.value < 0)
      .sort((a, b) => a.value - b.value)
      .slice(0, 5);

    const peakAnnotations = [...positivePeaks, ...negativePeaks].map((peak) => ({
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
        y: positiveData.map((d) => d.y),
        x: positiveData.map((d) => d.x),
        type: "bar",
        orientation: "h",
        name: `${title.split(" - ")[0]} (Positive)`,
        marker: { color: positiveColor },
        width: 0.8,
      },
      {
        y: negativeData.map((d) => d.y),
        x: negativeData.map((d) => d.x),
        type: "bar",
        orientation: "h",
        name: `${title.split(" - ")[0]} (Negative)`,
        marker: { color: negativeColor },
        width: 0.8,
      },
      ...(peakAnnotations.length > 0
        ? [
            {
              type: "scatter",
              mode: "text",
              y: peakAnnotations.map((a) => a.y),
              x: peakAnnotations.map((a) => a.x),
              text: peakAnnotations.map((a) => a.text),
              textposition: "top center",
              showlegend: false,
              hoverinfo: "none",
            },
          ]
        : []),
    ];
  };

  const getXRange = () => {
    const values = graphData[dataKey].map((val) => val || 0);
    return [Math.min(...values, 0) * 1.1, Math.max(...values, 0) * 1.1];
  };

  const getYRangeAroundSpot = () => {
    const zoomRange = 20;
    return [spotPrice - zoomRange, spotPrice + zoomRange];
  };

  const spotPriceLine = () => ({
    type: "scatter",
    mode: "lines",
    y: [spotPrice, spotPrice],
    x: dataKey === "totalVanna" ? graphData.vannaXRange : getXRange(),
    line: { color: "#ffffff", width: 2, dash: "dash" },
    name: "Spot Price",
  });

  const gammaFlipLine = flipPoint
    ? {
        type: "scatter",
        mode: "lines",
        y: [flipPoint, flipPoint],
        x: getXRange(),
        line: { color: "#00ff00", width: 2, dash: "dot" },
        name: "Gamma Flip",
      }
    : null;

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
      range: getXRange(),
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
    title: { text: title, font: { color: "#ffffff" } },
  };

  return (
    <div className="chart-container">
      <h2>{title.split(" - ")[0]}</h2>
      <div className="chart-info">
        {Object.entries(chartInfo).map(([key, value]) => (
          <p key={key}>{key}: {value}</p>
        ))}
      </div>
      <Plot
        data={[
          ...createBarData(),
          spotPriceLine(),
          ...(gammaFlipLine ? [gammaFlipLine] : []),
        ]}
        layout={layout}
      />
    </div>
  );
};

export default ChartContainer;