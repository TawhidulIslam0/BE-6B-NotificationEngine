import { WhatsAppProvider } from '../src/delivery/providers/whatsapp-provider.js';

async function main(): Promise<void> {
  const provider = new WhatsAppProvider({
    providerName: 'whatsapp-test-provider',
    testMode: true,
  });

  const receipt = await provider.send({
    id: 'whatsapp-test-001',
    userId: 'user-001',
    channel: 'whatsapp',
    recipient: '+14155552671',
    body: 'This is a test WhatsApp notification.',
    metadata: {
      notificationType: 'test',
      source: 'notification-engine',
    },
  });

  console.log('WhatsApp delivery receipt:');
  console.dir(receipt, { depth: null });

  const health = await provider.healthCheck();

  console.log('WhatsApp provider health:');
  console.dir(health, { depth: null });
}

main().catch((error: unknown) => {
  console.error('WhatsApp provider test failed:', error);
});
