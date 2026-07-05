import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import { CHANDIGARH_COORDINATES } from "../config/roadSegments";

// Custom Leaflet marker icons with dynamic hue rotations
const getMarkerIcon = (avgRisk) => {
  let hueClass = "hue-rotate-[120deg]"; // Low Risk: Green
  if (avgRisk >= 0.85) {
    hueClass = "hue-rotate-[0deg] filter saturate-200 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"; // Critical: Red
  } else if (avgRisk >= 0.6) {
    hueClass = "hue-rotate-[35deg] filter saturate-150 drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]"; // High: Orange
  } else if (avgRisk >= 0.4) {
    hueClass = "hue-rotate-[70deg] filter saturate-150 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]"; // Medium: Yellow
  }

  return L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    className: `${hueClass} transition-all duration-300`
  });
};

function RiskMap({ experiences = [], latestAlert, onSelectSegment }) {
  // Local states
  const [weatherFilter, setWeatherFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [mapViewType, setMapViewType] = useState("marker"); // 'marker' or 'heatmap'

  useEffect(() => {
    // Dynamic Leaflet CSS injection
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Filter experiences
  const getFilteredExperiences = () => {
    return experiences.filter((exp) => {
      if (weatherFilter !== "all" && exp.weather !== weatherFilter) return false;

      if (riskFilter !== "all") {
        const score = exp.riskScore || 0;
        if (riskFilter === "critical" && score < 0.85) return false;
        if (riskFilter === "high" && (score < 0.6 || score >= 0.85)) return false;
        if (riskFilter === "medium" && (score < 0.4 || score >= 0.6)) return false;
        if (riskFilter === "low" && score >= 0.4) return false;
      }

      if (intentFilter !== "all" && exp.eventType !== intentFilter) return false;

      return true;
    });
  };

  const filteredExps = getFilteredExperiences();

  // Aggregate stats per roadSegmentId
  const getSegmentStats = (segmentId) => {
    const segmentExps = filteredExps.filter((e) => e.roadSegmentId === segmentId);

    // Read latest lat/lng from experiences or fall back to predefined config coordinates
    const configSegment = CHANDIGARH_COORDINATES[segmentId] || { name: segmentId, center: [30.7333, 76.7794], roadType: "unknown" };
    let finalCenter = configSegment.center;

    // Use lat/lng resolved from MongoDB experience record if available
    const expsWithCoords = segmentExps.filter(e => e.latitude && e.longitude);
    if (expsWithCoords.length > 0) {
      finalCenter = [expsWithCoords[0].latitude, expsWithCoords[0].longitude];
    }

    if (segmentExps.length === 0) {
      return {
        count: 0,
        avgRisk: 0,
        commonIntent: "N/A",
        commonWeather: "N/A",
        latestAction: "N/A",
        lastUpdated: "N/A",
        center: finalCenter,
        name: configSegment.name,
        history: []
      };
    }

    const sumRisk = segmentExps.reduce((sum, e) => sum + (e.riskScore || 0), 0);
    const avgRisk = Number((sumRisk / segmentExps.length).toFixed(2));

    const mode = (arr) => {
      if (arr.length === 0) return "N/A";
      const counts = {};
      let maxVal = arr[0], maxCount = 1;
      for (let i = 0; i < arr.length; i++) {
        const val = arr[i];
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] > maxCount) {
          maxVal = val;
          maxCount = counts[val];
        }
      }
      return maxVal;
    };

    const intents = segmentExps.map((e) => e.eventType || "normal");
    const weathers = segmentExps.map((e) => e.weather || "clear");

    const sorted = [...segmentExps].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestAction = sorted[0].recommendedAction || "N/A";
    const lastUpdated = sorted[0].createdAt 
      ? new Date(sorted[0].createdAt).toLocaleTimeString() 
      : "N/A";

    return {
      count: segmentExps.length,
      avgRisk,
      commonIntent: mode(intents),
      commonWeather: mode(weathers),
      latestAction,
      lastUpdated,
      center: finalCenter,
      name: configSegment.name,
      history: sorted
    };
  };

  const getRiskColor = (avgRisk) => {
    if (avgRisk === 0) return "#10b981"; // Safe Green
    if (avgRisk >= 0.85) return "#ef4444"; // Critical Red
    if (avgRisk >= 0.6) return "#f97316"; // High Orange
    if (avgRisk >= 0.4) return "#eab308"; // Medium Yellow
    return "#10b981"; // Low Green
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      
      {/* Filtering Select Controls & Map Toggles */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850 text-[10.5px]">
        
        {/* Filters */}
        <div className="grid grid-cols-3 gap-2 flex-1">
          <div>
            <label className="text-[9px] text-slate-500 block uppercase font-bold mb-1 font-sans">Weather Filter</label>
            <select
              value={weatherFilter}
              onChange={(e) => setWeatherFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-350"
            >
              <option value="all">All Weather</option>
              <option value="clear">Clear</option>
              <option value="rain">Rain</option>
              <option value="fog">Fog</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] text-slate-500 block uppercase font-bold mb-1 font-sans">Risk Filter</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-355"
            >
              <option value="all">All Risks</option>
              <option value="low">Low (&lt; 0.4)</option>
              <option value="medium">Medium (0.4-0.6)</option>
              <option value="high">High (0.6-0.85)</option>
              <option value="critical">Critical (&gt;= 0.85)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] text-slate-500 block uppercase font-bold mb-1 font-sans">Intent Filter</label>
            <select
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-slate-350"
            >
              <option value="all">All Intents</option>
              <option value="near_miss">Near Miss</option>
              <option value="sudden_braking">Sudden Braking</option>
              <option value="sharp_turn_risk">Sharp Turn</option>
              <option value="high_speed_risk">High Speed</option>
            </select>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-1.5 bg-slate-900 p-1 border border-slate-800 rounded-lg">
          <button
            onClick={() => setMapViewType("marker")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              mapViewType === "marker" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            Markers
          </button>
          <button
            onClick={() => setMapViewType("heatmap")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              mapViewType === "heatmap" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            Rings (Heatmap)
          </button>
        </div>

      </div>

      {/* Map Frame centered in Chandigarh */}
      <div className="w-full flex-1 rounded-xl overflow-hidden border border-slate-850 shadow-inner relative z-0 h-[280px]">
        <MapContainer
          center={[30.7333, 76.7794]} // Chandigarh Center
          zoom={12}
          style={{ width: "100%", height: "100%", background: "#0b1329" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Render Chandigarh predefined coordinate mapping */}
          {Object.keys(CHANDIGARH_COORDINATES).map((id) => {
            const stats = getSegmentStats(id);
            const color = getRiskColor(stats.avgRisk);

            return mapViewType === "heatmap" ? (
              <Circle
                key={id}
                center={stats.center}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.35,
                  weight: 2
                }}
                radius={400}
                eventHandlers={{
                  click: () => onSelectSegment?.(id, stats)
                }}
              >
                <Popup>
                  <div className="bg-slate-900 text-slate-100 p-2.5 rounded-md font-sans text-xs min-w-[170px]">
                    <h4 className="font-bold text-cyan-400 border-b border-slate-700 pb-1 mb-1">{stats.name}</h4>
                    <p><strong>Incidents:</strong> {stats.count}</p>
                    <p><strong>Avg Risk Score:</strong> {stats.avgRisk}</p>
                    <p className="capitalize"><strong>Intent:</strong> {stats.commonIntent?.replace(/_/g, " ")}</p>
                    <p className="capitalize"><strong>Weather:</strong> {stats.commonWeather}</p>
                    <p className="capitalize"><strong>Action:</strong> {stats.latestAction?.replace(/_/g, " ")}</p>
                    <p><strong>Last Update:</strong> {stats.lastUpdated}</p>
                    <p className="text-[8.5px] text-slate-500 border-t border-slate-800/80 pt-1 mt-1.5 italic text-center">
                      Click to inspect telemetry records
                    </p>
                  </div>
                </Popup>
              </Circle>
            ) : (
              <Marker
                key={id}
                position={stats.center}
                icon={getMarkerIcon(stats.avgRisk)}
                eventHandlers={{
                  click: () => onSelectSegment?.(id, stats)
                }}
              >
                <Popup>
                  <div className="bg-slate-900 text-slate-100 p-2.5 rounded-md font-sans text-xs min-w-[170px]">
                    <h4 className="font-bold text-cyan-400 border-b border-slate-700 pb-1 mb-1">{stats.name}</h4>
                    <p><strong>Incidents:</strong> {stats.count}</p>
                    <p><strong>Avg Risk Score:</strong> {stats.avgRisk}</p>
                    <p className="capitalize"><strong>Intent:</strong> {stats.commonIntent?.replace(/_/g, " ")}</p>
                    <p className="capitalize"><strong>Weather:</strong> {stats.commonWeather}</p>
                    <p className="capitalize"><strong>Action:</strong> {stats.latestAction?.replace(/_/g, " ")}</p>
                    <p><strong>Last Update:</strong> {stats.lastUpdated}</p>
                    <p className="text-[8.5px] text-slate-500 border-t border-slate-800/80 pt-1 mt-1.5 italic text-center">
                      Click to inspect telemetry records
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
}

export default RiskMap;
