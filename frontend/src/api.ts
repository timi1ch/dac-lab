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

/** Обёртка над fetch: всегда возвращает статус и тело, не бросает исключений. */
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
      /* пустое тело ответа */
    }
    return { status: res.status, ok: res.ok, data };
  } catch {
    return { status: 0, ok: false, data: { detail: "Нет связи с сервером" } as T };
  }
}

/** Человекочитаемый текст результата запроса. */
export function messageOf(r: ApiResult, okText = "Готово"): string {
  if (r.data && typeof r.data.detail === "string") return r.data.detail;
  if (r.data && typeof r.data.message === "string") return r.data.message;
  return r.ok ? okText : `Ошибка ${r.status}`;
}

// Токен хранится в sessionStorage: исчезает при закрытии вкладки.
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
