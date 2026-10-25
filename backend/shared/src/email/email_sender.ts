export interface SendEmailInput{
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
}


export interface SendEmailResult {

    messageId: string;
    previewURL: string | false;
}

export interface EmailSender {

    send(input: SendEmailInput): Promise<SendEmailResult>;
}

