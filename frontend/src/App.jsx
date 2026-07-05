import React, { useState } from "react";
import PortalSelect from "./pages/PortalSelect";
import AdminLogin from "./pages/AdminLogin";
import VehicleLogin from "./pages/VehicleLogin";
import DriverDashboard from "./pages/DriverDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  const [view, setView] = useState("portal-select"); // 'portal-select', 'admin-login', 'vehicle-login', 'dashboard'
  const [userRole, setUserRole] = useState(null); // 'admin' or 'vehicle'

  const handleAdminAuthSuccess = (token, user) => {
    setUserRole("admin");
    setView("dashboard");
  };

  const handleVehicleAuthSuccess = (token, vehicleData) => {
    setUserRole("vehicle");
    setView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("drivemind_admin_token");
    localStorage.removeItem("active_vehicle_token");
    setUserRole(null);
    setView("portal-select");
  };

  return (
    <>
      {view === "portal-select" && (
        <PortalSelect onSelectPortal={(portal) => setView(portal === "admin" ? "admin-login" : "vehicle-login")} />
      )}
      
      {view === "admin-login" && (
        <AdminLogin 
          onAuthSuccess={handleAdminAuthSuccess} 
          onBackToSelector={() => setView("portal-select")} 
        />
      )}

      {view === "vehicle-login" && (
        <VehicleLogin 
          onAuthSuccess={handleVehicleAuthSuccess} 
          onBackToSelector={() => setView("portal-select")} 
        />
      )}

      {view === "dashboard" && (
        <>
          {userRole === "admin" ? (
            <AdminDashboard onLogout={handleLogout} />
          ) : (
            <DriverDashboard onLogout={handleLogout} />
          )}
        </>
      )}
    </>
  );
}

export default App;