export function isSquareNotFoundError(error: unknown) {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  const errors = (error as { errors?: Array<{ code?: string }> } | null)?.errors || [];
  return statusCode === 404 || errors.some((entry) => entry.code === "NOT_FOUND");
}
