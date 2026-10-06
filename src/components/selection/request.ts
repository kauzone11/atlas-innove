export async function selectionRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json() as T & { error?: string; code?: string; issues?: Record<string, string[]> };
  if (!response.ok) {
    const error = new Error(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível concluir esta ação.") as Error & { code?: string };
    error.code = payload.code;
    throw error;
  }
  return payload;
}
