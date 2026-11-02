import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

interface Resource {
  id: number; name: string; content: string; owner_id: number;
  is_owner: boolean; can_read: boolean; can_update: boolean; can_delete: boolean;
}

export default function Dashboard() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadResources = async () => {
    try {
      const data = await api.request("/resources");
      setResources(data);
    } catch { navigate("/"); }
  };

  useEffect(() => { loadResources(); }, []);

  const createResource = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.request("/resources", { method: "POST", body: JSON.stringify({ name, content }) });
    setName(""); setContent(""); loadResources();
  };

  const grantAccess = async (resId: number, type: string) => {
    if (!targetUser) return alert("Введите логин пользователя");
    const body = { target_user_login: targetUser, can_read: type === "read", can_update: type === "update", can_delete: type === "delete" };
    try {
      const res = await api.request(`/resources/${resId}/grant`, { method: "POST", body: JSON.stringify(body) });
      alert(res.message);
    } catch (err: any) { alert(err.message); }
  };

  const testAccess = async (resId: number, action: string) => {
    try {
      const res = await api.request(`/resources/${resId}${action === "read" ? "" : `?action=${action}`}`, { method: action === "read" ? "GET" : action === "update" ? "PUT" : "DELETE", body: action === "update" ? JSON.stringify({ name: "Updated", content: "Updated" }) : undefined });
      alert(action === "read" ? `Доступ разрешен! Контент: ${res.content}` : res.message);
      loadResources();
    } catch (err: any) { alert(`Отказ: ${err.message}`); }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <button onClick={() => { localStorage.removeItem("token"); navigate("/"); }}>Выйти</button>
      <h2>Ресурсы</h2>
      
      <form onSubmit={createResource} style={{ marginBottom: 20 }}>
        <input placeholder="Имя ресурса" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Контент" value={content} onChange={e => setContent(e.target.value)} required />
        <button type="submit">Создать ресурс</button>
      </form>

      <input placeholder="Логин пользователя для выдачи прав" value={targetUser} onChange={e => setTargetUser(e.target.value)} />

      {resources.map(r => (
        <div key={r.id} style={{ border: "1px solid #ccc", padding: 10, margin: "10px 0" }}>
          <h3>{r.name} (Владелец ID: {r.owner_id})</h3>
          <p>{r.content}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {r.can_read && <button onClick={() => testAccess(r.id, "read")}>Читать</button>}
            {r.can_update && <button onClick={() => testAccess(r.id, "update")}>Изменить</button>}
            {r.can_delete && <button onClick={() => testAccess(r.id, "delete")}>Удалить</button>}
            
            {r.is_owner && (
              <div style={{ borderLeft: "2px solid blue", paddingLeft: 10 }}>
                <b>Выдать права:</b>
                <button onClick={() => grantAccess(r.id, "read")}>Чтение</button>
                <button onClick={() => grantAccess(r.id, "update")}>Изменение</button>
                <button onClick={() => grantAccess(r.id, "delete")}>Удаление</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}