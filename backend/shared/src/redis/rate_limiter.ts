import type { Redis } from "ioredis";

export interface RateLimitDecision {

    allowed: boolean;
    retryAt: number;
}


const RESERVE_SCRIPT = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local interval = tonumber(ARGV[3])
local nextHour = tonumber(ARGV[4])

local count = tonumber(redis.call("GET", KEYS[1]) or "0")
local nextAllowed = tonumber(redis.call("GET", KEYS[2]) or "0")

if count >= limit then
  local retryAt = math.max(nextHour, nextAllowed)
  return {0, retryAt}
end

if nextAllowed > now then
  return {0, nextAllowed}
end

redis.call("INCR", KEYS[1])
redis.call("PEXPIRE", KEYS[1], 7200000)
redis.call("SET", KEYS[2], now + interval, "PX", 86400000)

return {1, now}
`;

export class RateLimiter {

    constructor(
        private readonly redis: Redis,
        private readonly maxEmailsPerHour: number,
        private readonly minDelayMs: number,

    ){

        if (!Number.isInteger(maxEmailsPerHour) || maxEmailsPerHour < 1) {
      throw new Error("MAX_EMAILS_PER_HOUR_PER_SENDER must be positive");
    }

    if (!Number.isInteger(minDelayMs) || minDelayMs < 1) {
      throw new Error("MIN_EMAIL_DELAY_MS must be positive");
    }

    }

    async reserve(senderId: string): Promise<RateLimitDecision> {

        const now = Date.now();
        const hourWindow = Math.floor(now / 3_600_000);
        const nextHour = (hourWindow + 1) * 3_600_000;
        
        const hourKey = `email-rate:{${senderId}}:hour:${hourWindow}`;
        const nextKey = `email-rate:{${senderId}}:next`;


        const result = await (this.redis.eval(
            RESERVE_SCRIPT,
            2,
            hourKey,
            nextKey,
            now,
            this.maxEmailsPerHour,
            this.minDelayMs,
            nextHour,
        )) as [number | string, number | string];

    return {
        allowed: Number(result[0]) === 1,
        retryAt: Number(result[1]),
        };
    }

}
