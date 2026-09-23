import { getDatabase } from '../config/database';
import { destroyDatabase } from '../config/database';

const checkDatabase = async (): Promise<void> => {
  try {
    await getDatabase().raw('select 1');
    console.log('Database connection: ok');
  } finally {
    await destroyDatabase();
  }
};

checkDatabase().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Database connection failed');
  process.exitCode = 1;
});
