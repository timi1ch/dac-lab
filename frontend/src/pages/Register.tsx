import { FormEvent, useState } from "react";
import { api, messageOf } from "../api";
import { Banner, Notice } from "../components";

const LOGIN_OK = /^[A-Za-z0-9._-]{3,32}$/;

function passwordChecks(p: string): [string, boolean][] {
  return [
    ["at least 8 characters", p.length >= 8],
    ["an uppercase letter", /\p{Lu}/u.test(p)],
    ["a lowercase letter", /\p{Ll}/u.test(p)],
    ["a digit", /\d/.test(p)],
    ["a special character", /[!-/:-@[-`{-~]/.test(p)],
  ];
}

export default function Register() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    // Frontend checks provide feedback; the backend enforces validation.
    const r = await api("/register", { method: "POST", body: { login, password } });
    setBusy(false);
    if (r.ok) {
      setNotice({ ok: true, text: `${messageOf(r)} You can now sign in.` });
      setPassword("");
    } else {
      setNotice({ ok: false, text: `Error ${r.status}: ${messageOf(r)}` });
    }
  }

  return (
    <section className="card narrow">
      <h1>Register</h1>
      <form onSubmit={onSubmit}>
        <label>
          Username
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            placeholder="e.g. alice_01"
            required
          />
        </label>
        <p className={`hint ${login === "" || LOGIN_OK.test(login) ? "" : "hint-bad"}`}>
          3–32 characters: Latin letters, digits, periods, underscores, and hyphens
        </p>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <ul className="checks">
          {passwordChecks(password).map(([text, ok]) => (
            <li key={text} className={ok ? "check-ok" : "check-no"}>
              {ok ? "✓" : "○"} {text}
            </li>
          ))}
        </ul>

        <button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <Banner notice={notice} />
    </section>
  );
}
