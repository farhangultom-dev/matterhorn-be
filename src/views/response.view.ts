export const successResponse = <T>(message: string, data: T) => ({ success: true as const, message, data });
export const errorResponse = (message: string, code: string, details?: readonly unknown[]) => ({ success: false as const, message, error: { code, ...(details ? { details } : {}) } });
