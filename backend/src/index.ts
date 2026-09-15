import { createServer } from 'node:http';
export * from './delivery/health/provider-health-service.js';
import { createApp } from './app.js';
import {
  EmailProvider,
  InAppProvider,
  ProviderHealthService,
  PushProvider,
  WhatsAppProvider,
} from './delivery/index.js';
import { SmsProvider } from './delivery/providers/sms-provider.js';
import { SocketNotificationServer } from './infrastructure/socket/socket-server.js';

const port = Number(process.env.PORT ?? 3000);

const emailProvider = new EmailProvider({
  testMode: true,
  providerName: 'email-test-provider',
});

const smsProvider = new SmsProvider({
  testMode: true,
  providerName: 'sms-test-provider',
});

const pushProvider = new PushProvider({
  testMode: true,
  providerName: 'fcm-test-provider',
});

const whatsappProvider = new WhatsAppProvider({
  testMode: true,
  providerName: 'whatsapp-test-provider',
});

const app = createApp();
const httpServer = createServer(app);

const socketNotificationServer = new SocketNotificationServer(httpServer);

const inAppProvider = new InAppProvider({
  providerName: 'socket-io-in-app',
  socketNotificationServer,
});

const providerHealthService = new ProviderHealthService([
  emailProvider,
  smsProvider,
  pushProvider,
  whatsappProvider,
  inAppProvider,
]);

const application = createApp(providerHealthService);

httpServer.removeAllListeners('request');
httpServer.on('request', application);

httpServer.listen(port, () => {
  console.log(`Notification Engine backend is running on port ${port}`);
  console.log('Socket.io notification server is running');
  console.log(`In-app provider initialized: ${inAppProvider.constructor.name}`);
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Shutting down gracefully...`);

  await socketNotificationServer.close();

  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
