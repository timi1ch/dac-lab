import { FormEvent, useState } from "react";
import { api, messageOf } from "../api";
import { Banner, Notice } from "../components";

export default function Login({ onLogin }: { onLogin: (token: string, login: string) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const r = await api("/login", { method: "POST", body: { login, password } });
    setBusy(false);
    if (r.ok) {
      onLogin(r.data.access_token, login);
    } else {
      setNotice({ ok: false, text: `Error ${r.status}: ${messageOf(r)}` });
    }
  }

  return (
    <section className="card narrow">
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>
          Username
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Banner notice={notice} />
    </section>
  );
}
