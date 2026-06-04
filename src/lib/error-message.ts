type ErrorRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null;
}

function parseJsonText(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function stringifyRecord(value: ErrorRecord): string | null {
  try {
    const text = JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue
    );
    return text && text !== "{}" ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}

function errorMessage(value: unknown, seen: WeakSet<object>): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const parsed = parseJsonText(value);
    if (parsed !== value) {
      return errorMessage(parsed, seen);
    }
    return value.trim() || null;
  }

  if (["number", "boolean", "bigint"].includes(typeof value)) {
    return String(value);
  }

  if (typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => errorMessage(entry, seen))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length ? parts.join(" | ") : null;
  }

  if (!isRecord(value)) return null;

  const body = errorMessage(value.body, seen);
  if (body) return body;

  const errors = errorMessage(value.errors, seen);
  if (errors) return errors;

  const message = errorMessage(value.message, seen);
  if (message) return message;

  if (value instanceof Error) {
    return value.name || null;
  }

  const detail = errorMessage(value.detail, seen) || errorMessage(value.details, seen);
  if (detail) return detail;

  const code = errorMessage(value.code, seen);
  const id = errorMessage(value.id, seen);
  const hint = errorMessage(value.hint, seen);
  const metadata = [
    code ? `code ${code}` : null,
    id ? `id ${id}` : null,
    hint ? `hint ${hint}` : null,
  ].filter(Boolean);

  if (metadata.length) return metadata.join(", ");

  return stringifyRecord(value);
}

export function toErrorMessage(value: unknown, fallback: string): string {
  return errorMessage(value, new WeakSet()) || fallback;
}
