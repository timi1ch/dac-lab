import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, messageOf, PermissionRow, ResourceDetail, ResourceItem } from "../api";
import { Banner, Notice, PermissionChips } from "../components";

export default function Resources({ token }: { token: string | null }) {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  // creation
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  // manage a resource by ID, including denied-access checks
  const [idInput, setIdInput] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [changes, setChanges] = useState<{ title?: string; content?: string }>({});

  // permissions (owner only)
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
    else show(false, `Error ${r.status}: ${messageOf(r)}`);
  }, [token]);

  const loadPerms = useCallback(
    async (resourceId: number) => {
      const r = await api<PermissionRow[]>(`/resources/${resourceId}/permissions`, { token });
      setPerms(r.ok ? r.data : []);
    },
    [token],
  );

  useEffect(() => {
    setItems([]);
    setIdInput("");
    setTitle("");
    setContent("");
    setChanges({});
    if (token) loadList();
  }, [token, loadList]);

  useEffect(() => {
    if (ownedSelected) loadPerms(ownedSelected.id);
    else setPerms([]);
  }, [ownedSelected?.id, loadPerms]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <section className="card narrow">
        <h1>Resources</h1>
        <p>
          Please <Link to="/login">sign in</Link> (or <Link to="/register">create an account</Link>).
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
      show(true, `201 — resource #${r.data.id} created. You are the owner`);
      setNewTitle("");
      setNewContent("");
      setIdInput(String(r.data.id));
      setChanges({});
      setTitle(r.data.title);
      setContent(r.data.content);
      loadList();
    } else {
      show(false, `${r.status} — ${messageOf(r)}`);
    }
  }

  function select(item: ResourceItem) {
    setChanges({});
    setIdInput(String(item.id));
    setTitle("");
    setContent("");
    setNotice(null);
  }

  async function readResource() {
    const r = await api<ResourceDetail>(`/resources/${id}`, { token });
    if (r.ok) {
      setChanges({});
      setTitle(r.data.title);
      setContent(r.data.content);
      show(true, `${r.status} — read access allowed`);
    } else {
      setTitle("");
      setContent("");
      setChanges({});
      show(false, `${r.status} — ${messageOf(r)}`);
    }
  }

  async function updateResource() {
    if (Object.keys(changes).length === 0) {
      show(false, "Change the title or content before saving.");
      return;
    }
    const r = await api(`/resources/${id}`, { method: "PUT", token, body: changes });
    show(r.ok, r.ok ? `${r.status} — resource updated` : `${r.status} — ${messageOf(r)}`);
    if (r.ok) {
      setChanges({});
      loadList();
    }
  }

  async function deleteResource() {
    const r = await api(`/resources/${id}`, { method: "DELETE", token });
    show(r.ok, r.ok ? `${r.status} — resource deleted` : `${r.status} — ${messageOf(r)}`);
    if (r.ok) {
      setTitle("");
      setContent("");
      setChanges({});
      setIdInput("");
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
      show(true, `${r.status} — permissions for ${login} ${any ? "updated" : "revoked"}`);
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
        <h2>Resources I can read</h2>
        {items.length === 0 ? (
          <p className="muted">No resources yet. Create one or ask an owner to grant you read access.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Owner</th>
                <th>My permissions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={it.id === id ? "row-active" : ""}>
                  <td>{it.id}</td>
                  <td>{it.title}</td>
                  <td>{it.is_owner ? "you" : it.owner_login}</td>
                  <td>
                    <PermissionChips perms={it.my_permissions} />
                  </td>
                  <td>
                    <button className="btn-small" onClick={() => select(it)}>
                      Select
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
          <h2>Create resource</h2>
          <form onSubmit={createResource}>
            <label>
              Title
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={200} required />
            </label>
            <label>
              Content
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={3} />
            </label>
            <button type="submit">Create</button>
          </form>
        </section>

        <section className="card">
          <h2>Manage resource</h2>
          <label>
            Resource ID (enter any ID to check access)
            <input
              type="number"
              min={1}
              value={idInput}
              onChange={(e) => {
                setIdInput(e.target.value);
                setTitle("");
                setContent("");
                setChanges({});
              }}
              placeholder="e.g. 1"
            />
          </label>
          <label>
            Title
            <input value={title} onChange={(e) => {
              setTitle(e.target.value);
              setChanges((previous) => ({ ...previous, title: e.target.value }));
            }} />
          </label>
          <label>
            Content
            <textarea value={content} onChange={(e) => {
              setContent(e.target.value);
              setChanges((previous) => ({ ...previous, content: e.target.value }));
            }} rows={3} />
          </label>
          <div className="btn-row">
            <button onClick={readResource} disabled={!id}>
              Read
            </button>
            <button onClick={updateResource} disabled={!id}>
              Save changes
            </button>
            <button className="btn-danger" onClick={deleteResource} disabled={!id}>
              Delete
            </button>
          </div>
        </section>
      </div>

      {ownedSelected && (
        <section className="card">
          <h2>Permissions for resource #{ownedSelected.id} «{ownedSelected.title}»</h2>
          <p className="muted">You own this resource. Only you can grant or revoke permissions.</p>
          <form onSubmit={onGrant} className="grant-form">
            <input
              value={grantLogin}
              onChange={(e) => setGrantLogin(e.target.value)}
              placeholder="Username"
              required
            />
            <label className="check-inline">
              <input type="checkbox" checked={grantRead} onChange={(e) => setGrantRead(e.target.checked)} />
              read
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={grantUpdate} onChange={(e) => setGrantUpdate(e.target.checked)} />
              update
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={grantDelete} onChange={(e) => setGrantDelete(e.target.checked)} />
              delete
            </label>
            <button type="submit">Save permissions</button>
          </form>

          {perms.length === 0 ? (
            <p className="muted">No permissions have been granted to other users.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Permissions</th>
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
                        Revoke
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
