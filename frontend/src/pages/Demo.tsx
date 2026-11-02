import { useState } from "react";
import { api, ApiResult, messageOf } from "../api";

interface Step {
  title: string;
  request: string;
  expected: number;
  status: number;
  note: string;
  pass: boolean;
}

const PASSWORD = "Demo#Pass123";

function suffix() {
  return Math.random().toString(36).slice(2, 8);
}

/** Регистрирует пользователя и входит; возвращает токен. */
async function registerAndLogin(login: string): Promise<{ token: string | null; statuses: number[] }> {
  const reg = await api("/register", { method: "POST", body: { login, password: PASSWORD } });
  const log = await api("/login", { method: "POST", body: { login, password: PASSWORD } });
  return { token: log.ok ? log.data.access_token : null, statuses: [reg.status, log.status] };
}

export default function Demo() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  async function run() {
    setSteps([]);
    setFinished(false);
    setRunning(true);

    const add = (step: Step) => setSteps((prev) => [...prev, step]);

    async function check(
      title: string,
      request: string,
      expected: number,
      call: () => Promise<ApiResult>,
      okNote: string,
    ): Promise<ApiResult> {
      const r = await call();
      add({
        title,
        request,
        expected,
        status: r.status,
        note: r.status === expected && r.ok ? okNote : messageOf(r, okNote),
        pass: r.status === expected,
      });
      return r;
    }

    const s = suffix();
    const owner = `owner_${s}`;
    const reader = `reader_${s}`;
    const stranger = `stranger_${s}`;

    // 1. три пользователя
    const [o, rd, st] = [
      await registerAndLogin(owner),
      await registerAndLogin(reader),
      await registerAndLogin(stranger),
    ];
    const usersOk = [o, rd, st].every((u) => u.token && u.statuses[0] === 201 && u.statuses[1] === 200);
    add({
      title: "Регистрация и вход трёх пользователей",
      request: `POST /api/register + POST /api/login для ${owner}, ${reader}, ${stranger}`,
      expected: 201,
      status: usersOk ? 201 : 0,
      note: usersOk ? "Владелец, читатель и посторонний созданы и авторизованы" : "Не удалось создать пользователей",
      pass: usersOk,
    });
    if (!usersOk) {
      setRunning(false);
      setFinished(true);
      return;
    }
    const tOwner = o.token!;
    const tReader = rd.token!;
    const tStranger = st.token!;

    // 2. владелец создаёт ресурс
    const created = await check(
      "Владелец создаёт ресурс",
      `POST /api/resources  (${owner})`,
      201,
      () =>
        api("/resources", {
          method: "POST",
          token: tOwner,
          body: { title: "Квартальный отчёт", content: "Конфиденциальный текст отчёта" },
        }),
      "Ресурс создан, владелец — owner",
    );
    if (!created.ok) {
      setRunning(false);
      setFinished(true);
      return;
    }
    const rid = created.data.id;
    const url = `/resources/${rid}`;

    const read = (token: string) => () => api(url, { token });
    const grant = (can_read: boolean, can_update: boolean, can_delete: boolean, token = tOwner, login = reader) => () =>
      api(`${url}/permissions`, { method: "PUT", token, body: { login, can_read, can_update, can_delete } });

    // 3. посторонний не имеет доступа
    await check("Пользователь без права пытается прочитать", `GET /api/resources/${rid}  (${stranger})`, 403, read(tStranger), "");
    // 4–5. выдача права чтения и чтение
    await check("Владелец выдаёт читателю право на чтение", `PUT /api/resources/${rid}/permissions  (${owner} → ${reader}, чтение)`, 200, grant(true, false, false), "Право чтения выдано");
    await check("Читатель читает ресурс", `GET /api/resources/${rid}  (${reader})`, 200, read(tReader), "Доступ разрешён");
    // 6–7. других прав нет
    await check(
      "Читатель пытается изменить ресурс",
      `PUT /api/resources/${rid}  (${reader})`,
      403,
      () => api(url, { method: "PUT", token: tReader, body: { content: "взлом" } }),
      "",
    );
    await check("Читатель пытается удалить ресурс", `DELETE /api/resources/${rid}  (${reader})`, 403, () => api(url, { method: "DELETE", token: tReader }), "");
    // 8–9. дополнительное право изменения
    await check("Владелец добавляет читателю право на изменение", `PUT /api/resources/${rid}/permissions  (${owner} → ${reader}, чтение + изменение)`, 200, grant(true, true, false), "Права обновлены");
    await check(
      "Читатель изменяет ресурс",
      `PUT /api/resources/${rid}  (${reader})`,
      200,
      () => api(url, { method: "PUT", token: tReader, body: { content: "Текст, исправленный читателем" } }),
      "Изменение разрешено",
    );
    // 10–11. посторонний по-прежнему без доступа, получатель права не может передавать дальше
    await check("Посторонний всё ещё не имеет доступа", `GET /api/resources/${rid}  (${stranger})`, 403, read(tStranger), "");
    await check(
      "Читатель пытается выдать права постороннему",
      `PUT /api/resources/${rid}/permissions  (${reader} → ${stranger})`,
      403,
      grant(true, false, false, tReader, stranger),
      "",
    );

    setRunning(false);
    setFinished(true);
  }

  const allPass = finished && steps.length > 0 && steps.every((x) => x.pass);

  return (
    <section className="card">
      <h1>Демо-сценарий дискреционной модели</h1>
      <p>
        Кнопка создаёт трёх новых пользователей (владелец, читатель, посторонний) и по шагам проверяет:
        владелец выдаёт право → получатель получает доступ → пользователь без права получает отказ{" "}
        <b>403</b>. Все запросы идут на настоящий backend, решение принимает сервер.
      </p>
      <button onClick={run} disabled={running}>
        {running ? "Выполняется…" : steps.length ? "Запустить заново" : "Запустить сценарий"}
      </button>

      {steps.length > 0 && (
        <table className="demo-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Шаг</th>
              <th>Ожидается</th>
              <th>Получено</th>
              <th>Итог</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((st, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <div>{st.title}</div>
                  <code>{st.request}</code>
                  {st.note && <div className="muted small">{st.note}</div>}
                </td>
                <td>{st.expected}</td>
                <td>
                  <span className={`status ${st.status >= 200 && st.status < 300 ? "status-ok" : "status-deny"}`}>
                    {st.status || "—"}
                  </span>
                </td>
                <td>{st.pass ? <span className="pass">✓ верно</span> : <span className="fail">✗ ошибка</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {finished && (
        <div className={`banner ${allPass ? "banner-ok" : "banner-err"}`}>
          {allPass ? "Все проверки сценария пройдены." : "Есть отклонения от ожидаемого результата."}
        </div>
      )}
    </section>
  );
}
