import { Redis } from "ioredis";

export interface RedisConfig {
    host: string;
    port: number;
};

export function createRedisConnection(config: RedisConfig):Redis {

    const conn = new Redis({
        host: config.host,
        port: config.port,
        maxRetriesPerRequest: null,
    });

     conn.on("error", (error: Error) => {
    console.error("Redis connection error:", error.message);
  });



  return conn;


}

