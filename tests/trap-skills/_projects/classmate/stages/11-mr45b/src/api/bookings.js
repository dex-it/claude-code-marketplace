export async function createBooking(req, deps, signal) {
  const { slot, studentId, priceCents } = req.body;
  const hold = await deps.payflow.hold({ amountCents: priceCents, studentId }, { signal });
  const booking = await deps.db.insertBooking({
    slot,
    studentId,
    priceCents,
    holdId: hold.id,
    status: 'paid',
  });
  return { status: 201, body: booking };
}
