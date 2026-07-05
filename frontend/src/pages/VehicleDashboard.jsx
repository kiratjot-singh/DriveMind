import React, { useState, useEffect, useRef } from "react";
import { sendTelemetry } from "../api/backendApi";
import { socket } from "../socket/socketClient";

// Predefined coordinates/info for segments for V2V adjacency
const ADJACENCY_MAP = {
  curve_42: ["highway_101"],
  highway_101: ["curve_42", "intersection_alpha"],
  intersection_alpha: ["highway_101"]
};

function VehicleDashboard({ onLogout, vehicle }) {
  // Sensor state variables
  const [speed, setSpeed] = useState(50);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [brakePressure, setBrakePressure] = useState(0);
  const [laneOffset, setLaneOffset] = useState(0);
  const [distance, setDistance] = useState(40);
  const [acceleration, setAcceleration] = useState(0.2);
  const [weather, setWeather] = useState("clear");
  const [segment, setSegment] = useState("curve_42");

  // Ingest stream & API responses state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [lastProcessed, setLastProcessed] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // V2V Alert feeds state
  const [v2vAlerts, setV2vAlerts] = useState([]);
  
  const streamIntervalRef = useRef(null);

  const vehicleId = vehicle?.vehicleId || "legacy_vehicle";
  const vehicleType = vehicle?.vehicleType || "car";

  const handleTransmit = async () => {
    setErrorMessage("");
    const payload = {
      vehicleId,
      roadSegmentId: segment,
      speed: Number(speed),
      acceleration: Number(acceleration),
      brakePressure: Number(brakePressure),
      steeringAngle: Number(steeringAngle),
      laneOffset: Number(laneOffset),
      distanceToFrontVehicle: Number(distance),
      weather
    };

    try {
      const response = await sendTelemetry(payload);
      setLastProcessed(response.data);
      if (isStreaming) {
        setStreamCount((prev) => prev + 1);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Failed to transmit telemetry");
      setIsStreaming(false);
    }
  };

  // Manage sensor stream interval
  useEffect(() => {
    if (isStreaming) {
      handleTransmit();
      streamIntervalRef.current = setInterval(handleTransmit, 1000);
    } else {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    }
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, [isStreaming, speed, steeringAngle, brakePressure, laneOffset, distance, acceleration, weather, segment]);

  // Sync V2V OTA Socket relay alerts
  useEffect(() => {
    localStorage.setItem("active_vehicle_segment", segment);

    const handleSocketAlert = (alert) => {
      // Exclude alerts from ourselves
      if (alert.vehicleId === vehicleId) return;

      const receivedAlert = {
        ...alert,
        receivedAt: new Date().toLocaleTimeString()
      };

      setV2vAlerts((prev) => [receivedAlert, ...prev].slice(0, 5));
    };

    socket.on("risk-alert", handleSocketAlert);

    return () => {
      socket.off("risk-alert", handleSocketAlert);
    };
  }, [segment]);

  const handleEmergencyBrake = () => {
    setBrakePressure(0.95);
    setAcceleration(-3.5);
    setSpeed((prev) => Math.max(0, prev - 25));
  };

  const handleSwerve = (dir) => {
    setSteeringAngle(dir === "left" ? -28 : 28);
    setLaneOffset(dir === "left" ? -0.75 : 0.75);
  };

  // Check if warning is adjacent or on our road segment
  const getAlertProximity = (alertSegment) => {
    if (alertSegment === segment) return "danger";
    const adjacents = ADJACENCY_MAP[segment] || [];
    if (adjacents.includes(alertSegment)) return "warning";
    return "distant";
  };

  // Determine current active vehicle alert parameters
  const currentRiskLevel = lastProcessed?.risk?.riskLevel || "low";
  const currentRiskScore = lastProcessed?.risk?.riskScore || 0;
  const currentRecommendation = lastProcessed?.risk?.recommendedAction || "continue_normal_driving";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 relative font-sans">
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-950/20 blur-[130px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto z-10 relative">
        
        {/* Header Block */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-5 mb-6 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-indigo-400">DriveMind</h1>
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-950/40 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
                Vehicle Active Mode
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live in-car cockpit telemetry transmitter and automated V2V collision alert hub
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-right">
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Vehicle Node ID</span>
              <span className="text-xs font-bold text-indigo-300 font-mono capitalize">{vehicleId} ({vehicleType})</span>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-900/50 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors font-bold"
            >
              Exit Cockpit
            </button>
          </div>
        </header>

        {/* HUD Warning Banner (Only shows when risk is high or critical) */}
        {(currentRiskLevel === "critical" || currentRiskLevel === "high") && (
          <div className="bg-red-950/45 border-2 border-red-500 rounded-xl p-4 mb-6 animate-pulse flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-sm font-bold text-red-300 uppercase tracking-wide">Collision Threat Alert ({currentRiskLevel} Risk)</h3>
                <p className="text-xs text-slate-350 mt-0.5">
                  AI predictions show immediate risk! Reasons: {lastProcessed?.risk?.reasons?.join(", ")?.replace(/_/g, " ")}.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Recommended Action</span>
              <span className="text-amber-400 font-extrabold text-xs capitalize bg-slate-950 px-3 py-1 rounded border border-slate-800 inline-block mt-1">
                {currentRecommendation.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        )}

        {/* Primary Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          
          {/* Main Visual Instrument Gauge Dashboard HUD (Left column) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Visual Cockpit HUD */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between h-[360px]">
              
              <div className="flex justify-between items-start z-10">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Virtual HUD Camera Scan</h3>
                  <p className="text-[10px] text-slate-500">Speed: {speed}km/h | Steer: {steeringAngle}° | Sector: {segment.toUpperCase()}</p>
                </div>
                
                {/* Connection check marker */}
                <div className="flex items-center space-x-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-850 text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${isStreaming ? "bg-cyan-500 animate-ping" : "bg-slate-700"}`}></span>
                  <span className="text-slate-400">{isStreaming ? `Streaming (Packets: ${streamCount})` : "Idle"}</span>
                </div>
              </div>

              {/* Road Horizon HUD Canvas */}
              <div className="relative w-full h-[180px] bg-slate-950 rounded-xl border border-slate-850 overflow-hidden flex flex-col justify-between p-4 my-2">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/15 via-slate-950 to-slate-950 pointer-events-none"></div>

                {/* Simulated Lane Boundaries */}
                <div className="absolute inset-x-0 bottom-0 h-[100px] flex justify-center pointer-events-none">
                  <div 
                    className="w-1.5 h-full bg-slate-800/80 origin-bottom transition-transform duration-200"
                    style={{
                      transform: `perspective(80px) rotateX(45deg) translateX(${(-laneOffset * 50) - (steeringAngle * 0.7)}px)`
                    }}
                  ></div>
                  <div className="w-[110px] h-full flex justify-between absolute bottom-0">
                    <div 
                      className="w-1 h-full bg-slate-400 origin-bottom-left transition-transform duration-200"
                      style={{
                        transform: `perspective(80px) rotateX(45deg) rotateY(-12deg) translateX(${-laneOffset * 55}px)`
                      }}
                    ></div>
                    <div 
                      className="w-1 h-full bg-slate-400 origin-bottom-right transition-transform duration-200"
                      style={{
                        transform: `perspective(80px) rotateX(45deg) rotateY(12deg) translateX(${-laneOffset * 55}px)`
                      }}
                    ></div>
                  </div>
                </div>

                {/* HUD Central Aiming Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full border border-dashed border-cyan-500/25 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-500/40"></div>
                  </div>
                </div>

                {/* Swerving graphic */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                  <div 
                    className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-transparent transition-transform duration-200"
                    style={{ transform: `rotate(${steeringAngle}deg)` }}
                  ></div>
                </div>
              </div>

              {/* Resolution Metrics from collective memory lookup */}
              <div className="bg-slate-950/90 border border-slate-850 rounded-xl p-3 flex justify-between items-center text-xs z-10 gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🧠</span>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">V2X Experience Recommendation</span>
                    {lastProcessed?.collectiveRecommendation ? (
                      <p className="text-cyan-300 font-bold">
                        Avoid danger with:{" "}
                        <span className="text-amber-400 capitalize">
                          {lastProcessed.collectiveRecommendation.action?.replace(/_/g, " ")}
                        </span>
                      </p>
                    ) : (
                      <p className="text-slate-500 italic text-[10px]">No historical hazard logs recorded for this grid segment.</p>
                    )}
                  </div>
                </div>
                
                {lastProcessed?.collectiveRecommendation && (
                  <span className="bg-cyan-500/10 border border-cyan-900/40 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    Strength: {lastProcessed.collectiveRecommendation.resolvedCount} Resolved
                  </span>
                )}
              </div>

            </div>

            {/* Quick-action HUD steering widgets */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-slate-200">Sensor Assist Widgets</span>
                <p className="text-[10px] text-slate-500">Quickly swerve or trigger emergency deceleration logs</p>
              </div>

              <div className="flex space-x-2.5">
                <button
                  onClick={() => handleSwerve("left")}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  ↩ Swerve Left
                </button>
                <button
                  onClick={() => handleSwerve("right")}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Swerve Right ↪
                </button>
                <button
                  onClick={handleEmergencyBrake}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-900 px-3.5 py-2 rounded-lg cursor-pointer transition-colors font-bold"
                >
                  Slam Brakes 🚨
                </button>
              </div>
            </div>

          </div>

          {/* V2V Warnings & Alerts Feed (Right Column) */}
          <div className="lg:col-span-5 flex flex-col justify-between h-[444px]">
            
            {/* Live OTA Warnings Feed */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5 flex-1 overflow-hidden flex flex-col">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live V2V Proximity Alert Feed</h3>
                <p className="text-[10px] text-slate-500">Proactive over-the-air threat signals received from nearby drivers</p>
              </div>

              <div className="space-y-3 overflow-auto flex-1 pr-1.5">
                {v2vAlerts.length > 0 ? (
                  v2vAlerts.map((alert, index) => {
                    const proximity = getAlertProximity(alert.roadSegmentId);
                    return (
                      <div
                        key={index}
                        className={`border rounded-xl p-3.5 text-xs relative overflow-hidden transition-all ${
                          proximity === "danger" 
                            ? "bg-red-500/10 border-red-500 text-red-300" 
                            : proximity === "warning" 
                            ? "bg-amber-500/10 border-amber-600 text-amber-300"
                            : "bg-slate-950 border-slate-850 text-slate-400"
                        }`}
                      >
                        {/* Pulse indicator */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${
                          proximity === "danger" ? "bg-red-500" : proximity === "warning" ? "bg-amber-500" : "bg-slate-700"
                        }`}></div>

                        <div className="flex justify-between items-center text-[9px] font-bold mb-1 uppercase tracking-wider">
                          <span>
                            {proximity === "danger" && "⚠️ DANGER: Current Segment Alert"}
                            {proximity === "warning" && "⚡ WARNING: Adjacent Sector Alert"}
                            {proximity === "distant" && "📡 INFO: Distant Sector Event"}
                          </span>
                          <span className="font-mono text-slate-550">{alert.receivedAt}</span>
                        </div>

                        <p className="font-semibold text-slate-200 mt-1.5">{alert.message}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-850/60 text-[10px] text-slate-500">
                          <p>Source: <span className="font-bold text-slate-400">{alert.vehicleId}</span></p>
                          <p className="text-right">Sector: <span className="font-bold text-slate-450 uppercase">{alert.roadSegmentId}</span></p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 text-slate-650 flex flex-col items-center justify-center h-full">
                    <span className="text-4xl block mb-2 opacity-30">📡</span>
                    <p className="text-xs font-semibold">Active OTA transceiver monitoring nearby grids...</p>
                    <p className="text-[9px] text-slate-750 max-w-[200px] mt-1.5 leading-relaxed">
                      No warning signals received yet. Toggle "Auto-Stream" and simulate speed or swerve to trigger tests.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* In-Car status indicator footer */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 flex justify-between items-center text-[10px] text-slate-500 mt-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="font-semibold">V2X Radio Transceiver Active</span>
              </div>
              <span className="capitalize font-mono">Channel: 5.9 GHz DSRC</span>
            </div>

          </div>

        </div>

        {/* Simulated Physical Sensor Sliders (Bottom row) */}
        <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 border-b border-slate-850 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulated OBD-II / ADAS Sensor Inputs</h3>
              <p className="text-[10px] text-slate-500">Tweak vehicle telemetry attributes to stream real-time data</p>
            </div>

            <div className="flex gap-4 items-center">
              <div>
                <label className="text-[10px] text-slate-500 uppercase block mb-1">Simulated Grid Location</label>
                <select
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    localStorage.setItem("active_vehicle_segment", e.target.value);
                  }}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 text-slate-300"
                >
                  <option value="curve_42">Gateway (Curve-42)</option>
                  <option value="highway_101">Marine Drive (Highway-101)</option>
                  <option value="intersection_alpha">Crawford (Intersection-Alpha)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase block mb-1">Weather Climate Conditions</label>
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 text-slate-300"
                >
                  <option value="clear">Clear</option>
                  <option value="rain">Heavy Rain</option>
                  <option value="fog">Thick Fog</option>
                  <option value="snow">Snow/Freeze</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            
            {/* Speed slider */}
            <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between text-[10px] text-slate-450 mb-1">
                <span>Speed Sensor</span>
                <span className="text-cyan-400 font-mono font-bold">{speed} km/h</span>
              </div>
              <input 
                type="range" min="0" max="120" value={speed} 
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full h-1 bg-slate-850 rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Steering angle */}
            <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between text-[10px] text-slate-450 mb-1">
                <span>Steering Angle</span>
                <span className="text-indigo-400 font-mono font-bold">{steeringAngle}°</span>
              </div>
              <input 
                type="range" min="-45" max="45" value={steeringAngle} 
                onChange={(e) => setSteeringAngle(Number(e.target.value))}
                className="w-full h-1 bg-slate-850 rounded appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Lane Offset */}
            <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between text-[10px] text-slate-450 mb-1">
                <span>Lane Offset</span>
                <span className="text-violet-400 font-mono font-bold">{laneOffset} m</span>
              </div>
              <input 
                type="range" min="-1.5" max="1.5" step="0.1" value={laneOffset} 
                onChange={(e) => setLaneOffset(Number(e.target.value))}
                className="w-full h-1 bg-slate-850 rounded appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Gap Radar */}
            <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between text-[10px] text-slate-450 mb-1">
                <span>Gap Radar</span>
                <span className="text-emerald-400 font-mono font-bold">{distance} m</span>
              </div>
              <input 
                type="range" min="2" max="100" value={distance} 
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full h-1 bg-slate-850 rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Acceleration */}
            <div className="bg-slate-950/45 p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between text-[10px] text-slate-450 mb-1">
                <span>Acceleration</span>
                <span className="text-slate-400 font-mono font-bold">{acceleration} m/s²</span>
              </div>
              <input 
                type="range" min="-5" max="5" step="0.1" value={acceleration} 
                onChange={(e) => setAcceleration(Number(e.target.value))}
                className="w-full h-1 bg-slate-850 rounded appearance-none cursor-pointer accent-slate-400"
              />
            </div>

          </div>

          {/* Controls Footer */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="hud-auto-stream"
                checked={isStreaming}
                onChange={(e) => {
                  setIsStreaming(e.target.checked);
                  setStreamCount(0);
                }}
                className="w-4 h-4 rounded border-slate-850 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <div>
                <label htmlFor="hud-auto-stream" className="text-xs font-bold text-slate-350 block cursor-pointer">
                  Auto-Stream HUD Telemetry (1Hz)
                </label>
                <span className="text-[10px] text-slate-550">Simulates real-time CAN bus telemetry transmission</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleTransmit}
                disabled={isStreaming}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer ${
                  isStreaming 
                    ? "bg-slate-900 text-slate-655 border border-slate-850" 
                    : "bg-indigo-500 hover:bg-indigo-400 text-slate-950"
                }`}
              >
                Transmit Telemetry Packet
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="text-[11px] text-red-400 bg-red-950/20 border border-red-900/40 rounded p-2.5 mt-3">
              ⚠️ {errorMessage}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default VehicleDashboard;
