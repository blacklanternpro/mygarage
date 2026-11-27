/** Domain error carrying an HTTP status so route handlers can map it directly. */
export class DomainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (what: string) => new DomainError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (message: string, details?: unknown) => new DomainError(409, "CONFLICT", message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new DomainError(422, code, message, details);
