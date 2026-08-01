import { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import api from "./api";
import { ToastProvider, useToast } from "./context/ToastContext";
import "./index.css";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const verifyUser = async () => {
    const token = localStorage.getItem("sgpa_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      localStorage.removeItem("sgpa_token");
      localStorage.removeItem("sgpa_user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyUser();
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("sgpa_token");
    localStorage.removeItem("sgpa_user");
    setUser(null);
    showToast("Logged out successfully.", "info");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "sans-serif" }}>
        <p style={{ color: "#64748b", fontSize: 16 }}>Loading SGPA & CGPA Portal...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Navbar Header */}
      <header style={headerContainerStyle}>
        <div style={headerInnerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🎓</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>SGPA Calculator</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={userBadgeStyle}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{user.name}</span>
              <span style={roleTagStyle}>{user.role}</span>
            </div>
            <button onClick={handleLogout} style={logoutButtonStyle}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ paddingBottom: 40 }}>
        <Dashboard user={user} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}

const headerContainerStyle: React.CSSProperties = {
  background: "#ffffff",
  borderBottom: "1px solid #e2e8f0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const headerInnerStyle: React.CSSProperties = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: "12px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const userBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#f1f5f9",
  padding: "6px 12px",
  borderRadius: 20,
  fontSize: 13,
};

const roleTagStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#ffffff",
  padding: "2px 8px",
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
};

const logoutButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  color: "#64748b",
  padding: "6px 14px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};
