function stamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    console.log(`${stamp()} INFO ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`${stamp()} WARN ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]): void {
    console.error(`${stamp()} ERROR ${message}`, ...args);
  },
};
