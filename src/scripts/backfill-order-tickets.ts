import type { Knex } from 'knex';
import { getAppEnv, getDatabaseEnv } from '../config/env';
import { destroyDatabase, getDatabase } from '../config/database';
import {
  findEventTicketsForItems,
  findTicketIssuanceItems,
  hasCompletedSumopodWebhookPayment,
} from '../models/ticket.model';
import { ensureOrderTickets } from '../services/ticket-issuance.service';

interface BackfillOptions {
  readonly orderId?: string;
  readonly limit?: number;
  readonly afterId?: string;
  readonly apply: boolean;
}

interface BackfillReport {
  readonly orderId: string;
  readonly status: 'dry_run' | 'applied' | 'needs_review' | 'failed';
  readonly expectedCount: number;
  readonly existingCount: number;
  readonly missingCount: number;
  readonly createdCount: number;
  readonly legacySnapshotCount: number;
}

const MAX_BATCH_SIZE = 500;
const TEST_DATABASE_SUFFIX = '_ticket_qr_test';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseOptions = (args: readonly string[]): BackfillOptions => {
  const values = new Map<string, string>();
  let apply = false;
  for (const arg of args) {
    if (arg === '--apply') {
      if (apply) throw new Error('Duplicate --apply flag.');
      apply = true;
      continue;
    }
    const match = /^--(order-id|limit|after-id)=(.+)$/.exec(arg);
    if (!match) throw new Error('Unknown argument. Use --order-id, --limit, --after-id, or --apply.');
    const key = match[1]!;
    if (values.has(key)) throw new Error(`Duplicate --${key} option.`);
    values.set(key, match[2]!);
  }

  const orderId = values.get('order-id');
  const afterId = values.get('after-id');
  const limitValue = values.get('limit');
  if (orderId && !UUID_PATTERN.test(orderId)) throw new Error('--order-id must be a UUID.');
  if (afterId && !UUID_PATTERN.test(afterId)) throw new Error('--after-id must be a UUID.');
  if (orderId && (afterId || limitValue)) throw new Error('--order-id cannot be combined with --limit or --after-id.');
  const limit = limitValue === undefined ? 100 : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) throw new Error('--limit must be an integer from 1 to 500.');
  return { ...(orderId ? { orderId } : {}), ...(afterId ? { afterId } : {}), ...(orderId ? {} : { limit }), apply };
};

const assertApplyTarget = (options: BackfillOptions): void => {
  if (!options.apply) return;
  const appEnv = getAppEnv();
  const databaseEnv = getDatabaseEnv();
  if (appEnv.nodeEnv !== 'test' || !databaseEnv.database.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(`--apply is allowed only when NODE_ENV=test and DB_NAME ends with ${TEST_DATABASE_SUFFIX}.`);
  }
};

const listOrderIds = async (database: Knex, options: BackfillOptions): Promise<readonly string[]> => {
  const query = database('orders').select('id').where('status', 'paid').orderBy('id', 'asc');
  if (options.orderId) query.andWhere({ id: options.orderId });
  if (options.afterId) query.andWhere('id', '>', options.afterId);
  if (options.limit) query.limit(options.limit);
  const rows = await query;
  return rows.map((row) => String(row.id));
};

const processOrder = async (database: Knex, orderId: string, apply: boolean): Promise<BackfillReport> => database.transaction(async (transaction) => {
  if (!apply) await transaction.raw('set transaction read only');
  const orderQuery = transaction('orders').select('id', 'status').where({ id: orderId });
  if (apply) orderQuery.forUpdate();
  const order = await orderQuery.first();
  if (!order || order.status !== 'paid') {
    return { orderId, status: 'needs_review', expectedCount: 0, existingCount: 0, missingCount: 0, createdCount: 0, legacySnapshotCount: 0 };
  }

  if (!(await hasCompletedSumopodWebhookPayment(transaction, orderId))) {
    return { orderId, status: 'needs_review', expectedCount: 0, existingCount: 0, missingCount: 0, createdCount: 0, legacySnapshotCount: 0 };
  }

  const items = await findTicketIssuanceItems(transaction, orderId);
  const expectedCount = items.reduce((total, item) => total + item.quantity, 0);
  if (!Number.isSafeInteger(expectedCount)) throw new Error('Order quantity total is invalid.');
  const tickets = await findEventTicketsForItems(transaction, items.map((item) => item.id));
  const legacySnapshotCount = items.filter((item) => item.event_title_snapshot === null || item.ticket_type_name_snapshot === null).length;

  if (!apply) {
    return {
      orderId,
      status: 'dry_run',
      expectedCount,
      existingCount: tickets.length,
      missingCount: Math.max(0, expectedCount - tickets.length),
      createdCount: 0,
      legacySnapshotCount,
    };
  }

  const issuance = await ensureOrderTickets(transaction, orderId);
  return {
    orderId,
    status: 'applied',
    expectedCount: issuance.expectedCount,
    existingCount: issuance.existingCount,
    missingCount: Math.max(0, issuance.expectedCount - issuance.createdCount - issuance.existingCount),
    createdCount: issuance.createdCount,
    legacySnapshotCount,
  };
});

const run = async (): Promise<void> => {
  const options = parseOptions(process.argv.slice(2));
  assertApplyTarget(options);
  const database = getDatabase();
  let failures = 0;
  let lastOrderId: string | undefined;
  try {
    const identity = await database.raw('select current_database() as database_name');
    const actualDatabaseName = String(identity.rows[0]?.database_name ?? '');
    if (options.apply && actualDatabaseName !== getDatabaseEnv().database) {
      throw new Error('Connected database does not match configured DB_NAME; no order was modified.');
    }
    const orderIds = await listOrderIds(database, options);
    for (const orderId of orderIds) {
      lastOrderId = orderId;
      try {
        const report = await processOrder(database, orderId, options.apply);
        console.log(JSON.stringify(report));
      } catch (error) {
        failures += 1;
        console.error(JSON.stringify({ orderId, status: 'failed', message: error instanceof Error ? error.message : 'Unknown failure' }));
      }
    }
    console.log(JSON.stringify({
      mode: options.apply ? 'apply' : 'dry_run',
      processedCount: orderIds.length,
      lastOrderId: lastOrderId ?? null,
      failedCount: failures,
    }));
    if (failures > 0) process.exitCode = 1;
  } finally {
    await destroyDatabase();
  }
};

run().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Ticket backfill failed.');
  process.exitCode = 1;
  await destroyDatabase();
});
