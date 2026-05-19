export function normalizePhoneForSquare(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return undefined;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 16) return undefined;

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `+${digits}`;
  return digits;
}

export function normalizeAustralianPhoneForMatch(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("61") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

export function getPhoneSearchCandidates(phone: string) {
  return Array.from(
    new Set([normalizePhoneForSquare(phone), normalizeAustralianPhoneForMatch(phone)].filter(Boolean))
  ) as string[];
}

export function getSquarePhoneSearchCandidate(phone: string) {
  return normalizePhoneForSquare(phone) || "";
}

type CustomerPhoneRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

export function findCustomerPhoneConflict(
  customers: CustomerPhoneRow[],
  email: string,
  phone: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = normalizeAustralianPhoneForMatch(phone);
  if (!normalizedEmail || !normalizedPhone) return null;

  return (
    customers.find((customer) => {
      if (!customer.phone) return false;
      if (String(customer.email || "").trim().toLowerCase() === normalizedEmail) return false;
      return normalizeAustralianPhoneForMatch(customer.phone) === normalizedPhone;
    }) || null
  );
}
