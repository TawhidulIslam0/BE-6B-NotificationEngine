import Redis from 'ioredis';
import { env } from '../../config/env.js';

export const redis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
