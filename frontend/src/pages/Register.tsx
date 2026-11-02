import { FormEvent, useState } from "react";
import { api, messageOf } from "../api";
import { Banner, Notice } from "../components";

const LOGIN_OK = /^[A-Za-z0-9._-]{3,32}$/;

function passwordChecks(p: string): [string, boolean][] {
  return [
    ["минимум 8 символов", p.length >= 8],
    ["заглавная буква", /\p{Lu}/u.test(p)],
    ["строчная буква", /\p{Ll}/u.test(p)],
    ["цифра", /\d/.test(p)],
    ["специальный символ", /[!-/:-@[-`{-~]/.test(p)],
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
    // Проверки на frontend нужны только для удобства; решение принимает backend.
    const r = await api("/register", { method: "POST", body: { login, password } });
    setBusy(false);
    if (r.ok) {
      setNotice({ ok: true, text: `Успешно: ${messageOf(r)}. Теперь можно войти.` });
      setPassword("");
    } else {
      setNotice({ ok: false, text: `Ошибка ${r.status}: ${messageOf(r)}` });
    }
  }

  return (
    <section className="card narrow">
      <h1>Регистрация</h1>
      <form onSubmit={onSubmit}>
        <label>
          Логин
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            placeholder="например, alice_01"
            required
          />
        </label>
        <p className={`hint ${login === "" || LOGIN_OK.test(login) ? "" : "hint-bad"}`}>
          3–32 символа: латинские буквы, цифры, «.», «_», «-»
        </p>

        <label>
          Пароль
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
          {busy ? "Отправка…" : "Зарегистрироваться"}
        </button>
      </form>
      <Banner notice={notice} />
    </section>
  );
}
