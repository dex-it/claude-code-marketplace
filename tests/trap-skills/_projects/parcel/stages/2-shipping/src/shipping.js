export async function createShipmentForOrder(order, { carrier }) {
  const { trackingNumber, eta } = await carrier.createShipment(order);
  order.trackingNumber = trackingNumber;
  order.eta = eta;
  order.carrier = 'courier-service';
  return order;
}
