import { z } from 'zod';
import { preferenceChannels } from './types.js';

const preferenceModeSchema = z.enum(['immediate', 'digest', 'disabled']);

const channelPreferenceSchema = z.object({
  enabled: z.boolean(),
  mode: preferenceModeSchema,
});

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().min(1).max(5),
  end: z.string().min(1).max(5),
});

export const preferencePatchSchema = z
  .object({
    locale: z.enum(['en', 'hi', 'mr', 'ta', 'te']).optional(),
    timezone: z.string().min(1).max(100).optional(),
    quietHours: quietHoursSchema.optional(),
    channels: z
      .object(
        Object.fromEntries(
          preferenceChannels.map((channel) => [
            channel,
            channelPreferenceSchema.optional(),
          ]),
        ),
      )
      .strict()
      .optional(),
    categories: z.record(z.string().min(1).max(100), z.boolean()).optional(),
  })
  .strict();

export type ValidatedPreferencePatch = z.infer<typeof preferencePatchSchema>;
