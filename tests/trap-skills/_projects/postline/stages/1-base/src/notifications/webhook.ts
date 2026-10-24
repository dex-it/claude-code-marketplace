// Вебхуки партнёров: прямой POST из обработчика события.
export async function sendWebhook(url: string, event: { type: string; data: unknown }): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event) });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}
