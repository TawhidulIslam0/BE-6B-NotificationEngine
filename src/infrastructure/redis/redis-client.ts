import Redis from 'ioredis';
import { env } from '../../config/env.js';

/** Shared Redis client used for cache, deduplication, and rate limits. */
export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
