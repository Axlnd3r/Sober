export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error?.message || `Request failed (${response.status})`);
  return result.data as T;
}
export function post<T>(path: string, body: unknown): Promise<T> { return api<T>(path, { method: "POST", body: JSON.stringify(body) }); }
