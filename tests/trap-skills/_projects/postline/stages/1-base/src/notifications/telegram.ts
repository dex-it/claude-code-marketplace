// Отправка в Telegram напрямую, без outbox: появилась до outbox.
export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${process.env.TELEGRAM_API}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
}
