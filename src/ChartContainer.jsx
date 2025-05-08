import React, { useRef, useEffect, useState } from "react";
import "./App.css";

const CanvasChart = ({
  data,
  spotPrice,
  positiveColor,
  negativeColor,
  flipPoint,
  width,
  height,
}) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(10); // Initial zoom range (±10 around spotPrice)

  const drawChart = (ctx) => {
    ctx.clearRect(0, 0, width, height);

    // Validate data
    if (!data || !data.x || !data.y || data.x.length === 0 || data.y.length === 0) {
      ctx.font = "16px Arial";
      ctx.fillStyle = "#e0e0e0";
      ctx.textAlign = "center";
      ctx.fillText("No data available", width / 2, height / 2);
      return { xScale: () => 0, yScale: () => 0, barHeight: 0, positiveData: [], negativeData: [] };
    }

    // Data processing
    const dataWithIndex = data.y.map((strike, idx) => ({
      strike,
      value: data.x[idx] || 0,
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

    // Calculate ranges
    const values = data.x.map((val) => val || 0);
    const xMin = Math.min(...values, 0) * 1.1;
    const xMax = Math.max(...values, 0) * 1.1;
    const yMin = spotPrice - zoomLevel;
    const yMax = spotPrice + zoomLevel;

    // Canvas scaling
    const padding = { top: 40, bottom: 60, left: 80, right: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const xScale = (value) => {
      return padding.left + ((value - xMin) / (xMax - xMin)) * chartWidth;
    };
    const yScale = (strike) => {
      return padding.top + ((yMax - strike) / (yMax - yMin)) * chartHeight;
    };

    // Draw y-axis
    ctx.beginPath();
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom); // Fixed typo: pading -> padding
    ctx.stroke();

    // Draw positive bars (wider)
    ctx.fillStyle = positiveColor;
    const barHeight = chartHeight / data.y.length; // Wider bars
    positiveData.forEach((d) => {
      const x = xScale(0);
      const y = yScale(d.y);
      const barWidth = xScale(d.x) - xScale(0);
      ctx.fillRect(x, y - barHeight / 2, barWidth, barHeight);
    });

    // Draw negative bars (wider)
    ctx.fillStyle = negativeColor;
    negativeData.forEach((d) => {
      const x = xScale(d.x);
      const y = yScale(d.y);
      const barWidth = xScale(0) - xScale(d.x);
      ctx.fillRect(x, y - barHeight / 2, barWidth, barHeight);
    });

    // Draw spot price line
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    const spotY = yScale(spotPrice);
    ctx.moveTo(padding.left, spotY);
    ctx.lineTo(width - padding.right, spotY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw gamma flip line
    if (flipPoint) {
      ctx.beginPath();
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      const flipY = yScale(flipPoint);
      ctx.moveTo(padding.left, flipY);
      ctx.lineTo(width - padding.right, flipY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw annotations
    const peakAnnotations = [...positivePeaks, ...negativePeaks];
    ctx.font = "12px Arial";
    ctx.fillStyle = "#e0e0e0";
    ctx.textAlign = "center";
    peakAnnotations.forEach((peak) => {
      const x = xScale(peak.value);
      const y = yScale(peak.strike);
      ctx.fillText(peak.value.toFixed(2), x + (peak.value > 0 ? 20 : -20), y - 10);
    });

    // Draw y-axis label
    ctx.fillStyle = "#e0e0e0";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(30, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Strike Price", 0, 0);
    ctx.restore();

    // Draw y-axis ticks
    const yTicks = 10;
    ctx.beginPath();
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= yTicks; i++) {
      const strike = yMin + (i / yTicks) * (yMax - yMin);
      const y = yScale(strike);
      ctx.moveTo(padding.left - 5, y);
      ctx.lineTo(padding.left, y);
      ctx.fillText(strike.toFixed(2), padding.left - 10, y + 5);
    }
    ctx.stroke();

    return { xScale, yScale, barHeight, positiveData, negativeData };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const { xScale, yScale, barHeight, positiveData, negativeData } = drawChart(ctx);

    // Handle interactivity (hover)
    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      let found = false;
      const allData = [...positiveData, ...negativeData];

      for (const d of allData) {
        const y = yScale(d.y);
        const xStart = d.x >= 0 ? xScale(0) : xScale(d.x);
        const xEnd = d.x >= 0 ? xScale(d.x) : xScale(0);

        if (
          mouseX >= xStart &&
          mouseX <= xEnd &&
          mouseY >= y - barHeight / 2 &&
          mouseY <= y + barHeight / 2
        ) {
          setTooltip({
            x: mouseX + 10,
            y: mouseY + 10,
            strike: d.y.toFixed(2),
            value: d.x.toFixed(2),
          });
          found = true;
          break;
        }
      }

      if (!found) {
        setTooltip(null);
      }
    };

    // Handle zoom
    const handleWheel = (event) => {
      event.preventDefault();
      const zoomDelta = event.deltaY > 0 ? 1 : -1; // Zoom out if deltaY > 0, zoom in if < 0
      setZoomLevel((prev) => {
        const newZoom = Math.max(2, prev + zoomDelta); // Minimum zoom range ±2
        return newZoom;
      });
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("wheel", handleWheel);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [data, spotPrice, positiveColor, negativeColor, flipPoint, width, height, zoomLevel]);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="canvas-chart"
      />
      {tooltip && (
        <div
          className="tooltip"
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            background: "rgba(30, 30, 30, 0.8)",
            color: "#e0e0e0",
            padding: "5px 10px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
          }}
        >
          <p>Strike: {tooltip.strike}</p>
          <p>Value: {tooltip.value}</p>
        </div>
      )}
    </div>
  );
};

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
    // Validate graphData
    if (!graphData || !graphData.strikes || !graphData[dataKey]) {
      return [{ y: [], x: [] }];
    }

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

    return [
      {
        y: [...positiveData.map((d) => d.y), ...negativeData.map((d) => d.y)],
        x: [...positiveData.map((d) => d.x), ...negativeData.map((d) => d.x)],
      },
    ];
  };

  return (
    <div className="chart-container bg-gray-900 p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-white mb-2">{title.split(" - ")[0]}</h2>
      <div className="chart-info text-gray-300 mb-4">
        {Object.entries(chartInfo).map(([key, value]) => (
          <p key={key} className="text-sm">
            {key}: {value}
          </p>
        ))}
      </div>
      <CanvasChart
        data={createBarData()[0]}
        spotPrice={spotPrice || 0}
        positiveColor={positiveColor}
        negativeColor={negativeColor}
        flipPoint={flipPoint}
        width={600}
        height={700}
      />
    </div>
  );
};

export default ChartContainer;