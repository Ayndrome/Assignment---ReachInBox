import nodemailer, { type Transporter } from "nodemailer";
import type {
  EmailSender,
  SendEmailInput,
  SendEmailResult,
} from "./email_sender";


export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

export class NodemailerEmailSender implements EmailSender {

    private readonly transporter: Transporter;

    constructor(config: SmtpConfig) {

        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            
        });

    }

    async send(input: SendEmailInput): Promise<SendEmailResult> {
        
        const info = await this.transporter.sendMail({
            from: input.from,
            to: input.to,
            subject: input.subject,
            text: input.text,
            html: input.html,

            
        });

        return {

            messageId: info.messageId,
            previewURL: nodemailer.getTestMessageUrl(info),
        };
    }

    async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }
  

}
