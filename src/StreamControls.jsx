import React from "react";
import "./App.css";

const StreamControls = ({ isStreaming, startStream, stopStream }) => {
  return (
    <div className="stream-controls">
      <button onClick={startStream} disabled={isStreaming}>
        Start Stream
      </button>
      <button onClick={stopStream} disabled={!isStreaming}>
        Stop Stream
      </button>
      <span className={`status-indicator ${isStreaming ? "status-on" : "status-off"}`}></span>
    </div>
  );
};

export default StreamControls;