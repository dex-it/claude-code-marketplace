import { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { enqueueOutbox } from "./outbox";

export async function sendEmail(tx: PoolClient, recipient: string, payload: unknown): Promise<void> {
  await enqueueOutbox(tx, { id: randomUUID(), channel: "email", recipient, payload, createdAt: new Date() });
}
