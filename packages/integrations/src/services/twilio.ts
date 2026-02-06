/**
 * Twilio Integration
 *
 * Programmable SMS, voice, and video communications.
 * API Docs: https://www.twilio.com/docs/api
 * SDK: https://www.twilio.com/docs/libraries/node
 */

import twilio from 'twilio';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';

export type TwilioClient = twilio.Twilio;

export interface SendMessageOptions {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string[];
  statusCallback?: string;
}

export interface MakeCallOptions {
  to: string;
  from: string;
  url: string;
  method?: 'GET' | 'POST';
  statusCallback?: string;
  statusCallbackMethod?: 'GET' | 'POST';
}

export interface SendWhatsAppOptions {
  to: string; // Format: whatsapp:+1234567890
  from: string; // Format: whatsapp:+1234567890
  body: string;
  mediaUrl?: string[];
}

/**
 * Twilio client wrapper for workflow integration
 */
export class TwilioClientWrapper {
  constructor(private client: twilio.Twilio) {}

  // ==================== SMS ====================

  /**
   * Send an SMS message
   */
  async sendSMS(options: SendMessageOptions) {
    return await this.client.messages.create({
      to: options.to,
      from: options.from,
      body: options.body,
      mediaUrl: options.mediaUrl,
      statusCallback: options.statusCallback,
    });
  }

  /**
   * Get message by SID
   */
  async getMessage(messageSid: string) {
    return await this.client.messages(messageSid).fetch();
  }

  /**
   * List messages
   */
  async listMessages(options?: { to?: string; from?: string; limit?: number }) {
    return await this.client.messages.list(options || {});
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageSid: string) {
    return await this.client.messages(messageSid).remove();
  }

  // ==================== Voice ====================

  /**
   * Make a phone call
   */
  async makeCall(options: MakeCallOptions) {
    return await this.client.calls.create({
      to: options.to,
      from: options.from,
      url: options.url,
      method: options.method,
      statusCallback: options.statusCallback,
      statusCallbackMethod: options.statusCallbackMethod,
    });
  }

  /**
   * Get call by SID
   */
  async getCall(callSid: string) {
    return await this.client.calls(callSid).fetch();
  }

  /**
   * List calls
   */
  async listCalls(options?: { to?: string; from?: string; status?: string; limit?: number }) {
    return await this.client.calls.list((options as any) || {});
  }

  /**
   * Update a call (e.g., hang up)
   */
  async updateCall(callSid: string, options: { status?: string; url?: string }) {
    return await this.client.calls(callSid).update(options as any);
  }

  // ==================== WhatsApp ====================

  /**
   * Send a WhatsApp message
   */
  async sendWhatsApp(options: SendWhatsAppOptions) {
    return await this.client.messages.create({
      to: options.to,
      from: options.from,
      body: options.body,
      mediaUrl: options.mediaUrl,
    });
  }

  // ==================== Phone Numbers ====================

  /**
   * List available phone numbers
   */
  async listAvailablePhoneNumbers(countryCode: string, options?: { areaCode?: number; contains?: string }) {
    return await this.client.availablePhoneNumbers(countryCode).local.list(options || {});
  }

  /**
   * Purchase a phone number
   */
  async purchasePhoneNumber(phoneNumber: string) {
    return await this.client.incomingPhoneNumbers.create({ phoneNumber });
  }

  /**
   * List owned phone numbers
   */
  async listPhoneNumbers(options?: { phoneNumber?: string; limit?: number }) {
    return await this.client.incomingPhoneNumbers.list(options || {});
  }

  /**
   * Update phone number configuration
   */
  async updatePhoneNumber(phoneNumberSid: string, options: { smsUrl?: string; voiceUrl?: string; friendlyName?: string }) {
    return await this.client.incomingPhoneNumbers(phoneNumberSid).update(options);
  }

  /**
   * Release a phone number
   */
  async releasePhoneNumber(phoneNumberSid: string) {
    return await this.client.incomingPhoneNumbers(phoneNumberSid).remove();
  }

  // ==================== Verify ====================

  /**
   * Send verification code
   */
  async sendVerification(serviceSid: string, to: string, channel: 'sms' | 'call' | 'email' = 'sms') {
    return await this.client.verify.v2.services(serviceSid).verifications.create({ to, channel });
  }

  /**
   * Check verification code
   */
  async checkVerification(serviceSid: string, to: string, code: string) {
    return await this.client.verify.v2.services(serviceSid).verificationChecks.create({ to, code });
  }
}

export const TwilioInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const accountSid = config.auth?.['account_sid'] as string | undefined;
    const authToken = config.auth?.['auth_token'] as string | undefined;

    if (!accountSid || !authToken) {
      throw new Error('Twilio SDK requires auth.account_sid and auth.auth_token');
    }

    const client = twilio(accountSid, authToken);
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
    });

    return {
      client: wrapped,
      actions: wrapped,
      rawClient: client,
    };
  },
};
