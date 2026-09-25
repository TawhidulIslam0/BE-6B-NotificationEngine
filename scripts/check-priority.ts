import { database } from '../src/infrastructure/postgres/client.js';

const main = async (): Promise<void> => {
  const result = await database.raw(`
    SELECT
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conname = 'notifications_priority_check'
  `);

  console.log(result.rows);

  await database.destroy();
};

void main().catch(async (error: unknown) => {
  console.error(error);
  await database.destroy();
  process.exitCode = 1;
});
