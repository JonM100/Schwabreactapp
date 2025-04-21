import React, { createContext, useState, useEffect, useRef } from "react";

export const MarketContext = createContext();

export const MarketProvider = ({ children }) => {
  const [graphData2D, setGraphData2D] = useState({
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
  });
  const [graphData3D, setGraphData3D] = useState({
    strikes: [],
    expirationDates: [],
    optionsData: {},
  });
  const [ticker, setTicker] = useState("SPY");
  const [fromDate, setFromDate] = useState(new Date().toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef(null);

  const fetchInitialData2D = async () => {
    try {
      const url = `http://localhost:5002/market-data?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
      console.log("[2D] Fetching data from:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("[2D] Initial Data Response:", data);
      if (data.error) {
        console.error("[2D] Initial Data Error:", data.error);
      } else {
        setGraphData2D(data);
        setLastRefresh(new Date().toLocaleString());
      }
    } catch (err) {
      console.error("[2D] Fetch Initial Data Error:", err);
    }
  };

  const fetchInitialData3D = async () => {
    try {
      const url = `http://localhost:5002/market-data-3d?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
      console.log("[3D] Fetching data from:", url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("[3D] Initial Data Response:", data);
      if (data.error) {
        console.error("[3D] Server Error:", data.error);
      } else {
        setGraphData3D(data);
        setLastRefresh(new Date().toLocaleString());
      }
    } catch (err) {
      console.error("[3D] Fetch Error:", err);
    }
  };

  const connectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      console.log("[2D] Closed existing SSE connection");
    }

    const url = `http://localhost:5002/market-stream?ticker=${encodeURIComponent(ticker)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
    console.log("[2D] Connecting SSE to:", url);
    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.onopen = () => {
      console.log("[2D] SSE connection opened successfully");
    };

    eventSourceRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("[2D] SSE Message:", message);
        if (message.heartbeat) return;

        if (message.initialData || message.graphData) {
          const newData = message.initialData || message.graphData;
          setGraphData2D(newData);
          setLastRefresh(new Date().toLocaleString());
        } else if (message.error) {
          console.error("[2D] SSE Error from server:", message.error);
        }
      } catch (err) {
        console.error("[2D] SSE Message Parsing Error:", err);
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

  const handleTickerChange = async () => {
    console.log("[Context] Handling ticker change for:", ticker);
    if (isStreaming) {
      stopStream();
      await Promise.all([fetchInitialData2D(), fetchInitialData3D()]);
      startStream();
    } else {
      await Promise.all([fetchInitialData2D(), fetchInitialData3D()]);
    }
  };

  useEffect(() => {
    console.log("[Context] Initializing data fetch...");
    Promise.all([fetchInitialData2D(), fetchInitialData3D()]);
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

  return (
    <MarketContext.Provider
      value={{
        graphData2D,
        graphData3D,
        ticker,
        setTicker,
        fromDate,
        setFromDate,
        toDate,
        setToDate,
        lastRefresh,
        isStreaming,
        startStream,
        stopStream,
        handleTickerChange,
        fetchInitialData2D,
        fetchInitialData3D,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};