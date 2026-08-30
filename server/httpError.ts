export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code = "REQUEST_FAILED",
    details?: Record<string, string>
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
