/**
 * WhatsApp Integration
 *
 * Messaging platform via WhatsApp Business API.
 * API Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

export interface WhatsAppMessage {
  messagingProduct: 'whatsapp';
  to: string;
  type:
    | 'text'
    | 'template'
    | 'image'
    | 'video'
    | 'document'
    | 'audio'
    | 'location'
    | 'contacts'
    | 'interactive';
  text?: { body: string; previewUrl?: boolean };
  template?: WhatsAppTemplate;
  image?: { link?: string; id?: string; caption?: string };
  video?: { link?: string; id?: string; caption?: string };
  document?: { link?: string; id?: string; caption?: string; filename?: string };
  audio?: { link?: string; id?: string };
  location?: { longitude: number; latitude: number; name?: string; address?: string };
  interactive?: WhatsAppInteractive;
}

export interface WhatsAppTemplate {
  name: string;
  language: { code: string };
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallbackValue: string; code: string; amount1000: number };
  dateTime?: { fallbackValue: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

export interface WhatsAppInteractive {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string };
  };
  body: { text: string };
  footer?: { text: string };
  action: WhatsAppAction;
}

export interface WhatsAppAction {
  buttons?: WhatsAppButton[];
  button?: string;
  sections?: WhatsAppSection[];
}

export interface WhatsAppButton {
  type: 'reply';
  reply: { id: string; title: string };
}

export interface WhatsAppSection {
  title?: string;
  rows: WhatsAppRow[];
}

export interface WhatsAppRow {
  id: string;
  title: string;
  description?: string;
}

export interface SendTextOptions {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
}

export interface SendMediaOptions {
  to: string;
  mediaUrl?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

export interface SendLocationOptions {
  to: string;
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

export interface SendInteractiveOptions {
  to: string;
  type: 'button' | 'list';
  bodyText: string;
  headerText?: string;
  footerText?: string;
  buttons?: { id: string; title: string }[];
  listButton?: string;
  sections?: WhatsAppSection[];
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mimeType: string; sha256: string };
  video?: { id: string; mimeType: string; sha256: string };
  document?: { id: string; mimeType: string; sha256: string; filename: string };
  audio?: { id: string; mimeType: string; sha256: string };
  location?: { longitude: number; latitude: number; name?: string; address?: string };
}

/**
 * WhatsApp Business API client for workflow integration
 */
export class WhatsAppClient {
  private apiUrl: string;

  constructor(
    phoneNumberId: string,
    private accessToken: string
  ) {
    this.apiUrl = `${WHATSAPP_API_URL}/${phoneNumberId}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Send a text message
   */
  async sendText(
    options: SendTextOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'text',
      text: {
        body: options.text,
        preview_url: options.previewUrl ?? false,
      },
    });
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    options: SendTemplateOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'template',
      template: {
        name: options.templateName,
        language: {
          code: options.languageCode,
        },
        components: options.components,
      },
    });
  }

  /**
   * Send an image
   */
  async sendImage(
    options: SendMediaOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'image',
      image: {
        link: options.mediaUrl,
        id: options.mediaId,
        caption: options.caption,
      },
    });
  }

  /**
   * Send a video
   */
  async sendVideo(
    options: SendMediaOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'video',
      video: {
        link: options.mediaUrl,
        id: options.mediaId,
        caption: options.caption,
      },
    });
  }

  /**
   * Send a document
   */
  async sendDocument(
    options: SendMediaOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'document',
      document: {
        link: options.mediaUrl,
        id: options.mediaId,
        caption: options.caption,
        filename: options.filename,
      },
    });
  }

  /**
   * Send an audio
   */
  async sendAudio(
    options: Omit<SendMediaOptions, 'caption' | 'filename'>
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'audio',
      audio: {
        link: options.mediaUrl,
        id: options.mediaId,
      },
    });
  }

  /**
   * Send a location
   */
  async sendLocation(
    options: SendLocationOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'location',
      location: {
        longitude: options.longitude,
        latitude: options.latitude,
        name: options.name,
        address: options.address,
      },
    });
  }

  /**
   * Send an interactive message (buttons or list)
   */
  async sendInteractive(
    options: SendInteractiveOptions
  ): Promise<{ messagingProduct: string; contacts: unknown[]; messages: { id: string }[] }> {
    const interactive: WhatsAppInteractive = {
      type: options.type,
      body: { text: options.bodyText },
      action: {} as WhatsAppAction,
    };

    if (options.headerText) {
      interactive.header = { type: 'text', text: options.headerText };
    }

    if (options.footerText) {
      interactive.footer = { text: options.footerText };
    }

    if (options.type === 'button' && options.buttons) {
      interactive.action.buttons = options.buttons.map((btn) => ({
        type: 'reply',
        reply: btn,
      }));
    } else if (options.type === 'list') {
      interactive.action.button = options.listButton ?? 'Menu';
      interactive.action.sections = options.sections ?? [];
    }

    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      to: options.to,
      type: 'interactive',
      interactive,
    });
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.request('POST', '/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Get media URL
   */
  async getMediaUrl(
    mediaId: string
  ): Promise<{ url: string; mimeType: string; sha256: string; fileSize: number }> {
    const response = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      url: string;
      mime_type: string;
      sha256: string;
      file_size: number;
    };
    return {
      url: data.url,
      mimeType: data.mime_type,
      sha256: data.sha256,
      fileSize: data.file_size,
    };
  }

  /**
   * Download media
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    const mediaInfo = await this.getMediaUrl(mediaId);

    const response = await fetch(mediaInfo.url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Upload media
   */
  async uploadMedia(file: Buffer, mimeType: string): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', new Blob([file], { type: mimeType }));

    const response = await fetch(`${this.apiUrl}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    return (await response.json()) as { id: string };
  }
}

export const WhatsAppInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const phoneNumberId = config.auth?.['phone_number_id'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!phoneNumberId || !accessToken) {
      throw new Error('WhatsApp SDK requires auth.phone_number_id and auth.access_token');
    }

    const client = new WhatsAppClient(phoneNumberId, accessToken);
    return {
      client,
      actions: client,
    };
  },
};
