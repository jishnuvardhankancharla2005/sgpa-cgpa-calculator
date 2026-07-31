import { useState } from "react";
import api from "../api";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface LoginProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const { data } = await api.post("/auth/register", {
          username,
          password,
          name: name || username,
          role,
        });
        localStorage.setItem("sgpa_token", data.token);
        localStorage.setItem("sgpa_user", JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
      } else {
        const { data } = await api.post("/auth/login", {
          username,
          password,
        });
        localStorage.setItem("sgpa_token", data.token);
        localStorage.setItem("sgpa_user", JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "An error occurred during authentication.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoBadgeStyle}>🎓</div>
          <h2 style={titleStyle}>SGPA & CGPA Portal</h2>
          <p style={subtitleStyle}>Secure User Account & Multi-Tenant Dashboard</p>
        </div>

        {/* Tab Switcher */}
        <div style={tabContainerStyle}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(""); }}
            style={{
              ...tabStyle,
              ...( !isRegister ? activeTabStyle : {}),
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(""); }}
            style={{
              ...tabStyle,
              ...(isRegister ? activeTabStyle : {}),
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div style={errorStyle}>
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isRegister && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              required
              placeholder="e.g. john_doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {isRegister && (
            <div>
              <label style={labelStyle}>Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={inputStyle}
              >
                <option value="student">Student</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In to Dashboard"}
          </button>
        </form>

        <div style={footerTextStyle}>
          {isRegister ? (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                style={linkButtonStyle}
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                style={linkButtonStyle}
              >
                Register here
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Styling Tokens
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #312e81 100%)",
  padding: "20px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(12px)",
  borderRadius: 16,
  padding: "36px 32px",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 24,
};

const logoBadgeStyle: React.CSSProperties = {
  fontSize: 42,
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 6px 0",
  fontSize: 24,
  fontWeight: 700,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#64748b",
};

const tabContainerStyle: React.CSSProperties = {
  display: "flex",
  background: "#f1f5f9",
  borderRadius: 8,
  padding: 4,
  marginBottom: 20,
};

const tabStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 16px",
  border: "none",
  background: "transparent",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#64748b",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const activeTabStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#2563eb",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.2s ease",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  marginTop: 8,
  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
  transition: "all 0.2s ease",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#dc2626",
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 16,
};

const footerTextStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: 20,
  fontSize: 13,
  color: "#64748b",
};

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#2563eb",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};
