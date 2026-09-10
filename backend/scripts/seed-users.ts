import { database } from '../src/infrastructure/postgres/client.js';

const channels = ['email', 'sms', 'push', 'whatsapp', 'in-app'] as const;
const timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Dhaka', 'Asia/Tokyo'];

async function seedUsers(): Promise<void> {
  const users = Array.from({ length: 1000 }, (_, index) => ({
    email: `test-user-${String(index + 1).padStart(4, '0')}@example.com`,
    phone: `+155500${String(index + 1).padStart(4, '0')}`,
    timezone: timezones[index % timezones.length],
    is_active: index % 20 !== 0,
  }));

  await database.transaction(async (transaction) => {
    await transaction('users').insert(users).onConflict('email').ignore();
    const storedUsers = await transaction('users').select('id', 'email');
    const preferences = storedUsers.map((user, index) => ({
      user_id: user.id,
      channel: channels[index % channels.length],
      enabled: index % 7 !== 0,
      quiet_hours_start: index % 3 === 0 ? '22:00' : null,
      quiet_hours_end: index % 3 === 0 ? '07:00' : null,
      event_types: JSON.stringify(index % 2 === 0 ? ['user.welcome', 'order.shipped'] : []),
    }));
    await transaction('user_preferences').insert(preferences).onConflict(['user_id', 'channel']).ignore();
  });

  await database.destroy();
}

seedUsers().catch(async (error: unknown) => {
  console.error(error);
  await database.destroy();
  process.exitCode = 1;
});