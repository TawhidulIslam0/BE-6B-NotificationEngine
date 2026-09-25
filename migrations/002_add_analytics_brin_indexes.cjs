/* global exports */

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE INDEX notification_state_log_created_at_brin_idx
    ON notification_state_log
    USING BRIN (created_at)
    WITH (pages_per_range = 32)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS
    notification_state_log_created_at_brin_idx
  `);
};
