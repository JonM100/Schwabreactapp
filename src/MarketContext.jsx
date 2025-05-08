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
  const [ticker2D, setTicker2D] = useState("SPY");
  const [fromDate2D, setFromDate2D] = useState(new Date().toISOString().split("T")[0]);
  const [toDate2D, setToDate2D] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [ticker3D, setTicker3D] = useState("SPY");
  const [fromDate3D, setFromDate3D] = useState(new Date().toISOString().split("T")[0]);
  const [toDate3D, setToDate3D] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef(null);

  const fetchInitialData2D = async () => {
    try {
      const url = `http://localhost:5002/market-data?ticker=${encodeURIComponent(ticker2D)}&fromDate=${encodeURIComponent(fromDate2D)}&toDate=${encodeURIComponent(toDate2D)}`;
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
      const url = `http://localhost:5002/market-data-3d?ticker=${encodeURIComponent(ticker3D)}&fromDate=${encodeURIComponent(fromDate3D)}&toDate=${encodeURIComponent(toDate3D)}`;
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

    const url = `http://localhost:5002/market-stream?ticker=${encodeURIComponent(ticker2D)}&fromDate=${encodeURIComponent(fromDate2D)}&toDate=${encodeURIComponent(toDate2D)}`;
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
          console.log("[2D] Updating graphData2D with new data:", newData);
          setGraphData2D(newData);
          setLastRefresh(new Date().toLocaleString());
          // Log 3D state to ensure no changes
          console.log("[2D] Current 3D state:", { ticker3D, fromDate3D, toDate3D });
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

  const handleTickerChange2D = async () => {
    console.log("[2D] Handling ticker change for:", ticker2D);
    console.log("[2D] 3D state before change:", { ticker3D, fromDate3D, toDate3D });
    if (isStreaming) {
      stopStream();
      await fetchInitialData2D();
      startStream();
    } else {
      await fetchInitialData2D();
    }
    console.log("[2D] 3D state after change:", { ticker3D, fromDate3D, toDate3D });
  };

  const handleTickerChange3D = async () => {
    console.log("[3D] Handling ticker change for:", ticker3D);
    await fetchInitialData3D();
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
        ticker2D,
        setTicker2D,
        fromDate2D,
        setFromDate2D,
        toDate2D,
        setToDate2D,
        ticker3D,
        setTicker3D,
        fromDate3D,
        setFromDate3D,
        toDate3D,
        setToDate3D,
        lastRefresh,
        isStreaming,
        startStream,
        stopStream,
        handleTickerChange2D,
        handleTickerChange3D,
        fetchInitialData2D,
        fetchInitialData3D,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};