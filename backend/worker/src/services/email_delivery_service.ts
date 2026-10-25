// import type { EmailSender } from "../../../shared/src/email/email_sender";
// import { EmailDeliveryRepository } from "../repositories/email_delivery_repository";
// import { PermanentDeliveryError } from "../errors/permanent_delivery_error.js";

// export type DeliveryProcessingResult =
//   | { kind: "SKIPPED" }
//   | { kind: "DELAY_UNTIL"; scheduledAt: Date }
//   | { kind: "PROCESSED" };


// interface SmtpError {
//   code?: string;
//   responseCode?: number;
// }

// function isRetryableError(error: unknown): boolean {
//   if (!(error instanceof Error)) {
//     return true;
// }

//     const smtpError = error as Error & SmtpError;

//     if(smtpError.responseCode !== undefined){

//         return smtpError.responseCode >= 400 && smtpError.responseCode < 500;
//     }

//     if (smtpError.code === "EAUTH" || smtpError.code === "EENVELOPE") {
//     return false;
//   }

//   // netwrok failure must retry
//   return true;

// }

// function getErrorMessage(error: unknown): string {
//   return error instanceof Error
//     ? error.message
//     : "Unknown email delivery error";
// }


// export class EmailDeliveryService {

//     constructor(
//     private readonly deliveryRepository: EmailDeliveryRepository,
//     private readonly emailSender: EmailSender,
//   ) {}


//   async processDelivery(deliveryID: string, isFinalAttempt: boolean): Promise<DeliveryProcessingResult> {
//     const existing = await this.deliveryRepository.findByID(deliveryID);

//     if (!existing || existing.status !== "SCHEDULED") {
//       return { kind: "SKIPPED" };
//     }


//     if (existing.scheduled_at.getTime() > Date.now()) {
//       return {
//         kind: "DELAY_UNTIL",
//         scheduledAt: existing.scheduled_at,
//       };
//     }


//         const claimed = await this.deliveryRepository.claimForProcessing(deliveryID);
//          if (!claimed) {
//             return { kind: 'SKIPPED' };
//         }

//         const { delivery, attempt } = claimed;
//         const { campaign } = delivery;
//         const { sender }  = campaign;

//     if (!sender.is_active) {

//         const message = `Sender ${sender.id} is inactive`;

//         await this.deliveryRepository.markFailed(delivery.id, attempt.id,message);

//         throw new PermanentDeliveryError(message);
// }

//         let result: Awaited<ReturnType<EmailSender["send"]>>
//         try{


//             result = await this.emailSender.send({
//                     from: sender.display_name
//             ? `${sender.display_name} <${sender.email}>`
//             : sender.email,
//             to: delivery.recipient_email,
//             subject: campaign.subject,
//             text: campaign.body_text,
//             html: campaign.body_html as string
//             });

//             // await this.deliveryRepository.markSent(deliveryID, attempt.id, result.messageId);


//         }catch(error: unknown) {
//             const message = getErrorMessage(error);
//             const retryable = isRetryableError(error)
            
//             if (retryable && !isFinalAttempt) {
//         await this.deliveryRepository.markRetryable(
//           delivery.id,
//           attempt.id,
//           message,
//         );
//       }

//       else {
//         await this.deliveryRepository.markFailed(
//           delivery.id,
//           attempt.id,
//           message,
//         );

//         if (!retryable) {
//         throw new PermanentDeliveryError(message);
//       }

//       throw error;
        
//     }


// }
// await this.deliveryRepository.markSent(

//     delivery.id,
//     attempt.id,
//     result.messageId,
//   );

//     return { kind: "PROCESSED" };
//   }
  
// }


import { PermanentDeliveryError } from "../errors/permanent_delivery_error.js";
import type { EmailSender } from "../../../shared/src/email/email_sender.js";
import { EmailDeliveryRepository } from "../repositories/email_delivery_repository.js";
import { RateLimiter } from "../../../shared/src/redis/rate_limiter.js";
import { SlackService } from "../../../shared/src/slack/slack_service.js";


export type DeliveryProcessingResult =
  | { kind: "SKIPPED" }
  | { kind: "DELAY_UNTIL"; scheduledAt: number }
  | { kind: "PROCESSED" }
  | { kind: "DONE" };

interface SmtpError {
  code?: string;
  responseCode?: number;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }

  const smtpError = error as Error & SmtpError;

  if (smtpError.responseCode !== undefined) {
    return smtpError.responseCode >= 400 && smtpError.responseCode < 500;
  }

  if (smtpError.code === "EAUTH" || smtpError.code === "EENVELOPE") {
    return false;
  }

  // Network failures are generally transient. Unknown errors receive
  // bounded BullMQ retries rather than being discarded immediately.
  return true;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown email delivery error";
}

export class EmailDeliveryService {
  constructor(
    private readonly deliveryRepository: EmailDeliveryRepository,
    private readonly emailSender: EmailSender,
    private readonly rateLimiter: RateLimiter,
    private readonly slackService: SlackService,
  ) {}

  async processDelivery(
    deliveryId: string,
    isFinalAttempt: boolean,
  ): Promise<DeliveryProcessingResult> {

    const delivery = await this.deliveryRepository.findByID(deliveryId);

if (!delivery || delivery.status !== "SCHEDULED") {
  return { kind: "DONE" as const };
}

const scheduledAt = delivery.scheduled_at.getTime();

if (scheduledAt > Date.now()) {
  return { kind: "DELAY_UNTIL" as const, scheduledAt: scheduledAt };
}

const claimed = await this.deliveryRepository.claimForProcessing(deliveryId);

if (!claimed) {
  return { kind: "DONE" as const };
}

if (!claimed.campaign.sender.is_active) {
  const attempt = await this.deliveryRepository.createAttempt(deliveryId);
  const error = "Sender is inactive";

  await this.deliveryRepository.markFailed(deliveryId, attempt.id, error);
  throw new PermanentDeliveryError(error);
}

const permit = await this.rateLimiter.reserve(
  claimed.campaign.sender.id,
);

if (!permit.allowed) {
  await this.deliveryRepository.releaseRateLimitedClaim(deliveryId);

  // Send Slack notification (deduplicated internally)
  void this.slackService.sendRateLimitNotification(
    claimed.campaign.sender.id,
    claimed.campaign.user_id,
    permit.retryAt
  ).catch(err => console.error("Slack notification failed", err));

  return {
    kind: "DELAY_UNTIL" as const,
    scheduledAt: permit.retryAt,
  };
}

const { campaign } = delivery;
const { sender } = campaign;

const attempt = await this.deliveryRepository.createAttempt(deliveryId);

    let result: Awaited<ReturnType<EmailSender["send"]>>;

    try {
      result = await this.emailSender.send({
        from: sender.display_name
          ? `${sender.display_name} <${sender.email}>`
          : sender.email,
        to: delivery.recipient_email,
        subject: campaign.subject,
        text: campaign.body_text,
        html: campaign.body_html as string,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const retryable = isRetryableError(error);

      if (retryable && !isFinalAttempt) {
        await this.deliveryRepository.markRetryable(
          delivery.id,
          attempt.id,
          message,
        );
      } else {
        await this.deliveryRepository.markFailed(
          delivery.id,
          attempt.id,
          message,
        );
      }

      if (!retryable) {
        throw new PermanentDeliveryError(message);
      }

      throw error;
    }

    // Keep database persistence outside the SMTP catch block.
    // A database error after SMTP acceptance is an ambiguous outcome:
    // automatically sending again could create a duplicate email.
    await this.deliveryRepository.markSent(
      delivery.id,
      attempt.id,
      result.messageId,
    );

    return { kind: "PROCESSED" };
  }
}