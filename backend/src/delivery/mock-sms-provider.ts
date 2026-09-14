import type { SmsMessage, SmsProvider } from './types.js';

export class MockSmsProvider implements SmsProvider {
  public readonly sentMessages: SmsMessage[] = [];

  async send(message: SmsMessage): Promise<void> {
    this.sentMessages.push(message);
  }
}