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

/** Register and sign in a user, then return the token. */
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

    // 1. Create three users
    const [o, rd, st] = [
      await registerAndLogin(owner),
      await registerAndLogin(reader),
      await registerAndLogin(stranger),
    ];
    const usersOk = [o, rd, st].every((u) => u.token && u.statuses[0] === 201 && u.statuses[1] === 200);
    add({
      title: "Register and sign in three users",
      request: `POST /api/register + POST /api/login for ${owner}, ${reader}, ${stranger}`,
      expected: 201,
      status: usersOk ? 201 : 0,
      note: usersOk ? "Owner, reader, and outsider accounts are ready" : "Could not create the demo accounts",
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

    // 2. The owner creates a resource
    const created = await check(
      "The owner creates a resource",
      `POST /api/resources  (${owner})`,
      201,
      () =>
        api("/resources", {
          method: "POST",
          token: tOwner,
          body: { title: "Quarterly report", content: "Confidential report content" },
        }),
      "Resource created and assigned to the owner",
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

    // 3. The outsider has no access
    await check("An outsider attempts to read the resource", `GET /api/resources/${rid}  (${stranger})`, 403, read(tStranger), "");
    // 4–5. Grant read permission and read
    await check("The owner grants read access", `PUT /api/resources/${rid}/permissions  (${owner} → ${reader}, read)`, 200, grant(true, false, false), "Read access granted");
    await check("The reader opens the resource", `GET /api/resources/${rid}  (${reader})`, 200, read(tReader), "Access allowed");
    // 6–7. Other permissions remain denied
    await check(
      "The reader attempts to update the resource",
      `PUT /api/resources/${rid}  (${reader})`,
      403,
      () => api(url, { method: "PUT", token: tReader, body: { content: "Unauthorized update" } }),
      "",
    );
    await check("The reader attempts to delete the resource", `DELETE /api/resources/${rid}  (${reader})`, 403, () => api(url, { method: "DELETE", token: tReader }), "");
    // 8–9. Grant update permission
    await check("The owner grants update access", `PUT /api/resources/${rid}/permissions  (${owner} → ${reader}, read + update)`, 200, grant(true, true, false), "Permissions updated");
    await check(
      "The reader updates the resource",
      `PUT /api/resources/${rid}  (${reader})`,
      200,
      () => api(url, { method: "PUT", token: tReader, body: { content: "Content updated by the reader" } }),
      "Update allowed",
    );
    // 10–11. Deny the outsider and prevent permission delegation
    await check("The outsider still has no access", `GET /api/resources/${rid}  (${stranger})`, 403, read(tStranger), "");
    await check(
      "The reader attempts to grant access to the outsider",
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
      <h1>Access control walkthrough</h1>
      <p>
        This scenario creates three users (an owner, a reader, and an outsider) and verifies that
        the owner grants access → the recipient can read → the outsider receives{" "}
        <b>403</b>. Every request is sent to the backend, which enforces access control.
      </p>
      <button onClick={run} disabled={running}>
        {running ? "Running…" : steps.length ? "Run again" : "Run scenario"}
      </button>

      {steps.length > 0 && (
        <table className="demo-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Step</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Result</th>
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
                <td>{st.pass ? <span className="pass">✓ Passed</span> : <span className="fail">✗ Failed</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {finished && (
        <div className={`banner ${allPass ? "banner-ok" : "banner-err"}`}>
          {allPass ? "All scenario checks passed." : "Some checks did not match the expected result."}
        </div>
      )}
    </section>
  );
}
