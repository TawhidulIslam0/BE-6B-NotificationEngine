import type { SmsMessage, SmsProvider } from './types.js';

/** Deterministic SMS provider used by local and integration workflows. */
export class MockSmsProvider implements SmsProvider {
  public readonly sentMessages: SmsMessage[] = [];

  async send(message: SmsMessage): Promise<void> {
    this.sentMessages.push(message);
  }
}
