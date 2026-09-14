import { describe, expect, it } from 'vitest';
import { DndRegistryService } from '../../src/compliance/index.js';

describe('DND registry service', () => {
  it('returns a registered user', async () => {
    const service = new DndRegistryService();

    const result = await service.lookup('dnd-user-001');

    expect(result?.isRegistered).toBe(true);
  });

  it('returns null for an unknown user', async () => {
    const service = new DndRegistryService();

    expect(await service.lookup('unknown')).toBeNull();
  });

  it('caches lookup results', async () => {
    const service = new DndRegistryService();

    const first = await service.lookup('dnd-user-001');
    const second = await service.lookup('dnd-user-001');

    expect(first).toBe(second);
  });

  it('supports seeding entries', async () => {
    const service = new DndRegistryService();

    service.seed({
      userId: 'user-2',
      phoneNumber: '+15550000002',
      isRegistered: false,
      source: 'simulated-dnd-database',
    });

    expect(
      await service.lookup('user-2'),
    ).toMatchObject({
      isRegistered: false,
    });
  });

  it('invalidates a cached entry', async () => {
    const service = new DndRegistryService();

    await service.lookup('dnd-user-001');
    service.invalidate('dnd-user-001');

    expect(
      await service.lookup('dnd-user-001'),
    ).not.toBeNull();
  });
});