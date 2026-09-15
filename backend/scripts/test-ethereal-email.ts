import { EmailProvider } from '../src/delivery/providers/email-provider.js';

async function main(): Promise<void> {
  const provider = await EmailProvider.createEthereal({
    fromAddress: 'notification-engine@example.com',
  });

  const receipt = await provider.send({
    id: 'email-ethereal-test-001',
    userId: 'user-001',
    channel: 'email',
    recipient: 'recipient@example.com',
    subject: 'Notification Engine Ethereal Test',
    body: 'This is a test email from the Notification Engine.',
  });

  console.log('Email delivery receipt:');
  console.dir(receipt, { depth: null });

  const health = await provider.healthCheck();

  console.log('Email provider health:');
  console.dir(health, { depth: null });
}

main().catch((error: unknown) => {
  console.error('Ethereal email test failed:', error);
});
