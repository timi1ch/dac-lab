import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api, session } from "./api";
import Demo from "./pages/Demo";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Resources from "./pages/Resources";

export default function App() {
  const [token, setToken] = useState<string | null>(session.token());
  const [login, setLogin] = useState<string | null>(session.login());
  const navigate = useNavigate();

  function handleLogin(newToken: string, newLogin: string) {
    session.set(newToken, newLogin);
    setToken(newToken);
    setLogin(newLogin);
    navigate("/resources");
  }

  async function handleLogout() {
    const result = await api("/logout", { method: "POST", token });
    if (!result.ok && result.status !== 401) {
      window.alert("Could not end your session. Please try signing out again.");
      return;
    }
    session.clear();
    setToken(null);
    setLogin(null);
    navigate("/login");
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <strong className="brand">Res2Share</strong>
          <nav>
            <NavLink to="/register">Register</NavLink>
            <NavLink to="/login">Sign in</NavLink>
            <NavLink to="/resources">Resources</NavLink>
            <NavLink to="/demo">Walkthrough</NavLink>
          </nav>
          <div className="who">
            {login ? (
              <>
                <span>{login}</span>
                <button className="btn-link" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <span className="muted">Not signed in</span>
            )}
          </div>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/resources" element={<Resources token={token} />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Routes>
      </main>
    </>
  );
}
