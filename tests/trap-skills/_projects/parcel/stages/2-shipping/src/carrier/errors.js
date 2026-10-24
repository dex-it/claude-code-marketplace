export class CarrierError extends Error {
  constructor(message, { carrier, status = 0 } = {}) {
    super(message);
    this.name = 'CarrierError';
    this.carrier = carrier;
    this.status = status;
  }

  get retryable() {
    return this.status === 0 || this.status >= 500;
  }
}
