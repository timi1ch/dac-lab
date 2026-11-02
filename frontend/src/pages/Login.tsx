import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await api.request("/register", { method: "POST", body: JSON.stringify({ login, password }) });
        alert("Регистрация успешна! Теперь войдите.");
        setIsRegister(false);
      } else {
        const data = await api.request("/login", { method: "POST", body: JSON.stringify({ login, password }) });
        localStorage.setItem("token", data.access_token);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "50px auto", fontFamily: "sans-serif" }}>
      <h2>{isRegister ? "Регистрация" : "Вход"}</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)} required />
        <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">{isRegister ? "Зарегистрироваться" : "Войти"}</button>
      </form>
      <p style={{ cursor: "pointer", color: "blue" }} onClick={() => setIsRegister(!isRegister)}>
        {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
      </p>
    </div>
  );
}