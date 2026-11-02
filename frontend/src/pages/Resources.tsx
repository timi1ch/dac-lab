import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, messageOf, PermissionRow, ResourceDetail, ResourceItem } from "../api";
import { Banner, Notice, PermissionChips } from "../components";

export default function Resources({ token }: { token: string | null }) {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  // создание
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  // работа с конкретным ресурсом (ID можно ввести вручную, чтобы проверить отказ)
  const [idInput, setIdInput] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // права (только владелец)
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [grantLogin, setGrantLogin] = useState("");
  const [grantRead, setGrantRead] = useState(true);
  const [grantUpdate, setGrantUpdate] = useState(false);
  const [grantDelete, setGrantDelete] = useState(false);

  const id = Number(idInput);
  const ownedSelected = items.find((i) => i.id === id && i.is_owner);

  const show = (ok: boolean, text: string) => setNotice({ ok, text });

  const loadList = useCallback(async () => {
    const r = await api<ResourceItem[]>("/resources", { token });
    if (r.ok) setItems(r.data);
    else show(false, `Ошибка ${r.status}: ${messageOf(r)}`);
  }, [token]);

  const loadPerms = useCallback(
    async (resourceId: number) => {
      const r = await api<PermissionRow[]>(`/resources/${resourceId}/permissions`, { token });
      setPerms(r.ok ? r.data : []);
    },
    [token],
  );

  useEffect(() => {
    if (token) loadList();
  }, [token, loadList]);

  useEffect(() => {
    if (ownedSelected) loadPerms(ownedSelected.id);
    else setPerms([]);
  }, [ownedSelected?.id, loadPerms]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <section className="card narrow">
        <h1>Ресурсы</h1>
        <p>
          Сначала <Link to="/login">войдите</Link> (или <Link to="/register">зарегистрируйтесь</Link>).
        </p>
      </section>
    );
  }

  async function createResource(e: FormEvent) {
    e.preventDefault();
    const r = await api<ResourceDetail>("/resources", {
      method: "POST",
      token,
      body: { title: newTitle, content: newContent },
    });
    if (r.ok) {
      show(true, `201 — ресурс #${r.data.id} создан, вы его владелец`);
      setNewTitle("");
      setNewContent("");
      setIdInput(String(r.data.id));
      setTitle(r.data.title);
      setContent(r.data.content);
      loadList();
    } else {
      show(false, `${r.status} — ${messageOf(r)}`);
    }
  }

  function select(item: ResourceItem) {
    setIdInput(String(item.id));
    setTitle("");
    setContent("");
    setNotice(null);
  }

  async function readResource() {
    const r = await api<ResourceDetail>(`/resources/${id}`, { token });
    if (r.ok) {
      setTitle(r.data.title);
      setContent(r.data.content);
      show(true, `${r.status} — чтение разрешено`);
    } else {
      setTitle("");
      setContent("");
      show(false, `${r.status} — ${messageOf(r)}`);
    }
  }

  async function updateResource() {
    const r = await api(`/resources/${id}`, { method: "PUT", token, body: { title, content } });
    show(r.ok, r.ok ? `${r.status} — изменение выполнено` : `${r.status} — ${messageOf(r)}`);
    if (r.ok) loadList();
  }

  async function deleteResource() {
    const r = await api(`/resources/${id}`, { method: "DELETE", token });
    show(r.ok, r.ok ? `${r.status} — ресурс удалён` : `${r.status} — ${messageOf(r)}`);
    if (r.ok) {
      setTitle("");
      setContent("");
      loadList();
    }
  }

  async function grant(login: string, read: boolean, upd: boolean, del: boolean) {
    const r = await api(`/resources/${id}/permissions`, {
      method: "PUT",
      token,
      body: { login, can_read: read, can_update: upd, can_delete: del },
    });
    if (r.ok) {
      const any = read || upd || del;
      show(true, `${r.status} — права пользователя ${login} ${any ? "обновлены" : "отозваны"}`);
      loadPerms(id);
    } else {
      show(false, `${r.status} — ${messageOf(r)}`);
    }
  }

  async function onGrant(e: FormEvent) {
    e.preventDefault();
    await grant(grantLogin, grantRead, grantUpdate, grantDelete);
    setGrantLogin("");
  }

  return (
    <>
      <Banner notice={notice} />

      <section className="card">
        <h2>Доступные мне ресурсы</h2>
        {items.length === 0 ? (
          <p className="muted">Пока ничего нет: создайте ресурс или попросите владельца выдать вам право.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Владелец</th>
                <th>Мои права</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={it.id === id ? "row-active" : ""}>
                  <td>{it.id}</td>
                  <td>{it.title}</td>
                  <td>{it.is_owner ? "вы" : it.owner_login}</td>
                  <td>
                    <PermissionChips perms={it.my_permissions} />
                  </td>
                  <td>
                    <button className="btn-small" onClick={() => select(it)}>
                      Выбрать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Создать ресурс</h2>
          <form onSubmit={createResource}>
            <label>
              Название
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={200} required />
            </label>
            <label>
              Содержимое
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={3} />
            </label>
            <button type="submit">Создать</button>
          </form>
        </section>

        <section className="card">
          <h2>Работа с ресурсом</h2>
          <label>
            ID ресурса (можно ввести любой — так проверяется отказ)
            <input
              type="number"
              min={1}
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              placeholder="например, 1"
            />
          </label>
          <label>
            Название
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Содержимое
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          </label>
          <div className="btn-row">
            <button onClick={readResource} disabled={!id}>
              Читать
            </button>
            <button onClick={updateResource} disabled={!id}>
              Сохранить изменения
            </button>
            <button className="btn-danger" onClick={deleteResource} disabled={!id}>
              Удалить
            </button>
          </div>
        </section>
      </div>

      {ownedSelected && (
        <section className="card">
          <h2>Права доступа к ресурсу #{ownedSelected.id} «{ownedSelected.title}»</h2>
          <p className="muted">Вы владелец: только вы можете выдавать и отзывать права.</p>
          <form onSubmit={onGrant} className="grant-form">
            <input
              value={grantLogin}
              onChange={(e) => setGrantLogin(e.target.value)}
              placeholder="логин пользователя"
              required
            />
            <label className="check-inline">
              <input type="checkbox" checked={grantRead} onChange={(e) => setGrantRead(e.target.checked)} />
              чтение
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={grantUpdate} onChange={(e) => setGrantUpdate(e.target.checked)} />
              изменение
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={grantDelete} onChange={(e) => setGrantDelete(e.target.checked)} />
              удаление
            </label>
            <button type="submit">Выдать / изменить</button>
          </form>

          {perms.length === 0 ? (
            <p className="muted">Другим пользователям права не выданы.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Права</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p.login}>
                    <td>{p.login}</td>
                    <td>
                      <PermissionChips perms={p} />
                    </td>
                    <td>
                      <button className="btn-small btn-danger" onClick={() => grant(p.login, false, false, false)}>
                        Отозвать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
