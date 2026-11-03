export interface ApiResult<T = any> {
  status: number;
  ok: boolean;
  data: T;
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
}

/** Fetch wrapper that returns status and response data without throwing. */
export async function api<T = any>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  try {
    const res = await fetch(`/api${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* empty response body */
    }
    return { status: res.status, ok: res.ok, data };
  } catch {
    return { status: 0, ok: false, data: { detail: "Unable to reach the server" } as T };
  }
}

const serverMessages = new Map<string, string>([
  ["Пользователь успешно создан", "Account created successfully."],
  ["Некорректный логин", "Enter a valid username."],
  ["Пароль не соответствует требованиям", "The password does not meet the requirements."],
  ["Пользователь с таким именем уже существует", "This username is already taken."],
  ["Войдите в систему повторно", "Your session has expired. Please sign in again."],
  ["Неверный логин или пароль", "Incorrect username or password."],
  ["Вход успешно выполнен", "Signed in successfully."],
  ["Вы вышли из системы", "Signed out successfully."],
  ["Ресурс не найден", "Resource not found."],
  ["Недостаточно прав доступа", "You do not have permission to perform this action."],
  ["Ресурс обновлён", "Resource updated."],
  ["Ресурс удалён", "Resource deleted."],
  ["Пользователь не найден", "User not found."],
  ["Владелец уже имеет все права", "The owner already has full access."],
  ["Права обновлены", "Permissions updated."],
  ["Права отозваны", "Permissions revoked."],
  ["Внутренняя ошибка сервера", "An unexpected server error occurred."],
]);

function serverMessage(message: string): string {
  const nullField = message.match(/^(?:Value error, )?Поле (\w+) не может быть null$/);
  return serverMessages.get(message) || (nullField ? `${nullField[1]} cannot be null.` : message);
}

/** Readable result messages. */
export function messageOf(r: ApiResult, okText = "Done"): string {
  if (r.data && typeof r.data.detail === "string") return serverMessage(r.data.detail);
  if (r.data && Array.isArray(r.data.detail)) {
    return r.data.detail.map((error: { loc?: (string | number)[]; msg?: string }) => {
      const field = error.loc?.filter((part) => part !== "body").join(".");
      const message = error.msg === "Field required" ? "required field" : serverMessage(error.msg || "invalid value");
      return field ? `${field}: ${message}` : message;
    }).join("; ");
  }
  if (r.data && typeof r.data.message === "string") return serverMessage(r.data.message);
  return r.ok ? okText : `Error ${r.status}`;
}

// Session storage is cleared when the tab closes.
export const session = {
  token: (): string | null => sessionStorage.getItem("token"),
  login: (): string | null => sessionStorage.getItem("login"),
  set(token: string, login: string) {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("login", login);
  },
  clear() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("login");
  },
};

export interface PermissionFlags {
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface ResourceItem {
  id: number;
  title: string;
  owner_login: string;
  is_owner: boolean;
  my_permissions: PermissionFlags;
}

export interface ResourceDetail extends ResourceItem {
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PermissionRow extends PermissionFlags {
  login: string;
}
