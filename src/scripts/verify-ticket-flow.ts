import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createTicketQrPayload, verifyTicketQrPayload } from '../utils/ticket-qr';

const firstTicketId = randomUUID();
const secondTicketId = randomUUID();
const signingKey = randomBytes(32);
const otherSigningKey = randomBytes(32);

const firstPayload = createTicketQrPayload(firstTicketId, signingKey);
const secondPayload = createTicketQrPayload(secondTicketId, signingKey);

assert.equal(firstPayload.length, 114);
assert.equal(verifyTicketQrPayload(firstPayload, signingKey), firstTicketId);
assert.equal(createTicketQrPayload(firstTicketId, signingKey), firstPayload);
assert.notEqual(firstPayload, secondPayload);
assert.equal(verifyTicketQrPayload(secondPayload, signingKey), secondTicketId);
assert.equal(verifyTicketQrPayload(firstPayload, otherSigningKey), undefined);
assert.equal(verifyTicketQrPayload(firstPayload.toUpperCase(), signingKey), undefined);
assert.equal(verifyTicketQrPayload(firstPayload.replace('v1', 'v2'), signingKey), undefined);
assert.equal(verifyTicketQrPayload(`${firstPayload}x`, signingKey), undefined);

const modifiedSignature = firstPayload.slice(0, -1) + (firstPayload.endsWith('0') ? '1' : '0');
assert.equal(verifyTicketQrPayload(modifiedSignature, signingKey), undefined);

assert.throws(() => createTicketQrPayload(firstTicketId, randomBytes(16)));

console.log('Ticket QR checks passed: canonical format, stable signing, unique IDs, and invalid payload rejection.');
