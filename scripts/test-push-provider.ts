import { PushProvider } from '../src/delivery/providers/push-provider.js';

async function main(): Promise<void> {
  const provider = new PushProvider({
    providerName: 'fcm-test-provider',
    testMode: true,
  });

  const receipt = await provider.send({
    id: 'push-test-001',
    userId: 'user-001',
    channel: 'push',
    recipient: 'test-device-token-123',
    subject: 'Test Push Notification',
    body: 'This is a test push notification.',
    metadata: {
      screen: 'notifications',
      notificationType: 'test',
    },
  });

  console.log('Push delivery receipt:');
  console.dir(receipt, { depth: null });

  const health = await provider.healthCheck();

  console.log('Push provider health:');
  console.dir(health, { depth: null });
}

main().catch((error: unknown) => {
  console.error('Push provider test failed:', error);
});
