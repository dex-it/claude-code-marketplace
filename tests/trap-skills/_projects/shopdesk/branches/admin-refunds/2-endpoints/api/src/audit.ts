import fs from 'node:fs';

export interface AuditEntry {
  actor?: string;
  action: string;
  ip?: string;
}

let fd: number | undefined;

export const audit = {
  record(entry: AuditEntry): void {
    fd ??= fs.openSync(process.env.AUDIT_LOG ?? 'audit.log', 'a');
    fs.appendFileSync(fd, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  },

  close(): void {
    if (fd === undefined) return;
    fs.closeSync(fd);
    fd = undefined;
  },
};
