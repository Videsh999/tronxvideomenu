/** First token of a name. Everything else is dropped. */
export function captainFirstName(name: string) {
  const token = name.trim().split(/\s+/)[0] ?? "";
  return token;
}

function stripNote(note: string) {
  return note
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Captain payloads keep a first name and no phone, email, or address. */
export function stripCaptainOrder<T extends object>(order: T): T {
  const next = { ...(order as Record<string, unknown>) };
  delete next.customerPhone;
  delete next.customerEmail;
  delete next.phone;
  delete next.email;
  delete next.deliveryAddress;
  delete next.address;
  delete next.customerTokenHash;
  if (typeof next.customerName === "string") next.customerName = captainFirstName(next.customerName);
  if (typeof next.guestName === "string") next.guestName = captainFirstName(next.guestName);
  if (typeof next.orderNote === "string") next.orderNote = stripNote(next.orderNote);
  return next as T;
}
