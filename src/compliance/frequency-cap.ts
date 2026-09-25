import type { FrequencyCapRequest, FrequencyCapResult } from './types.js';
import { redis } from '../infrastructure/redis/redis-client.js';

const ATOMIC_FREQUENCY_CAP_SCRIPT = `
local now = tonumber(ARGV[1])
local ruleCount = tonumber(ARGV[2])
local offset = 3

for i = 1, ruleCount do
  local key = KEYS[i]
  local limit = tonumber(ARGV[offset])
  local windowSeconds = tonumber(ARGV[offset + 1])
  local windowStart = now - (windowSeconds * 1000)

  redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

  local count = redis.call('ZCARD', key)

  if count >= limit then
    return {0, i, count}
  end

  offset = offset + 2
end

offset = 3

for i = 1, ruleCount do
  local key = KEYS[i]
  local windowSeconds = tonumber(ARGV[offset + 1])
  local member = tostring(now) .. ':' .. tostring(math.random())

  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, windowSeconds)

  offset = offset + 2
end

return {1, 0, 0}
`;

/** Atomically evaluates and records Redis-backed notification frequency caps. */
export class FrequencyCapService {
  /** Checks all rules and records a usage entry when the request is allowed. */
  async check(request: FrequencyCapRequest): Promise<FrequencyCapResult> {
    if (request.rules.length === 0) {
      return {
        allowed: true,
        counts: {},
      };
    }

    const now = Date.now();

    const keys = request.rules.map((rule) =>
      [
        'frequency-cap',
        request.userId,
        request.channel,
        request.eventType,
        rule.name,
      ].join(':'),
    );

    const args = [
      String(now),
      String(request.rules.length),
      ...request.rules.flatMap((rule) => [
        String(rule.limit),
        String(rule.windowSeconds),
      ]),
    ];

    const result = (await redis.eval(
      ATOMIC_FREQUENCY_CAP_SCRIPT,
      keys.length,
      ...keys,
      ...args,
    )) as [number, number, number];

    const [allowedFlag, exceededRuleIndex, exceededCount] = result;
    const counts: Record<string, number> = {};

    for (let index = 0; index < request.rules.length; index += 1) {
      const rule = request.rules[index];

      if (index + 1 === exceededRuleIndex) {
        counts[rule.name] = exceededCount;
      } else {
        const key = keys[index];
        counts[rule.name] = await redis.zcard(key);
      }
    }

    if (allowedFlag === 0) {
      return {
        allowed: false,
        exceededRule:
          request.rules[exceededRuleIndex - 1]?.name ?? 'unknown rule',
        counts,
      };
    }

    return {
      allowed: true,
      counts,
    };
  }

  /** Clears all frequency-cap keys, primarily for test or reset workflows. */
  async clear(): Promise<void> {
    const keys = await redis.keys('frequency-cap:*');

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
