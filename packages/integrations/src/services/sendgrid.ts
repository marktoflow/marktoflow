/**
 * SendGrid Integration
 *
 * Transactional email delivery service.
 * API Docs: https://docs.sendgrid.com/api-reference
 * SDK: https://github.com/sendgrid/sendgrid-nodejs
 */

import sgMail from '@sendgrid/mail';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface SendEmailOptions {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
  }>;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * SendGrid client wrapper for workflow integration
 */
export class SendGridClient {
  constructor(apiKey: string) {
    sgMail.setApiKey(apiKey);
  }

  /**
   * Send a single email
   */
  async sendEmail(options: SendEmailOptions) {
    const msg: Record<string, unknown> = {
      to: options.to,
      from: options.from,
      subject: options.subject,
    };

    if (options.text) msg.text = options.text;
    if (options.html) msg.html = options.html;
    if (options.templateId) {
      msg.templateId = options.templateId;
      msg.dynamicTemplateData = options.dynamicTemplateData;
    }
    if (options.attachments) msg.attachments = options.attachments;
    if (options.replyTo) msg.replyTo = options.replyTo;
    if (options.cc) msg.cc = options.cc;
    if (options.bcc) msg.bcc = options.bcc;

    return await sgMail.send(msg as unknown as sgMail.MailDataRequired);
  }

  /**
   * Send multiple emails
   */
  async sendMultiple(messages: SendEmailOptions[]) {
    const msgs = messages.map((options) => {
      const msg: Record<string, unknown> = {
        to: options.to,
        from: options.from,
        subject: options.subject,
      };

      if (options.text) msg.text = options.text;
      if (options.html) msg.html = options.html;
      if (options.templateId) {
        msg.templateId = options.templateId;
        msg.dynamicTemplateData = options.dynamicTemplateData;
      }
      if (options.attachments) msg.attachments = options.attachments;
      if (options.replyTo) msg.replyTo = options.replyTo;
      if (options.cc) msg.cc = options.cc;
      if (options.bcc) msg.bcc = options.bcc;

      return msg as unknown as sgMail.MailDataRequired;
    });

    return await sgMail.send(msgs);
  }
}

export const SendGridInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const apiKey = config.auth?.['api_key'] as string | undefined;

    if (!apiKey) {
      throw new Error('SendGrid SDK requires auth.api_key');
    }

    const client = new SendGridClient(apiKey);

    return {
      client,
      actions: client,
    };
  },
};
