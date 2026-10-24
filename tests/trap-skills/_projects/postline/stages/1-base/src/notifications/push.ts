import { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { enqueueOutbox } from "./outbox";

export async function sendPush(tx: PoolClient, recipient: string, payload: unknown): Promise<void> {
  await enqueueOutbox(tx, { id: randomUUID(), channel: "push", recipient, payload, createdAt: new Date() });
}
