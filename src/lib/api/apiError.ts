/**
 * Thrown whenever the backend responds with a non-2xx status.
 * Matches the shape written by errorHandler.ts on the backend:
 *   res.status(status).json({ message })
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}