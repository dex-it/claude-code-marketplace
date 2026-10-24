export async function createBooking(req, deps) {
  const { slot, studentId, priceCents } = req.body;
  let hold;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      hold = await deps.payflow.hold({ amountCents: priceCents, studentId });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  const booking = await deps.db.insertBooking({
    slot,
    studentId,
    priceCents,
    holdId: hold.id,
    status: 'paid',
  });
  return { status: 201, body: booking };
}
