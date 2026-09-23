export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: readonly unknown[];

  public constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: readonly unknown[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
