import { useState, useEffect, useRef } from "react";
import { sendTelemetry } from "../api/backendApi";

function VehicleCockpit() {
  // Sensor states
  const [speed, setSpeed] = useState(50);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [brakePressure, setBrakePressure] = useState(0);
  const [laneOffset, setLaneOffset] = useState(0);
  const [distance, setDistance] = useState(40);
  const [acceleration, setAcceleration] = useState(0.2);
  const [weather, setWeather] = useState("clear");
  const [segment, setSegment] = useState("curve_42");

  // Streaming & API states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [apiResponse, setApiResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Scenario states
  const [activeScenario, setActiveScenario] = useState(null);
  const [scenarioFrameIdx, setScenarioFrameIdx] = useState(0);
  const [isPlayingScenario, setIsPlayingScenario] = useState(false);
  const [multiVehicleMode, setMultiVehicleMode] = useState(false);

  const streamIntervalRef = useRef(null);
  const scenarioIntervalRef = useRef(null);

  const activeVehicleId = localStorage.getItem("active_vehicle_id") || "legacy_vehicle_sim";

  // Pre-configured simulation scenarios
  const scenarios = {
    tailgate: {
      name: "Unsafe Tailgating (car_1 followed by car_2)",
      description: "Simulates one vehicle rapidly approaching the rear of another at high speed.",
      frames: [
        { speed: 60, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 75, weather: "clear", segment: "highway_101" },
        { speed: 60, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 50, weather: "clear", segment: "highway_101" },
        { speed: 60, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 30, weather: "clear", segment: "highway_101" },
        { speed: 60, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 18, weather: "clear", segment: "highway_101" },
        { speed: 60, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 8, weather: "clear", segment: "highway_101" },
        { speed: 60, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 4, weather: "clear", segment: "highway_101" }
      ]
    },
    curve: {
      name: "Sharp Curve Drift (curve_42 overspeed)",
      description: "Simulates a vehicle losing lateral grip by speeding through a sharp bend.",
      frames: [
        { speed: 45, acceleration: 0.5, brakePressure: 0, steeringAngle: 5, laneOffset: 0.1, distance: 80, weather: "clear", segment: "curve_42" },
        { speed: 55, acceleration: 0.8, brakePressure: 0, steeringAngle: 12, laneOffset: 0.3, distance: 80, weather: "clear", segment: "curve_42" },
        { speed: 65, acceleration: 1.0, brakePressure: 0, steeringAngle: 20, laneOffset: 0.6, distance: 80, weather: "clear", segment: "curve_42" },
        { speed: 72, acceleration: 0.5, brakePressure: 0, steeringAngle: 25, laneOffset: 1.0, distance: 80, weather: "clear", segment: "curve_42" },
        { speed: 78, acceleration: -0.2, brakePressure: 0, steeringAngle: 28, laneOffset: 1.3, distance: 80, weather: "clear", segment: "curve_42" },
        { speed: 82, acceleration: -0.5, brakePressure: 0.2, steeringAngle: 30, laneOffset: 1.5, distance: 80, weather: "clear", segment: "curve_42" }
      ]
    },
    weather: {
      name: "Thick Fog Emergency Braking",
      description: "Simulates a vehicle hitting the brakes due to zero visibility in thick fog.",
      frames: [
        { speed: 65, acceleration: 0, brakePressure: 0, steeringAngle: 0, laneOffset: 0, distance: 90, weather: "fog", segment: "intersection_alpha" },
        { speed: 60, acceleration: -0.5, brakePressure: 0.2, steeringAngle: 0, laneOffset: 0, distance: 60, weather: "fog", segment: "intersection_alpha" },
        { speed: 50, acceleration: -1.2, brakePressure: 0.5, steeringAngle: 0, laneOffset: 0, distance: 35, weather: "fog", segment: "intersection_alpha" },
        { speed: 35, acceleration: -2.5, brakePressure: 0.8, steeringAngle: 0, laneOffset: 0, distance: 18, weather: "fog", segment: "intersection_alpha" },
        { speed: 15, acceleration: -3.5, brakePressure: 0.95, steeringAngle: 0, laneOffset: 0, distance: 8, weather: "fog", segment: "intersection_alpha" },
        { speed: 0, acceleration: -3.5, brakePressure: 0.95, steeringAngle: 0, laneOffset: 0, distance: 5, weather: "fog", segment: "intersection_alpha" }
      ]
    }
  };

  const handleTransmit = async (overridePayload = null) => {
    setErrorMessage("");
    const payload = overridePayload || {
      vehicleId: activeVehicleId,
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
      setApiResponse(response.data);
      if (isStreaming && !overridePayload) {
        setStreamCount((prev) => prev + 1);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Failed to transmit telemetry package");
      setIsStreaming(false);
      setIsPlayingScenario(false);
    }
  };

  // Playback execution loop
  useEffect(() => {
    if (isPlayingScenario && activeScenario) {
      const scenarioData = scenarios[activeScenario];
      const frame = scenarioData.frames[scenarioFrameIdx];

      // Update cockpit sliders to reflect scenario state visually
      setSpeed(frame.speed);
      setSteeringAngle(frame.steeringAngle);
      setBrakePressure(frame.brakePressure);
      setLaneOffset(frame.laneOffset);
      setDistance(frame.distance);
      setAcceleration(frame.acceleration);
      setWeather(frame.weather);
      setSegment(frame.segment);

      // Transmit primary vehicle
      handleTransmit({
        vehicleId: `${activeVehicleId}_sim_lead`,
        roadSegmentId: frame.segment,
        speed: frame.speed,
        acceleration: frame.acceleration,
        brakePressure: frame.brakePressure,
        steeringAngle: frame.steeringAngle,
        laneOffset: frame.laneOffset,
        distanceToFrontVehicle: frame.distance,
        weather: frame.weather
      });

      // Transmit auxiliary follower vehicle if Multi-Vehicle simulation mode is active
      if (multiVehicleMode) {
        setTimeout(() => {
          handleTransmit({
            vehicleId: `${activeVehicleId}_sim_follow`,
            roadSegmentId: frame.segment,
            speed: Math.max(0, frame.speed - 12),
            acceleration: frame.acceleration,
            brakePressure: Math.min(1.0, frame.brakePressure * 0.8),
            steeringAngle: frame.steeringAngle,
            laneOffset: Math.max(-1.5, frame.laneOffset - 0.3),
            distanceToFrontVehicle: Math.min(100, frame.distance + 15),
            weather: frame.weather
          });
        }, 300);
      }

      scenarioIntervalRef.current = setTimeout(() => {
        if (scenarioFrameIdx < scenarioData.frames.length - 1) {
          setScenarioFrameIdx((prev) => prev + 1);
        } else {
          setIsPlayingScenario(false);
          setActiveScenario(null);
        }
      }, 1200);
    }

    return () => {
      if (scenarioIntervalRef.current) {
        clearTimeout(scenarioIntervalRef.current);
      }
    };
  }, [isPlayingScenario, scenarioFrameIdx, activeScenario, multiVehicleMode]);

  // Manage automated streaming interval
  useEffect(() => {
    if (isStreaming && !isPlayingScenario) {
      handleTransmit();
      streamIntervalRef.current = setInterval(() => {
        handleTransmit();
      }, 1000);
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
  }, [isStreaming, isPlayingScenario, speed, steeringAngle, brakePressure, laneOffset, distance, acceleration, weather, segment]);

  const startScenario = (key) => {
    setIsStreaming(false);
    setActiveScenario(key);
    setScenarioFrameIdx(0);
    setIsPlayingScenario(true);
  };

  const handleEmergencyBrake = () => {
    setBrakePressure(0.95);
    setAcceleration(-3.5);
    setSpeed((prev) => Math.max(0, prev - 25));
  };

  const handleQuickTurn = (dir) => {
    setSteeringAngle(dir === "left" ? -28 : 28);
    setLaneOffset(dir === "left" ? -0.7 : 0.7);
  };

  const handleResetSensors = () => {
    setSpeed(50);
    setSteeringAngle(0);
    setBrakePressure(0);
    setLaneOffset(0);
    setDistance(40);
    setAcceleration(0.2);
    setWeather("clear");
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Cockpit HUD and Live Metrics (Lefthand Column) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xl font-bold text-slate-100">Vehicle Cockpit HUD</h3>
              <span className="text-[10px] text-slate-500 font-bold font-mono">ID: {activeVehicleId}</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Real-time driver cockpit telemetry feed. Adjust the sliders to simulate live physical sensor updates.
            </p>
          </div>

          {/* Virtual Camera HUD */}
          <div className="relative w-full h-[220px] bg-slate-950 rounded-2xl border border-slate-850 overflow-hidden flex flex-col justify-between p-4">
            {/* Horizon Sky */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950 z-0 pointer-events-none"></div>

            {/* Lane Lines */}
            <div className="absolute inset-x-0 bottom-0 h-[120px] flex justify-center z-10 pointer-events-none">
              <div 
                className="w-1.5 h-full bg-slate-800/80 origin-bottom transition-transform duration-200"
                style={{
                  transform: `perspective(100px) rotateX(45deg) translateX(${(-laneOffset * 60) - (steeringAngle * 0.8)}px)`
                }}
              ></div>
              <div className="w-[120px] h-full flex justify-between absolute bottom-0">
                <div 
                  className="w-1 h-full bg-slate-400 origin-bottom-left transition-transform duration-200"
                  style={{
                    transform: `perspective(100px) rotateX(45deg) rotateY(-15deg) translateX(${-laneOffset * 65}px)`
                  }}
                ></div>
                <div 
                  className="w-1 h-full bg-slate-400 origin-bottom-right transition-transform duration-200"
                  style={{
                    transform: `perspective(100px) rotateX(45deg) rotateY(15deg) translateX(${-laneOffset * 65}px)`
                  }}
                ></div>
              </div>
            </div>

            {/* Dashboard Indicators overlay */}
            <div className="flex justify-between items-start z-20">
              <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1.5 text-center min-w-[70px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Speed</span>
                <span className="text-md font-extrabold text-cyan-400 font-mono">{speed}</span>
                <span className="text-[8px] text-slate-500 font-semibold block">km/h</span>
              </div>

              <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1.5 text-center min-w-[70px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Steer</span>
                <span className="text-md font-extrabold text-indigo-400 font-mono">{steeringAngle}°</span>
                <span className="text-[8px] text-slate-500 font-semibold block">angle</span>
              </div>

              <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1.5 text-center min-w-[70px]">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Safety Gap</span>
                <span className="text-md font-extrabold text-emerald-400 font-mono">{distance}m</span>
                <span className="text-[8px] text-slate-500 font-semibold block">front</span>
              </div>
            </div>

            {/* Virtual Steering Wheel Graphic */}
            <div className="flex justify-center items-end h-full z-20 mb-2">
              <div 
                className="w-14 h-14 rounded-full border-4 border-slate-700/80 border-t-transparent flex items-center justify-center transition-transform duration-200"
                style={{ transform: `rotate(${steeringAngle}deg)` }}
              >
                <div className="w-1 h-6 bg-slate-500"></div>
              </div>
            </div>

            {/* Alert bar inside HUD */}
            {apiResponse && apiResponse.risk?.riskScore >= 0.6 && (
              <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-950/90 border border-red-800 rounded-lg px-4 py-2 text-center z-30 animate-pulse">
                <span className="text-xs font-bold text-red-400 block">⚠️ DANGER ALERT: {apiResponse.risk?.riskLevel.toUpperCase()}</span>
                <span className="text-[10px] text-slate-350">{apiResponse.risk?.reasons?.[0] || "Critical deviation detected"}</span>
              </div>
            )}
          </div>

          {/* AI Decision Panel */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col justify-between min-h-[160px]">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">AI Edge Intent & Threat Index</span>
              
              {apiResponse ? (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] uppercase text-slate-500">Predicted Driver Intent</p>
                      <p className="text-md font-extrabold text-cyan-300 capitalize mt-0.5">
                        {apiResponse.intentPrediction?.predictedIntent?.replace("_", " ")}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Confidence: {Math.round(apiResponse.intentPrediction?.confidence * 100)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-500">Evaluated Risk Score</p>
                      <p className="text-md font-extrabold text-amber-400 mt-0.5">{apiResponse.risk?.riskScore}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Level: <span className="capitalize font-bold text-amber-300">{apiResponse.risk?.riskLevel}</span></p>
                    </div>
                  </div>
                  
                  {/* Actionable recommendations card */}
                  <div className="border-t border-slate-900 pt-2 text-[11px]">
                    <span className="font-bold text-slate-400 block mb-1">Recommended Action:</span>
                    <p className="text-amber-300 font-semibold">{apiResponse.risk?.recommendations?.[0] || "Continue normal driving."}</p>
                    {apiResponse.risk?.pastIncidentsCount !== undefined && (
                      <span className="text-[9px] text-slate-500 block mt-1">
                        * Segment historical incidents count: <span className="text-slate-350 font-bold font-mono">{apiResponse.risk?.pastIncidentsCount} logged</span>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-600 text-xs py-8 text-center">
                  Sensor stream inactive. Click Transmit or toggle Scenario Playback.
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/40 rounded p-1.5 mt-2">
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Sliders Configuration & Playback (Righthand Column) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Virtual Scenarios Playback Card */}
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Interactive Scenario Playbacks</h4>
                <p className="text-[10px] text-slate-500">Trigger multi-vehicle simulation sequences</p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="multi-veh-toggle"
                  checked={multiVehicleMode}
                  onChange={(e) => setMultiVehicleMode(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="multi-veh-toggle" className="text-[10px] font-bold text-slate-400 cursor-pointer">
                  Multi-Vehicle Sim (2 Cars)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {Object.keys(scenarios).map((key) => (
                <button
                  key={key}
                  onClick={() => startScenario(key)}
                  disabled={isPlayingScenario}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    activeScenario === key
                      ? "bg-cyan-500/10 border-cyan-500/80 text-cyan-300"
                      : "bg-slate-900/50 border-slate-900 hover:border-slate-800 text-slate-350"
                  }`}
                >
                  <span className="text-[11px] font-bold block mb-1">
                    {key === "tailgate" ? "🚗 Unsafe Tailgating" : key === "curve" ? "🌀 Curve Overspeed" : "🌫️ Fog Braking"}
                  </span>
                  <span className="text-[9px] text-slate-500 leading-tight block">
                    {scenarios[key].description.slice(0, 52)}...
                  </span>
                </button>
              ))}
            </div>

            {isPlayingScenario && (
              <div className="mt-3 flex justify-between items-center bg-slate-900/40 border border-slate-900 rounded-lg px-3 py-2 text-xs">
                <span className="text-cyan-400 font-bold animate-pulse">Running Playback: {scenarios[activeScenario].name}</span>
                <span className="text-[10px] text-slate-500 font-mono">Frame {scenarioFrameIdx + 1}/6</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-950/40 border border-slate-850 rounded-xl p-3 text-xs mb-2">
            <div>
              <span className="text-[10px] text-slate-500 block mb-1">Route Node</span>
              <select 
                value={segment} 
                onChange={(e) => setSegment(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-md px-2 py-1 focus:outline-none w-full text-slate-300"
              >
                <option value="curve_42">Gateway Curve (Curve-42)</option>
                <option value="highway_101">Marine Drive (Highway-101)</option>
                <option value="intersection_alpha">Crawford (Intersection-Alpha)</option>
              </select>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-1">Climate Condition</span>
              <select 
                value={weather} 
                onChange={(e) => setWeather(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-md px-2 py-1 focus:outline-none w-full text-slate-300 capitalize"
              >
                <option value="clear">Clear Skies</option>
                <option value="rain">Heavy Rain</option>
                <option value="fog">Thick Fog</option>
                <option value="snow">Snow/Freeze</option>
              </select>
            </div>
          </div>

          {/* Speed slider */}
          <div className="bg-slate-950/20 border border-slate-850/50 rounded-xl p-3.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>Speed Sensor (speed)</span>
              <span className="text-cyan-400 font-mono">{speed} km/h</span>
            </div>
            <input 
              type="range" min="0" max="120" value={speed} 
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Steering Angle */}
          <div className="bg-slate-950/20 border border-slate-850/50 rounded-xl p-3.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>Steering Wheel Angle (steeringAngle)</span>
              <span className="text-indigo-400 font-mono">{steeringAngle}°</span>
            </div>
            <input 
              type="range" min="-45" max="45" value={steeringAngle} 
              onChange={(e) => setSteeringAngle(Number(e.target.value))}
              className="w-full h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Lane Offset */}
          <div className="bg-slate-950/20 border border-slate-850/50 rounded-xl p-3.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>Lane Alignment Offset (laneOffset)</span>
              <span className="text-violet-400 font-mono">{laneOffset} meters</span>
            </div>
            <input 
              type="range" min="-1.5" max="1.5" step="0.1" value={laneOffset} 
              onChange={(e) => setLaneOffset(Number(e.target.value))}
              className="w-full h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Gap Distance */}
          <div className="bg-slate-950/20 border border-slate-850/50 rounded-xl p-3.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>Front Vehicle Distance Radar (distanceToFrontVehicle)</span>
              <span className="text-emerald-400 font-mono">{distance} meters</span>
            </div>
            <input 
              type="range" min="2" max="100" value={distance} 
              onChange={(e) => setDistance(Number(e.target.value))}
              className="w-full h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Controls Widgets Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <button
              onClick={handleEmergencyBrake}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-900 text-red-400 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              🚨 Emergency Brake
            </button>
            <button
              onClick={() => handleQuickTurn("left")}
              className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
            >
              ↩ Swerve Left
            </button>
            <button
              onClick={() => handleQuickTurn("right")}
              className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
            >
              ↪ Swerve Right
            </button>
            <button
              onClick={handleResetSensors}
              className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-400 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
            >
              ↺ Reset Sensors
            </button>
          </div>

          {/* Stream Trigger Panel */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="auto-stream-toggle"
                checked={isStreaming}
                disabled={isPlayingScenario}
                onChange={(e) => {
                  setIsStreaming(e.target.checked);
                  setStreamCount(0);
                }}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
              />
              <div>
                <label htmlFor="auto-stream-toggle" className="text-xs font-bold text-slate-300 block cursor-pointer">
                  Auto-Stream Telemetry (1Hz)
                </label>
                <span className="text-[10px] text-slate-500">Pipes sensor arrays continuously every 1 second</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isStreaming && (
                <span className="text-xs text-cyan-400 font-mono font-bold animate-pulse">
                  Packets sent: {streamCount}
                </span>
              )}
              <button
                onClick={() => handleTransmit()}
                disabled={isStreaming || isPlayingScenario}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all ${
                  isStreaming || isPlayingScenario
                    ? "bg-slate-900 text-slate-600 border border-slate-850" 
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                }`}
              >
                Transmit Packet
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default VehicleCockpit;
