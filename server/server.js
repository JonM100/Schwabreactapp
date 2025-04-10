import express from "express";
import cors from "cors";
import { MarketApiClient, StreamingApiClient } from "schwab-client-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());

let marketClient = null;
let streamingClient = null;
let isWebSocketOpen = false;

const state = {
  ticker: process.env.TICKER || "SPY",
  expirationDates: [],
  spotPrice: 0,
  sigma: 0.2,
  optionsData: {},
  graphData2D: {
    strikes: [],
    totalGex: [],
    totalVanna: [],
    totalCharm: [],
    totalOi: [],
    totalVolume: [],
    annotations: {
      totalGex: [],
      totalVanna: [],
      totalCharm: [],
      totalOi: [],
      totalVolume: [],
    },
    putCallTotals: { callOi: 0, putOi: 0, callVolume: 0, putVolume: 0 }, // Changed to totals
  },
  graphData3D: {
    strikes: [],
    expirationDates: [],
    optionsData: {},
  },
};

// Black-Scholes Functions (unchanged)
const normPdf = (x) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
const normCdf = (x) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
};

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

const blackScholesVanna = (S, K, T, r, sigma) => {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0;
  try {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const vanna = (-d2 / sigma) * normPdf(d1);
    return isNaN(vanna) || !isFinite(vanna) ? 0 : vanna;
  } catch (e) {
    return 0;
  }
};

const blackScholesCharm = (S, K, T, r, sigma, optionType = "call") => {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0;
  try {
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const pdfD1 = normPdf(d1);
    const charmCall = -pdfD1 * (2 * r * T - d2 * sigma * Math.sqrt(T)) / (2 * T * S * sigma * Math.sqrt(T));
    const charm = optionType === "call" ? charmCall : charmCall - pdfD1 * sigma / (S * Math.sqrt(T));
    return isNaN(charm) || !isFinite(charm) ? 0 : charm;
  } catch (e) {
    return 0;
  }
};

const calculateTimeToExpiration = (expirationDateStr) => {
  const expDate = new Date(expirationDateStr.split(":")[0]);
  const currentDate = new Date();
  const daysToExpiration = (expDate - currentDate) / (1000 * 60 * 60 * 24);
  return Math.max(daysToExpiration / 365, 1e-6);
};

const calculateSigma = async (ticker) => {
  try {
    const priceHistory = await marketClient.priceHistory(ticker, {
      periodType: "month",
      period: 3,
      frequencyType: "daily",
      frequency: 1,
    });
    const closes = priceHistory.candles.map(c => c.close);
    const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
    const sigma = Math.sqrt(252) * Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / (returns.length - 1));
    return isNaN(sigma) ? 0.2 : sigma;
  } catch (e) {
    console.error("Error calculating sigma:", e);
    return 0.2;
  }
};

async function initializeClients() {
  const APP_KEY = process.env.SCHWAB_APP_KEY;
  const APP_SECRET = process.env.SCHWAB_SECRET;
  const APP_REFRESH = process.env.SCHWAB_REFRESH_TOKEN;

  if (!APP_KEY || !APP_SECRET || !APP_REFRESH) {
    throw new Error("Missing required environment variables: SCHWAB_APP_KEY, SCHWAB_SECRET, or SCHWAB_REFRESH_TOKEN");
  }

  console.log("Initializing MarketApiClient...");
  marketClient = new MarketApiClient(APP_KEY, APP_SECRET, APP_REFRESH);
  console.log("Initializing StreamingApiClient...");
  streamingClient = new StreamingApiClient();

  return new Promise((resolve, reject) => {
    streamingClient.streamListen("open", () => {
      console.log("WebSocket connection opened.");
      isWebSocketOpen = true;
      resolve();
    });
    streamingClient.streamListen("close", (code, reason) => {
      console.log(`WebSocket closed: Code=${code}, Reason=${reason}`);
      isWebSocketOpen = false;
      reject(new Error(`WebSocket closed: ${reason}`));
    });
    streamingClient.streamListen("error", (error) => {
      console.error("WebSocket error:", error);
      isWebSocketOpen = false;
      reject(error);
    });

    console.log("Starting streamInit...");
    streamingClient.streamInit()
      .then(() => {
        console.log("streamInit completed, logging in...");
        return streamingClient.streamSchwabLogin();
      })
      .then(() => console.log("streamSchwabLogin completed"))
      .catch(err => reject(err));
  });
}

const fetchInitialData = async (ticker, fromDate, toDate) => {
  try {
    console.log(`Fetching quotes for ${ticker}...`);
    const quote = await marketClient.quotes(ticker);
    if (!quote || !quote[ticker] || !quote[ticker].quote || typeof quote[ticker].quote.lastPrice !== "number") {
      throw new Error(`Invalid quote response for ${ticker}: ${JSON.stringify(quote)}`);
    }
    state.ticker = ticker;
    state.spotPrice = quote[ticker].quote.lastPrice || 0;
    if (state.spotPrice === 0) {
      console.error(`[Initial] Spot price for ${ticker} is 0, setting default to 100`);
      state.spotPrice = 100; // Fallback value
    }

    console.log(`Fetching option chain for ${ticker} from ${fromDate} to ${toDate}...`);
    const optionChain = await marketClient.chains(ticker, {
      contractType: "ALL",
      strikeCount: 100,
      includeUnderlyingQuote: true,
      strategy: "SINGLE",
      range: "ALL",
      fromDate: fromDate.toISOString().split("T")[0],
      toDate: toDate.toISOString().split("T")[0],
    });
    console.log(`optionChain ${ticker} from ${fromDate} to ${toDate}...`);
    state.expirationDates = [...new Set([
      ...Object.keys(optionChain.callExpDateMap).map(k => k.split(":")[0]),
      ...Object.keys(optionChain.putExpDateMap).map(k => k.split(":")[0]),
    ])].sort();

    const optionSymbols = [];
    state.optionsData = {};
    for (const exp in optionChain.callExpDateMap) {
      for (const strike in optionChain.callExpDateMap[exp]) {
        const option = optionChain.callExpDateMap[exp][strike][0];
        const symbol = option.symbol;
        optionSymbols.push(symbol);
        state.optionsData[symbol] = {
          oi: option.openInterest || 0,
          volume: option.totalVolume || 0,
          strikePrice: parseFloat(strike),
        };
      }
    }
    for (const exp in optionChain.putExpDateMap) {
      for (const strike in optionChain.putExpDateMap[exp]) {
        const option = optionChain.putExpDateMap[exp][strike][0];
        const symbol = option.symbol;
        optionSymbols.push(symbol);
        state.optionsData[symbol] = {
          oi: option.openInterest || 0,
          volume: option.totalVolume || 0,
          strikePrice: parseFloat(strike),
        };
      }
    }
    console.log(`Fetched ${optionSymbols.length} option symbols for ${ticker}`);
    return optionSymbols;
  } catch (e) {
    console.error("Error fetching initial data:", e);
    throw e;
  }
};

const updateGraphData2D = () => {
  const strikes = new Set();
  for (const symbol in state.optionsData) {
    const strike = state.optionsData[symbol].strikePrice;
    if (isNaN(strike)) {
      console.error(`[2D] Invalid strike for ${symbol}: ${strike}`);
      continue;
    }
    strikes.add(strike);
  }
  state.graphData2D.strikes = Array.from(strikes).sort((a, b) => a - b);
  const len = state.graphData2D.strikes.length;
  state.graphData2D.totalGex = Array(len).fill(0);
  state.graphData2D.totalVanna = Array(len).fill(0);
  state.graphData2D.totalCharm = Array(len).fill(0);
  state.graphData2D.totalOi = Array(len).fill(0);
  state.graphData2D.totalVolume = Array(len).fill(0);

  let totalCallOi = 0, totalPutOi = 0, totalCallVolume = 0, totalPutVolume = 0;

  const expDates = Object.fromEntries(state.expirationDates.map(exp => [exp, calculateTimeToExpiration(exp)]));
  for (const symbol in state.optionsData) {
    const cleanSymbol = symbol.trim();
    const isCall = cleanSymbol.includes("C");
    const isPut = cleanSymbol.includes("P");
    if (!isCall && !isPut) continue;

    const strike = state.optionsData[symbol].strikePrice;
    if (isNaN(strike)) {
      console.error(`[2D] Invalid strike for ${cleanSymbol}: ${strike}`);
      continue;
    }
    const idx = state.graphData2D.strikes.indexOf(strike);
    if (idx === -1) {
      console.error(`[2D] Strike ${strike} not found in strikes array for ${cleanSymbol}`);
      continue;
    }

    const oi = state.optionsData[symbol].oi || 0;
    const volume = state.optionsData[symbol].volume || 0;
    const expDate = state.expirationDates.find(exp => exp.replace(/-/g, "") === cleanSymbol.slice(6, 12));
    const t = expDates[expDate] || 30 / 365;

    const gamma = blackScholesGamma(state.spotPrice, strike, t, 0.01, state.sigma);
    const vanna = blackScholesVanna(state.spotPrice, strike, t, 0.01, state.sigma);
    const charm = blackScholesCharm(state.spotPrice, strike, t, 0.01, state.sigma, isCall ? "call" : "put");
    const multiplier = isCall ? 1 : -1;

    state.graphData2D.totalGex[idx] += multiplier * gamma * oi * 100;
    state.graphData2D.totalVanna[idx] += multiplier * vanna * oi * 100;
    state.graphData2D.totalCharm[idx] += multiplier * charm * oi * 100;
    state.graphData2D.totalOi[idx] += oi * multiplier;
    state.graphData2D.totalVolume[idx] += volume * multiplier;

    // Accumulate totals
    if (isCall) {
      totalCallOi += oi;
      totalCallVolume += volume;
    } else if (isPut) {
      totalPutOi += oi;
      totalPutVolume += volume;
    }

    state.optionsData[symbol].gamma = gamma;
  }

  // Store totals instead of ratios
  state.graphData2D.putCallTotals = {
    callOi: totalCallOi,
    putOi: totalPutOi,
    callVolume: totalCallVolume,
    putVolume: totalPutVolume,
  };
  console.log(`[2D] Totals - Call OI: ${totalCallOi}, Put OI: ${totalPutOi}, Call Vol: ${totalCallVolume}, Put Vol: ${totalPutVolume}`);

  const metrics = ["totalGex", "totalVanna", "totalCharm", "totalOi", "totalVolume"];
  metrics.forEach(metric => {
    const values = state.graphData2D[metric];
    if (values.length === 0) {
      state.graphData2D.annotations[metric] = [];
      return;
    }
    const maxIdx = values.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);
    const minIdx = values.reduce((iMin, x, i, arr) => x < arr[iMin] ? i : iMin, 0);
    state.graphData2D.annotations[metric] = [
      { strike: state.graphData2D.strikes[maxIdx], value: values[maxIdx], label: `${state.graphData2D.strikes[maxIdx]}: ${values[maxIdx].toFixed(2)}` },
      { strike: state.graphData2D.strikes[minIdx], value: values[minIdx], label: `${state.graphData2D.strikes[minIdx]}: ${values[minIdx].toFixed(2)}` },
    ].filter(a => a.value !== 0);
  });

  console.log(`[2D] Graph data updated with ${state.graphData2D.strikes.length} strikes`);
};

const updateGraphData3D = () => {
  state.graphData3D.strikes = state.graphData2D.strikes;
  state.graphData3D.expirationDates = state.expirationDates;
  state.graphData3D.optionsData = { ...state.optionsData };
  console.log(`[3D] Graph data updated with ${state.graphData3D.strikes.length} strikes, ${state.graphData3D.expirationDates.length} expirations`);
};

async function waitForWebSocket() {
  if (isWebSocketOpen) return;
  await initializeClients();
}

waitForWebSocket().catch(err => {
  console.error("Failed to initialize clients:", err);
  process.exit(1);
});

app.get("/market-data", async (req, res) => {
  console.log("[2D] Client requested initial 2D data");

  res.setHeader("Content-Type", "application/json");

  try {
    const ticker = req.query.ticker || state.ticker;
    const fromDateStr = req.query.fromDate || new Date().toISOString().split("T")[0];
    const toDateStr = req.query.toDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);

    if (isNaN(fromDate) || isNaN(toDate)) {
      throw new Error("Invalid date format for fromDate or toDate");
    }

    await fetchInitialData(ticker, fromDate, toDate);
    updateGraphData2D();
    console.log(`[2D] Sending initial data with ${state.graphData2D.strikes.length} strikes`);

    const allMetrics = [
      ...state.graphData2D.totalGex,
      ...state.graphData2D.totalVanna,
      ...state.graphData2D.totalCharm,
      ...state.graphData2D.totalOi,
      ...state.graphData2D.totalVolume,
    ];
    const vannaXRange = [Math.min(...allMetrics), Math.max(...allMetrics)];

    res.status(200).json({
      ...state.graphData2D,
      spotPrice: state.spotPrice,
      vannaXRange,
    });
  } catch (e) {
    console.error("[2D] Error in /market-data:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/market-stream", async (req, res) => {
  console.log("[2D] Client connected to SSE");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let currentTicker = req.query.ticker || state.ticker;
  let currentOptionSymbols = [];

  const subscribeToTicker = (ticker, optionSymbols) => {
    streamingClient.streamSchwabRequest("SUBS", "LEVELONE_OPTIONS", {
      keys: optionSymbols.join(","),
      fields: "0,8,9",
    });
    streamingClient.streamSchwabRequest("SUBS", "LEVELONE_EQUITIES", {
      keys: ticker,
      fields: "0,1",
    });
    console.log(`[2D] Subscribed to LEVELONE_OPTIONS and LEVELONE_EQUITIES for ${ticker}`);
  };

  const unsubscribeFromTicker = (ticker, optionSymbols) => {
    streamingClient.streamSchwabRequest("UNSUBS", "LEVELONE_OPTIONS", {
      keys: optionSymbols.join(","),
    });
    streamingClient.streamSchwabRequest("UNSUBS", "LEVELONE_EQUITIES", {
      keys: ticker,
    });
    console.log(`[2D] Unsubscribed from LEVELONE_OPTIONS and LEVELONE_EQUITIES for ${ticker}`);
  };

  try {
    if (!isWebSocketOpen) {
      console.log("[2D] Waiting for WebSocket to open...");
      await new Promise(resolve => {
        streamingClient.streamListen("open", () => {
          isWebSocketOpen = true;
          console.log("[2D] WebSocket opened during request");
          resolve();
        });
      });
    }

    const fromDateStr = req.query.fromDate || new Date().toISOString().split("T")[0];
    const toDateStr = req.query.toDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);

    if (isNaN(fromDate) || isNaN(toDate)) {
      throw new Error("Invalid date format for fromDate or toDate");
    }

    if (currentTicker !== state.ticker && currentOptionSymbols.length > 0) {
      unsubscribeFromTicker(state.ticker, currentOptionSymbols);
    }

    currentOptionSymbols = await fetchInitialData(currentTicker, fromDate, toDate);
    updateGraphData2D();
    console.log(`[2D] Sending initial data with ${currentOptionSymbols.length} options`);
    const allMetricsInitial = [
      ...state.graphData2D.totalGex,
      ...state.graphData2D.totalVanna,
      ...state.graphData2D.totalCharm,
      ...state.graphData2D.totalOi,
      ...state.graphData2D.totalVolume,
    ];
    const vannaXRangeInitial = [Math.min(...allMetricsInitial), Math.max(...allMetricsInitial)];
    res.write(`data: ${JSON.stringify({
      initialData: {
        ...state.graphData2D,
        spotPrice: state.spotPrice,
        vannaXRange: vannaXRangeInitial,
      }
    })}\n\n`);

    subscribeToTicker(currentTicker, currentOptionSymbols);

    const interval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ heartbeat: "keep-alive" })}\n\n`);
    }, 10000);

    streamingClient.streamListen("message", async (message) => {
      if (!message.includes('"data"')) {
        console.log("[2D] Skipping non-data message:", message);
        return;
      }
      const data = JSON.parse(message);

      if (data.data?.some(item => item.service === "LEVELONE_EQUITIES")) {
        data.data.forEach(item => {
          if (item.service === "LEVELONE_EQUITIES" && item.content[0].key === currentTicker) {
            const newSpotPrice = parseFloat(item.content[0]["1"]);
            if (!isNaN(newSpotPrice) && newSpotPrice !== state.spotPrice) {
              console.log(`[2D] Updating spotPrice from ${state.spotPrice} to ${newSpotPrice}`);
              state.spotPrice = newSpotPrice;
              updateGraphData2D();
              const allMetrics = [
                ...state.graphData2D.totalGex,
                ...state.graphData2D.totalVanna,
                ...state.graphData2D.totalCharm,
                ...state.graphData2D.totalOi,
                ...state.graphData2D.totalVolume,
              ];
              const vannaXRange = [Math.min(...allMetrics), Math.max(...allMetrics)];
              res.write(`data: ${JSON.stringify({
                graphData: {
                  ...state.graphData2D,
                  spotPrice: state.spotPrice,
                  vannaXRange,
                },
                timestamp: new Date().toISOString()
              })}\n\n`);
            }
          }
        });
      }

      if (data.data?.some(item => item.service === "LEVELONE_OPTIONS")) {
        let optionCount = 0;
        data.data.forEach(item => {
          if (item.service === "LEVELONE_OPTIONS") {
            optionCount += item.content.length;
            item.content.forEach(option => {
              const symbol = option.key.trim();
              const existingData = state.optionsData[symbol] || { oi: 0, volume: 0, gamma: 0, strikePrice: 0 };

              const newVolume = option["8"] !== undefined ? parseInt(option["8"]) : existingData.volume; // TOTAL_VOLUME
              const newOi = option["9"] !== undefined ? parseInt(option["9"]) : existingData.oi;       // OPEN_INTEREST

              if (option["8"] !== undefined && newVolume !== existingData.volume) {
                console.log(`[2D] Updated Volume for ${symbol}: ${existingData.volume} -> ${newVolume}`);
              }
              if (option["9"] !== undefined && newOi !== existingData.oi) {
                console.log(`[2D] Updated OI for ${symbol}: ${existingData.oi} -> ${newOi}`);
              }

              state.optionsData[symbol] = {
                ...existingData,
                oi: newOi,
                volume: newVolume,
              };
            });
          }
        });
        console.log(`[2D] Received ${optionCount} options from streaming`);
        updateGraphData2D();
        const allMetrics = [
          ...state.graphData2D.totalGex,
          ...state.graphData2D.totalVanna,
          ...state.graphData2D.totalCharm,
          ...state.graphData2D.totalOi,
          ...state.graphData2D.totalVolume,
        ];
        const vannaXRange = [Math.min(...allMetrics), Math.max(...allMetrics)];
        res.write(`data: ${JSON.stringify({
          graphData: {
            ...state.graphData2D,
            spotPrice: state.spotPrice,
            vannaXRange,
          },
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    });

    req.on("close", () => {
      clearInterval(interval);
      unsubscribeFromTicker(currentTicker, currentOptionSymbols);
      console.log("[2D] Client disconnected from SSE");
      res.end();
    });
  } catch (e) {
    console.error("[2D] Error in /market-stream:", e);
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

app.get("/market-data-3d", async (req, res) => {
  console.log("[3D] Client requested 3D data");

  res.setHeader("Content-Type", "application/json");

  try {
    const ticker = req.query.ticker || state.ticker;
    const fromDateStr = req.query.fromDate || new Date().toISOString().split("T")[0];
    const toDateStr = req.query.toDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);

    if (isNaN(fromDate) || isNaN(toDate)) {
      throw new Error("Invalid date format for fromDate or toDate");
    }

    const optionSymbols = await fetchInitialData(ticker, fromDate, toDate);
    updateGraphData2D();
    updateGraphData3D();
    console.log(`[3D] Sending data with ${optionSymbols.length} options`);

    res.status(200).json(state.graphData3D);
  } catch (e) {
    console.error("[3D] Error in /market-data-3d:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});