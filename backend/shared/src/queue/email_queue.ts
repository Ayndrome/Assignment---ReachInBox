import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import { QUEUE_NAMES } from "./queue_names";
import type { EmailDeliveryJob } from "./emaill_delivery_job";


export function createEmailQueue(connection: Redis) {

    return new Queue<EmailDeliveryJob>(QUEUE_NAMES.EMAIL_DELIVERY, {
        connection,
        defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: "exponential",
                delay: 2_000,
            },

            removeOnComplete: {
                age: 24 * 60 * 60,
                count: 1_000,
            },

            removeOnFail: false,
        }
    });

}