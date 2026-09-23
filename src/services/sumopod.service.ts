import { getSumopodEnv, type SumopodEnv } from '../config/env';
import { sumopodPaymentResponseSchema, type SumopodPaymentResponse } from '../validations/payment.validation';

const MAX_PROVIDER_RESPONSE_BYTES = 64 * 1024;
const SUMOPOD_REQUEST_TIMEOUT_MS = 10_000;

export interface CreateSumopodPaymentInput {
  readonly orderId: string;
  readonly amount: number;
  readonly expiresInHours?: number;
  readonly paymentMethodTypeCode?: string;
}

export class SumopodConfigurationError extends Error {
  public constructor() {
    super('Sumopod payment gateway is not configured');
    this.name = 'SumopodConfigurationError';
  }
}

export class SumopodRejectedError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number) {
    super('Sumopod rejected the payment request');
    this.name = 'SumopodRejectedError';
    this.statusCode = statusCode;
  }
}

export class SumopodOutcomeUnknownError extends Error {
  public constructor(message = 'Sumopod payment outcome is unknown') {
    super(message);
    this.name = 'SumopodOutcomeUnknownError';
  }
}

const readLimitedResponse = async (response: Response): Promise<string> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SumopodOutcomeUnknownError('Sumopod response exceeded the size limit');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
};

const buildRequestBody = (input: CreateSumopodPaymentInput, env: SumopodEnv): Record<string, string | number> => ({
  order_id: 'MH-' + input.orderId,
  amount: input.amount,
  currency: 'IDR',
  ...(input.expiresInHours === undefined ? {} : { expires_in_hours: input.expiresInHours }),
  success_return_url: env.successReturnUrl,
  cancel_return_url: env.cancelReturnUrl,
  ...(input.paymentMethodTypeCode === undefined ? {} : { payment_method_type_code: input.paymentMethodTypeCode }),
});

export const createSumopodPayment = async (input: CreateSumopodPaymentInput): Promise<SumopodPaymentResponse> => {
  const env = getSumopodEnv();
  if (!env.configured) throw new SumopodConfigurationError();

  let response: Response;
  try {
    response = await fetch(env.baseUrl + '/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.apiKey },
      body: JSON.stringify(buildRequestBody(input, env)),
      signal: AbortSignal.timeout(SUMOPOD_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SumopodOutcomeUnknownError('Sumopod request timed out or the connection failed');
  }

  let rawBody: string;
  try {
    rawBody = await readLimitedResponse(response);
  } catch (error) {
    if (error instanceof SumopodOutcomeUnknownError) throw error;
    throw new SumopodOutcomeUnknownError();
  }

  // Sumopod's documented create-payment success status is exactly HTTP 201.
  // Other 2xx responses are not evidence that a payment link was created.
  if (response.status !== 201) {
    if (response.status >= 400 && response.status < 500 && ![408, 409, 425, 429].includes(response.status)) {
      throw new SumopodRejectedError(response.status);
    }
    throw new SumopodOutcomeUnknownError('Sumopod did not return the documented HTTP 201 success status');
  }

  let rawResponse: unknown;
  try {
    rawResponse = JSON.parse(rawBody);
  } catch {
    throw new SumopodOutcomeUnknownError('Sumopod returned an invalid response');
  }
  const parsed = sumopodPaymentResponseSchema.safeParse(rawResponse);
  if (!parsed.success) throw new SumopodOutcomeUnknownError('Sumopod returned a response that did not match the payment contract');
  return parsed.data;
};
