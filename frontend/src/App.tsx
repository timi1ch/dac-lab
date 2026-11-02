import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  const isAuth = !!localStorage.getItem("token");
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isAuth ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={isAuth ? <Dashboard /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;