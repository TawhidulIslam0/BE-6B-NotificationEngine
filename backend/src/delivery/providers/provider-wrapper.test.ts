import { describe, expect, it, vi } from 'vitest';

import { ProviderWrapper } from './provider-wrapper.js';
import type {
  DeliveryProvider,
  DeliveryReceipt,
  PreparedNotification,
  ProviderHealth,
  ProviderQuota,
  RecipientValidationResult,
} from './types.js';

const notification: PreparedNotification = {
  id: 'notification-wrapper-001',
  userId: 'user-001',
  channel: 'email',
  recipient: 'user@example.com',
  subject: 'Test notification',
  body: 'Test message',
};

const receipt: DeliveryReceipt = {
  externalId: 'external-001',
  status: 'accepted',
  provider: 'test-provider',
};

const health: ProviderHealth = {
  provider: 'test-provider',
  healthy: true,
  checkedAt: new Date().toISOString(),
  message: 'Provider is healthy',
};

const quota: ProviderQuota = {
  remaining: 100,
};

const recipientValidation: RecipientValidationResult = {
  valid: true,
};

function createProvider(): DeliveryProvider {
  return {
    send: vi.fn().mockResolvedValue(receipt),
    getStatus: vi.fn().mockResolvedValue(receipt),
    validateRecipient: vi.fn().mockResolvedValue(recipientValidation),
    getQuota: vi.fn().mockResolvedValue(quota),
    healthCheck: vi.fn().mockResolvedValue(health),
  };
}

function createRateLimiter() {
  return {
    waitForSlot: vi.fn().mockResolvedValue(undefined),
  };
}

function createCircuitBreaker() {
  return {
    execute: vi
      .fn()
      .mockImplementation(async <T>(operation: () => Promise<T>): Promise<T> =>
        operation(),
      ),
    getState: vi.fn().mockReturnValue('CLOSED'),
  };
}

describe('ProviderWrapper', () => {
  it('waits for a rate-limit slot before sending', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.send(notification)).resolves.toEqual(receipt);

    expect(rateLimiter.waitForSlot).toHaveBeenCalledOnce();
    expect(provider.send).toHaveBeenCalledWith(notification);
    expect(circuitBreaker.execute).toHaveBeenCalledOnce();
  });

  it('propagates send errors', async () => {
    const provider = createProvider();
    const error = new Error('send failed');
    vi.mocked(provider.send).mockRejectedValue(error);

    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.send(notification)).rejects.toThrow('send failed');
    expect(rateLimiter.waitForSlot).toHaveBeenCalledOnce();
  });

  it('waits for a rate-limit slot before getting status', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.getStatus('external-001')).resolves.toEqual(receipt);

    expect(rateLimiter.waitForSlot).toHaveBeenCalledOnce();
    expect(provider.getStatus).toHaveBeenCalledWith('external-001');
    expect(circuitBreaker.execute).toHaveBeenCalledOnce();
  });

  it('waits for a rate-limit slot before validating a recipient', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(
      wrapper.validateRecipient('user@example.com'),
    ).resolves.toEqual(recipientValidation);

    expect(rateLimiter.waitForSlot).toHaveBeenCalledOnce();
    expect(provider.validateRecipient).toHaveBeenCalledWith('user@example.com');
    expect(circuitBreaker.execute).toHaveBeenCalledOnce();
  });

  it('does not use the rate limiter for quota checks', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.getQuota()).resolves.toEqual(quota);

    expect(rateLimiter.waitForSlot).not.toHaveBeenCalled();
    expect(provider.getQuota).toHaveBeenCalledOnce();
    expect(circuitBreaker.execute).toHaveBeenCalledOnce();
  });

  it('uses the provider health check when no override is configured', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.healthCheck()).resolves.toEqual(health);

    expect(provider.healthCheck).toHaveBeenCalledOnce();
  });

  it('uses the configured health-check override', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const customHealth: ProviderHealth = {
      provider: 'custom-health',
      healthy: false,
      checkedAt: new Date().toISOString(),
      message: 'Custom health check',
    };

    const healthCheck = vi.fn().mockResolvedValue(customHealth);

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
      healthCheck,
    });

    await expect(wrapper.healthCheck()).resolves.toEqual(customHealth);

    expect(healthCheck).toHaveBeenCalledOnce();
    expect(provider.healthCheck).not.toHaveBeenCalled();
  });

  it('returns the current circuit breaker state', () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    expect(wrapper.getCircuitState()).toBe('CLOSED');
    expect(circuitBreaker.getState).toHaveBeenCalledOnce();
  });

  it('propagates rate limiter errors', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const error = new Error('rate limiter failed');
    rateLimiter.waitForSlot.mockRejectedValue(error);

    const circuitBreaker = createCircuitBreaker();

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.send(notification)).rejects.toThrow(
      'rate limiter failed',
    );

    expect(provider.send).not.toHaveBeenCalled();
    expect(circuitBreaker.execute).not.toHaveBeenCalled();
  });

  it('propagates circuit breaker errors', async () => {
    const provider = createProvider();
    const rateLimiter = createRateLimiter();
    const circuitBreaker = createCircuitBreaker();

    circuitBreaker.execute.mockRejectedValue(
      new Error('Circuit breaker is open'),
    );

    const wrapper = new ProviderWrapper(provider, {
      providerName: 'test-provider',
      rateLimiter: rateLimiter as never,
      circuitBreaker: circuitBreaker as never,
    });

    await expect(wrapper.send(notification)).rejects.toThrow(
      'Circuit breaker is open',
    );

    expect(rateLimiter.waitForSlot).toHaveBeenCalledOnce();
  });
});
