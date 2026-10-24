import { Pool, PoolClient } from "pg";

export interface OutboxMessage {
  id: string;            // UUIDv7
  channel: "push" | "email" | "sms" | "telegram" | "webhook";
  recipient: string;
  payload: unknown;
  createdAt: Date;
}

// Пишет сообщение в таблицу notifications_outbox в транзакции вызывающего.
export async function enqueueOutbox(tx: PoolClient, msg: OutboxMessage): Promise<void> {
  await tx.query(
    "insert into notifications_outbox(id, channel, recipient, payload, created_at) values ($1,$2,$3,$4,$5)",
    [msg.id, msg.channel, msg.recipient, JSON.stringify(msg.payload), msg.createdAt]);
}

// Фоновый отправщик: забирает пачку, отдаёт каналу, помечает отправленным.
export async function drainOutbox(pool: Pool, send: (m: OutboxMessage) => Promise<void>): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      "select * from notifications_outbox where sent_at is null order by created_at limit 100 for update skip locked");
    for (const r of rows) {
      await send({ id: r.id, channel: r.channel, recipient: r.recipient, payload: r.payload, createdAt: r.created_at });
      await client.query("update notifications_outbox set sent_at = now() where id = $1", [r.id]);
    }
    await client.query("commit");
    return rows.length;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
