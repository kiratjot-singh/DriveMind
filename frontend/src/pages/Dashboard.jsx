import { useEffect, useState } from "react";
import {
  getAllExperiences,
  getGraphOverview,
  getHealthStatus,
  getRoadRisk,
  getRiskClusters,
  getExperienceStats,
  getSimilarSegments
} from "../api/backendApi";
import { socket } from "../socket/socketClient";
import RiskMap from "../components/RiskMap";
import VehicleCockpit from "./VehicleCockpit";
import VehicleAuth from "./VehicleAuth";
import V2VSharing from "./V2VSharing";

function Dashboard({ onLogout, user }) {
  // Navigation tabs: 'monitor', 'cockpit', 'auth', 'v2v'
  const [activeTab, setActiveTab] = useState("monitor");

  const [health, setHealth] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [roadRisk, setRoadRisk] = useState(null);
  const [graphRelationships, setGraphRelationships] = useState([]);
  const [riskClusters, setRiskClusters] = useState([]);
  const [latestAlert, setLatestAlert] = useState(null);
  
  const [selectedSegment, setSelectedSegment] = useState("curve_42");
  const [provisionedVehicleId, setProvisionedVehicleId] = useState("");

  const [stats, setStats] = useState(null);
  const [similarSegments, setSimilarSegments] = useState([]);

  const loadDashboardData = async () => {
    try {
      const healthData = await getHealthStatus();
      const experienceData = await getAllExperiences();
      const riskData = await getRoadRisk(selectedSegment);
      const graphData = await getGraphOverview();
      
      let clusterData = { data: [] };
      try {
        clusterData = await getRiskClusters();
      } catch (err) {
        console.warn("Failed to load Neo4j risk clusters:", err);
      }

      let statsData = null;
      try {
        statsData = await getExperienceStats();
      } catch (err) {
        console.warn("Failed to load experience stats:", err);
      }

      let similarityData = { data: [] };
      try {
        similarityData = await getSimilarSegments(selectedSegment);
      } catch (err) {
        console.warn("Failed to load similar segments:", err);
      }

      setHealth(healthData);
      setExperiences(experienceData.data || []);
      setRoadRisk(riskData);
      setGraphRelationships(graphData.data || []);
      setRiskClusters(clusterData.data || []);
      setStats(statsData?.stats || null);
      setSimilarSegments(similarityData.data || []);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  };

  const handleVehicleActivated = (vehicleId) => {
    setProvisionedVehicleId(vehicleId);
    // Auto shift user to the Cockpit simulator so they can start testing immediately
    setActiveTab("cockpit");
  };

  useEffect(() => {
    loadDashboardData();
    setProvisionedVehicleId(localStorage.getItem("active_vehicle_id") || "None (Legacy)");

    const handleSocketAlert = (alert) => {
      setLatestAlert(alert);
      loadDashboardData(); // reload ledgers on new events
    };

    socket.on("risk-alert", handleSocketAlert);

    return () => {
      socket.off("risk-alert", handleSocketAlert);
    };
  }, [selectedSegment]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 relative">
      {/* Background radial glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-950/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-950/20 blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto z-10 relative">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-900 pb-6 mb-8 gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-4xl font-extrabold tracking-tight text-cyan-400">DriveMind</h1>
              <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-900/40 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
                Control Hub
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Collective Memory Graph & Live Driver Intent Prediction Center
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-900/60 backdrop-blur-sm border border-slate-850 rounded-xl px-4 py-2.5">
            <div className="text-right">
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Operator Portal</span>
              <span className="text-xs font-bold text-slate-300">{user?.username || "administrator"}</span>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>
            <button
              onClick={onLogout}
              className="bg-red-500/15 hover:bg-red-500/25 border border-red-900/50 text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Tab Selection Navigation Bar */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-900 pb-4 mb-6">
          <button
            onClick={() => setActiveTab("monitor")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeTab === "monitor"
                ? "bg-cyan-500/10 border-cyan-500/80 text-cyan-400"
                : "bg-slate-900/45 border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            📊 System Monitor
          </button>
          
          <button
            onClick={() => setActiveTab("cockpit")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeTab === "cockpit"
                ? "bg-cyan-500/10 border-cyan-500/80 text-cyan-400"
                : "bg-slate-900/45 border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            🏎️ Sensor Simulator Cockpit
          </button>

          <button
            onClick={() => setActiveTab("auth")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeTab === "auth"
                ? "bg-cyan-500/10 border-cyan-500/80 text-cyan-400"
                : "bg-slate-900/45 border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            🔑 Vehicle Auth & Provisioning
          </button>

          <button
            onClick={() => setActiveTab("v2v")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeTab === "v2v"
                ? "bg-cyan-500/10 border-cyan-500/80 text-cyan-400"
                : "bg-slate-900/45 border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            📡 V2V Sharing warnings
          </button>
        </nav>

        {/* Tab Panels */}
        <main className="space-y-6">
          
          {/* TAB 1: System Monitor */}
          {activeTab === "monitor" && (
            <div className="space-y-6 animate-fade-in">
              {/* Core Badges Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Service Health</span>
                  <span className="text-md font-bold text-slate-200 mt-1 block">
                    {health ? health.status.toUpperCase() : "Pinging API..."}
                  </span>
                  {health && (
                    <span className="inline-block mt-2 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-900/30 rounded">
                      MongoDB: {health.databases?.mongodb} | Neo4j: {health.databases?.neo4j}
                    </span>
                  )}
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Segment Risk Level</span>
                  <span className="text-md font-bold text-slate-250 mt-1 block capitalize">
                    {selectedSegment.replace("_", " ")}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Index:{" "}
                    <span className={`font-bold ${
                      roadRisk?.riskLevel === "critical" || roadRisk?.riskLevel === "high" 
                        ? "text-red-400" 
                        : "text-emerald-400"
                    }`}>
                      {roadRisk?.riskLevel || "Low"}
                    </span>
                  </p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Shared Experiences</span>
                    <span className="text-2xl font-extrabold text-white mt-1 block">{experiences.length}</span>
                  </div>
                  <span className="text-[8px] text-slate-600 font-mono">Ledger Count in MongoDB</span>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Graph Relationships</span>
                    <span className="text-2xl font-extrabold text-white mt-1 block">{graphRelationships.length}</span>
                  </div>
                  <span className="text-[8px] text-slate-600 font-mono">Linked RDF Maps in Neo4j</span>
                </div>
              </div>

              {/* Map Panel */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-200">Proactive Road Hazards Map</h3>
                    <p className="text-xs text-slate-500">Live monitoring of road grids and vehicle warnings</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-slate-400 font-medium">Select Focus Grid:</label>
                    <select
                      value={selectedSegment}
                      onChange={(e) => {
                        setSelectedSegment(e.target.value);
                        localStorage.setItem("active_vehicle_segment", e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="curve_42">Gateway Curve (Curve-42)</option>
                      <option value="highway_101">Marine Drive (Highway-101)</option>
                      <option value="intersection_alpha">Crawford (Intersection-Alpha)</option>
                    </select>
                  </div>
                </div>
                <RiskMap activeRoadRisk={roadRisk} latestAlert={latestAlert} />
              </div>

              {/* Historical Trends & Dangerous Segments Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* SVG Risk trends over time */}
                <div className="md:col-span-8 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between min-h-[250px]">
                  <div>
                    <h3 className="text-lg font-bold text-slate-200 mb-1">Historical Risk Trends</h3>
                    <p className="text-xs text-slate-500">Hazard events distribution (last 7 days)</p>
                  </div>
                  
                  {stats && stats.dailyTrends && stats.dailyTrends.length > 0 ? (
                    <div className="h-[120px] flex items-end justify-between px-4 mt-4 relative">
                      {/* Grid background lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                        <div className="border-t border-slate-500 w-full"></div>
                        <div className="border-t border-slate-500 w-full"></div>
                        <div className="border-t border-slate-500 w-full"></div>
                      </div>
                      
                      {stats.dailyTrends.map((day, idx) => {
                        const heightPct = Math.round((day.avgRisk || 0) * 100);
                        return (
                          <div key={idx} className="flex flex-col items-center flex-1 mx-1.5 z-10">
                            <div className="text-[9px] text-cyan-400 font-mono mb-1">{(day.avgRisk || 0).toFixed(2)}</div>
                            <div 
                              className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all duration-500"
                              style={{ height: `${Math.max(10, heightPct)}px` }}
                            ></div>
                            <span className="text-[8px] text-slate-500 mt-2 font-mono">{day._id.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-850 rounded-xl text-slate-600 text-xs">
                      No historical trend data logged yet. Playback some scenarios.
                    </div>
                  )}
                </div>

                {/* Top dangerous segments */}
                <div className="md:col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-md font-bold text-slate-200 mb-1">Top Danger Sectors</h3>
                  <p className="text-xs text-slate-500 mb-4">Sectors ranked by incident frequency</p>
                  
                  <div className="space-y-3">
                    {stats && stats.topSegments && stats.topSegments.length > 0 ? (
                      stats.topSegments.map((seg, idx) => (
                        <div key={idx} className="text-xs">
                          <div className="flex justify-between font-bold text-slate-300 mb-1">
                            <span className="uppercase font-mono">{seg._id}</span>
                            <span>{seg.count} incidents</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-400 h-full rounded-full" 
                              style={{ width: `${(seg.avgRisk || 0) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-600 text-xs">
                        No sectors ranked yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Neo4j Hazard Clusters & Similar Segment Explorer */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Risk Clusters */}
                <div className="md:col-span-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-lg font-bold text-slate-200 mb-1">Neo4j Threat Clusters</h3>
                  <p className="text-xs text-slate-500 mb-4">Adjacent segments linked by identical hazards (Cypher similarity)</p>
                  
                  <div className="space-y-2.5 max-h-[250px] overflow-auto">
                    {riskClusters.length > 0 ? (
                      riskClusters.map((cluster, index) => (
                        <div
                          key={index}
                          className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs flex justify-between items-center"
                        >
                          <div>
                            <p className="font-bold text-slate-350">{cluster.segmentA} ↔ {cluster.segmentB}</p>
                            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                              Hazard: {cluster.sharedRiskType?.replace("_", " ")}
                            </p>
                          </div>
                          <span className="bg-cyan-500/10 border border-cyan-900/30 text-cyan-300 px-2 py-0.5 rounded text-[9px] font-bold">
                            Match Strength: {cluster.strength}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 border border-dashed border-slate-850 rounded-xl text-slate-600 text-xs">
                        No shared threat clusters calculated yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Similar road segment view explorer */}
                <div className="md:col-span-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-lg font-bold text-slate-200 mb-1">Similar Sector Threats</h3>
                  <p className="text-xs text-slate-500 mb-4">Other sectors sharing identical hazards to focus segment ({selectedSegment})</p>
                  
                  <div className="space-y-2.5 max-h-[250px] overflow-auto">
                    {similarSegments.length > 0 ? (
                      similarSegments.map((item, index) => (
                        <div
                          key={index}
                          className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs flex justify-between items-center"
                        >
                          <div>
                            <p className="font-bold text-slate-300 uppercase font-mono">{item.similarSegment}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Hazard: <span className="text-amber-400 capitalize">{item.sharedHazard?.replace(/_/g, " ")}</span></p>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded">
                            Logged {item.frequency} times
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 border border-dashed border-slate-850 rounded-xl text-slate-600 text-xs">
                        No other segments currently log similar threats to {selectedSegment}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mongo Ledger */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-lg font-bold text-slate-200 mb-1">Experience Memory Ledger</h3>
                <p className="text-xs text-slate-500 mb-4">Historical record list registered under MongoDB</p>
                
                <div className="space-y-3 max-h-[300px] overflow-auto">
                  {experiences.length > 0 ? (
                    experiences.map((experience) => (
                      <div
                        key={experience._id}
                        className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col sm:flex-row justify-between text-xs gap-3"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-200">{experience.vehicleId}</span>
                            <span className="bg-slate-800 text-slate-400 font-semibold uppercase text-[9px] px-1.5 py-0.5 rounded">
                              {experience.eventType?.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-slate-400 mt-2">
                            Sector: <span className="text-slate-200 uppercase font-mono">{experience.roadSegmentId}</span> | 
                            Weather: <span className="text-slate-200 capitalize">{experience.weather}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 italic mt-1">Reason: {experience.reason}</p>
                        </div>
                        <div className="text-left sm:text-right flex flex-col justify-between">
                          <div>
                            <span className="text-slate-500">Risk Score:</span>{" "}
                            <span className="font-bold text-cyan-300">{experience.riskScore}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block">Proactive Safety Action</span>
                            <span className="text-amber-400 font-bold capitalize">
                              {experience.recommendedAction?.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-850 rounded-xl text-slate-600 text-xs">
                      No experience records stored.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Vehicle Cockpit */}
          {activeTab === "cockpit" && (
            <div className="animate-fade-in">
              <VehicleCock />
            </div>
          )}

          {/* TAB 3: Vehicle Auth */}
          {activeTab === "auth" && (
            <div className="animate-fade-in">
              <VehicleAuth onVehicleActivated={handleVehicleActivated} />
            </div>
          )}

          {/* TAB 4: V2X Warnings */}
          {activeTab === "v2v" && (
            <div className="animate-fade-in">
              <V2VSharing />
            </div>
          )}

        </main>

      </div>
    </div>
  );
}

// Wrapper to prevent name clash in files
const VehicleCock = VehicleCockpit;

export default Dashboard;