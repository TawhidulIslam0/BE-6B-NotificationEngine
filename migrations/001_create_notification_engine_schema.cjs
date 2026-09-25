/* global exports */

const monthStart = (year, month) =>
  `${year}-${String(month).padStart(2, '0')}-01`;

exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 320).notNullable().unique();
    table.string('phone', 32).unique();
    table.string('timezone', 64).notNullable().defaultTo('UTC');
    table.boolean('is_active').notNullable().defaultTo(true);
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE TABLE notifications (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id uuid NOT NULL,
      event_type varchar(120) NOT NULL,
      status varchar(32) NOT NULL DEFAULT 'queued',
      priority varchar(16) NOT NULL DEFAULT 'normal',
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id, created_at),
      UNIQUE (event_id, created_at),
      CHECK (status IN ('queued', 'processing', 'delivered', 'failed', 'cancelled')),
      CHECK (priority IN ('low', 'normal', 'high', 'critical'))
    ) PARTITION BY RANGE (created_at)
  `);

  const currentYear = new Date().getUTCFullYear();
  for (const year of [currentYear, currentYear + 1]) {
    for (let month = 1; month <= 12; month += 1) {
      const start = monthStart(year, month);
      const end =
        month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1);
      await knex.raw(
        `CREATE TABLE notifications_${year}_${String(month).padStart(2, '0')} PARTITION OF notifications FOR VALUES FROM ('${start}') TO ('${end}')`,
      );
    }
  }
  await knex.raw(
    'CREATE TABLE notifications_default PARTITION OF notifications DEFAULT',
  );

  await knex.schema.createTable('notification_state_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('notification_id').notNullable();
    table.timestamp('notification_created_at', { useTz: true }).notNullable();
    table.string('from_state', 32);
    table.string('to_state', 32).notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .foreign(['notification_id', 'notification_created_at'])
      .references(['id', 'created_at'])
      .inTable('notifications')
      .onDelete('CASCADE');
  });

  await knex.schema.createTable('user_preferences', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('channel', 32).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.string('quiet_hours_start', 5);
    table.string('quiet_hours_end', 5);
    table.jsonb('event_types').notNullable().defaultTo('[]');
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(['user_id', 'channel']);
  });

  await knex.schema.createTable('templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_type', 120).notNullable();
    table.string('channel', 32).notNullable();
    table.string('locale', 16).notNullable().defaultTo('en');
    table.string('version', 32).notNullable().defaultTo('1');
    table.text('subject');
    table.text('body').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(['event_type', 'channel', 'locale', 'version']);
  });

  await knex.schema.createTable('delivery_providers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('channel', 32).notNullable();
    table.string('name', 64).notNullable();
    table.integer('priority').notNullable().defaultTo(100);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.jsonb('configuration').notNullable().defaultTo('{}');
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(['channel', 'name']);
  });

  await knex.schema.createTable('consent_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('purpose', 64).notNullable();
    table.string('channel', 32).notNullable();
    table.boolean('granted').notNullable();
    table
      .timestamp('recorded_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('revoked_at', { useTz: true });
    table.index(['user_id', 'purpose', 'channel']);
  });

  await knex.schema.createTable('dead_letter_queue', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('event_id').notNullable().unique();
    table.string('event_type', 120).notNullable();
    table.jsonb('payload').notNullable();
    table.string('reason', 255).notNullable();
    table.integer('retry_count').notNullable().defaultTo(0);
    table.string('status', 32).notNullable().defaultTo('pending');
    table.timestamp('next_retry_at', { useTz: true });
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true });
    table.index(['status', 'next_retry_at']);
  });

  await knex.raw(
    'CREATE INDEX notifications_user_created_at_idx ON notifications (user_id, created_at DESC)',
  );
  await knex.raw(
    'CREATE INDEX notifications_status_created_at_idx ON notifications (status, created_at DESC)',
  );
  await knex.raw(
    'CREATE INDEX notifications_event_type_created_at_idx ON notifications (event_type, created_at DESC)',
  );
  await knex.raw(
    'CREATE INDEX notification_state_log_notification_idx ON notification_state_log (notification_id, notification_created_at, created_at DESC)',
  );
  await knex.raw(
    'CREATE INDEX templates_lookup_idx ON templates (event_type, channel, locale) WHERE is_active = true',
  );
  await knex.raw(
    'CREATE INDEX delivery_providers_channel_idx ON delivery_providers (channel, priority) WHERE is_active = true',
  );
  await knex.raw('CREATE INDEX users_active_idx ON users (is_active)');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('dead_letter_queue');
  await knex.schema.dropTableIfExists('consent_records');
  await knex.schema.dropTableIfExists('delivery_providers');
  await knex.schema.dropTableIfExists('templates');
  await knex.schema.dropTableIfExists('user_preferences');
  await knex.schema.dropTableIfExists('notification_state_log');
  await knex.schema.raw('DROP TABLE IF EXISTS notifications CASCADE');
  await knex.schema.dropTableIfExists('users');
};
