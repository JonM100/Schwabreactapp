import React from "react";
import "./App.css";

const InputForm = ({
  ticker,
  setTicker,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  handleSubmit,
}) => {
  const onSubmit = (e) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <form onSubmit={onSubmit} className="input-form">
      <div className="input-group">
        <label htmlFor="ticker">Ticker:</label>
        <input
          type="text"
          id="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter ticker (e.g., SPY)"
        />
      </div>
      <div className="input-group">
        <label htmlFor="fromDate">From Date:</label>
        <input
          type="date"
          id="fromDate"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
      </div>
      <div className="input-group">
        <label htmlFor="toDate">To Date:</label>
        <input
          type="date"
          id="toDate"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>
      <button type="submit">Update</button>
    </form>
  );
};

export default InputForm;