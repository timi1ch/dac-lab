import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { session } from "./api";
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

  function handleLogout() {
    session.clear();
    setToken(null);
    setLogin(null);
    navigate("/login");
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <strong className="brand">Лаб. 4 · Дискреционная модель</strong>
          <nav>
            <NavLink to="/register">Регистрация</NavLink>
            <NavLink to="/login">Вход</NavLink>
            <NavLink to="/resources">Ресурсы</NavLink>
            <NavLink to="/demo">Демо-сценарий</NavLink>
          </nav>
          <div className="who">
            {login ? (
              <>
                <span>{login}</span>
                <button className="btn-link" onClick={handleLogout}>
                  Выйти
                </button>
              </>
            ) : (
              <span className="muted">не авторизован</span>
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
