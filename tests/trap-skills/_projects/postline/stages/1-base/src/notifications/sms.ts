import { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { enqueueOutbox } from "./outbox";

export async function sendSms(tx: PoolClient, recipient: string, payload: unknown): Promise<void> {
  await enqueueOutbox(tx, { id: randomUUID(), channel: "sms", recipient, payload, createdAt: new Date() });
}
