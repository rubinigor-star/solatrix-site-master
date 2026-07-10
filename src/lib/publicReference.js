export function formatPublicLeadReference(leadNumber) {
  const value = Number(leadNumber);
  if (!Number.isFinite(value) || value < 1) return '';

  // Deterministic 6-digit permutation of the internal sequence.
  // This keeps references stable and unique for the first 900,000 leads,
  // while avoiding exposing the actual CRM record count.
  const publicNumber = 100000 + ((Math.trunc(value) * 7919 + 48371) % 900000);
  return String(publicNumber);
}
