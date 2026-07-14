import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: Date
  /** Human-readable message to show the user when blocked */
  message?: string
}

/** Lazy Redis + Ratelimit singletons — not instantiated at build time */
let _redis: Redis | null = null
let _generateLimiter: Ratelimit | null = null
let _editLimiter: Ratelimit | null = null

function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Upstash Redis environment variables are not set')
    }
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}

function getGenerateLimiter(): Ratelimit {
  if (!_generateLimiter) {
    _generateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '24h'),
      prefix: 'barshi:generate',
    })
  }
  return _generateLimiter
}

function getEditLimiter(): Ratelimit {
  if (!_editLimiter) {
    _editLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, '24h'),
      prefix: 'barshi:edit',
    })
  }
  return _editLimiter
}

export async function checkGenerateLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining, reset } = await getGenerateLimiter().limit(userId)
  return {
    allowed: success,
    remaining,
    resetAt: new Date(reset),
    message: success
      ? undefined
      : "You've used all 3 creations for today. Come back tomorrow — or go Pro for unlimited.",
  }
}

export async function checkEditLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining, reset } = await getEditLimiter().limit(userId)
  return {
    allowed: success,
    remaining,
    resetAt: new Date(reset),
    message: success
      ? undefined
      : "You've made a lot of changes today! Come back tomorrow for more.",
  }
}
