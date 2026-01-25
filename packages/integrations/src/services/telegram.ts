/**
 * Telegram Integration
 *
 * Messaging platform with bot API.
 * API Docs: https://core.telegram.org/bots/api
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

const TELEGRAM_API_URL = 'https://api.telegram.org';

export interface TelegramUser {
  id: number;
  isBot: boolean;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface TelegramMessage {
  messageId: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  video?: TelegramVideo;
  audio?: TelegramAudio;
  voice?: TelegramVoice;
  caption?: string;
  replyToMessage?: TelegramMessage;
}

export interface TelegramPhotoSize {
  fileId: string;
  fileUniqueId: string;
  width: number;
  height: number;
  fileSize?: number;
}

export interface TelegramDocument {
  fileId: string;
  fileUniqueId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface TelegramVideo {
  fileId: string;
  fileUniqueId: string;
  width: number;
  height: number;
  duration: number;
  fileSize?: number;
}

export interface TelegramAudio {
  fileId: string;
  fileUniqueId: string;
  duration: number;
  performer?: string;
  title?: string;
  fileSize?: number;
}

export interface TelegramVoice {
  fileId: string;
  fileUniqueId: string;
  duration: number;
  fileSize?: number;
}

export interface SendMessageOptions {
  chatId: number | string;
  text: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableWebPagePreview?: boolean;
  disableNotification?: boolean;
  replyToMessageId?: number;
  replyMarkup?: TelegramReplyMarkup;
}

export interface TelegramReplyMarkup {
  inlineKeyboard?: InlineKeyboardButton[][];
  keyboard?: KeyboardButton[][];
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  removeKeyboard?: boolean;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callbackData?: string;
}

export interface KeyboardButton {
  text: string;
  requestContact?: boolean;
  requestLocation?: boolean;
}

export interface SendPhotoOptions {
  chatId: number | string;
  photo: string;
  caption?: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableNotification?: boolean;
  replyToMessageId?: number;
}

export interface SendDocumentOptions {
  chatId: number | string;
  document: string;
  caption?: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disableNotification?: boolean;
  replyToMessageId?: number;
}

export interface GetUpdatesOptions {
  offset?: number;
  limit?: number;
  timeout?: number;
  allowedUpdates?: string[];
}

export interface TelegramUpdate {
  updateId: number;
  message?: TelegramMessage;
  editedMessage?: TelegramMessage;
  callbackQuery?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

/**
 * Telegram Bot API client for workflow integration
 */
export class TelegramClient {
  private apiUrl: string;

  constructor(token: string) {
    this.apiUrl = `${TELEGRAM_API_URL}/bot${token}`;
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params ? JSON.stringify(params) : undefined,
    });

    const data = (await response.json()) as { ok: boolean; result: T; description?: string };

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description ?? 'Unknown error'}`);
    }

    return data.result;
  }

  /**
   * Get bot information
   */
  async getMe(): Promise<TelegramUser> {
    return this.request<TelegramUser>('getMe');
  }

  /**
   * Send a text message
   */
  async sendMessage(options: SendMessageOptions): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendMessage', {
      chat_id: options.chatId,
      text: options.text,
      parse_mode: options.parseMode,
      disable_web_page_preview: options.disableWebPagePreview,
      disable_notification: options.disableNotification,
      reply_to_message_id: options.replyToMessageId,
      reply_markup: options.replyMarkup
        ? {
            inline_keyboard: options.replyMarkup.inlineKeyboard?.map((row) =>
              row.map((btn) => ({
                text: btn.text,
                url: btn.url,
                callback_data: btn.callbackData,
              }))
            ),
            keyboard: options.replyMarkup.keyboard,
            resize_keyboard: options.replyMarkup.resizeKeyboard,
            one_time_keyboard: options.replyMarkup.oneTimeKeyboard,
            remove_keyboard: options.replyMarkup.removeKeyboard,
          }
        : undefined,
    });
  }

  /**
   * Send a photo
   */
  async sendPhoto(options: SendPhotoOptions): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendPhoto', {
      chat_id: options.chatId,
      photo: options.photo,
      caption: options.caption,
      parse_mode: options.parseMode,
      disable_notification: options.disableNotification,
      reply_to_message_id: options.replyToMessageId,
    });
  }

  /**
   * Send a document
   */
  async sendDocument(options: SendDocumentOptions): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendDocument', {
      chat_id: options.chatId,
      document: options.document,
      caption: options.caption,
      parse_mode: options.parseMode,
      disable_notification: options.disableNotification,
      reply_to_message_id: options.replyToMessageId,
    });
  }

  /**
   * Edit a message text
   */
  async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: { parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'; replyMarkup?: TelegramReplyMarkup }
  ): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parseMode,
      reply_markup: options?.replyMarkup,
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    return this.request<boolean>('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  /**
   * Forward a message
   */
  async forwardMessage(
    chatId: number | string,
    fromChatId: number | string,
    messageId: number,
    disableNotification?: boolean
  ): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('forwardMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      disable_notification: disableNotification,
    });
  }

  /**
   * Get updates (for polling)
   */
  async getUpdates(options: GetUpdatesOptions = {}): Promise<TelegramUpdate[]> {
    return this.request<TelegramUpdate[]>('getUpdates', {
      offset: options.offset,
      limit: options.limit ?? 100,
      timeout: options.timeout ?? 0,
      allowed_updates: options.allowedUpdates,
    });
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(
    url: string,
    options?: { maxConnections?: number; allowedUpdates?: string[] }
  ): Promise<boolean> {
    return this.request<boolean>('setWebhook', {
      url,
      max_connections: options?.maxConnections,
      allowed_updates: options?.allowedUpdates,
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<boolean> {
    return this.request<boolean>('deleteWebhook');
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(): Promise<{
    url: string;
    hasCustomCertificate: boolean;
    pendingUpdateCount: number;
    lastErrorDate?: number;
    lastErrorMessage?: string;
    maxConnections?: number;
    allowedUpdates?: string[];
  }> {
    return this.request('getWebhookInfo');
  }

  /**
   * Send chat action (typing, upload_photo, etc.)
   */
  async sendChatAction(
    chatId: number | string,
    action:
      | 'typing'
      | 'upload_photo'
      | 'upload_video'
      | 'upload_document'
      | 'find_location'
      | 'record_video'
      | 'record_voice'
  ): Promise<boolean> {
    return this.request<boolean>('sendChatAction', {
      chat_id: chatId,
      action,
    });
  }

  /**
   * Get chat information
   */
  async getChat(chatId: number | string): Promise<TelegramChat> {
    return this.request<TelegramChat>('getChat', {
      chat_id: chatId,
    });
  }

  /**
   * Get chat member
   */
  async getChatMember(
    chatId: number | string,
    userId: number
  ): Promise<{ user: TelegramUser; status: string }> {
    return this.request('getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });
  }

  /**
   * Get chat administrators
   */
  async getChatAdministrators(
    chatId: number | string
  ): Promise<{ user: TelegramUser; status: string }[]> {
    return this.request('getChatAdministrators', {
      chat_id: chatId,
    });
  }

  /**
   * Get chat members count
   */
  async getChatMembersCount(chatId: number | string): Promise<number> {
    return this.request<number>('getChatMembersCount', {
      chat_id: chatId,
    });
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    options?: { text?: string; showAlert?: boolean; url?: string }
  ): Promise<boolean> {
    return this.request<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: options?.text,
      show_alert: options?.showAlert,
      url: options?.url,
    });
  }

  /**
   * Pin a message
   */
  async pinChatMessage(
    chatId: number | string,
    messageId: number,
    disableNotification?: boolean
  ): Promise<boolean> {
    return this.request<boolean>('pinChatMessage', {
      chat_id: chatId,
      message_id: messageId,
      disable_notification: disableNotification,
    });
  }

  /**
   * Unpin a message
   */
  async unpinChatMessage(chatId: number | string, messageId?: number): Promise<boolean> {
    return this.request<boolean>('unpinChatMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  /**
   * Leave a chat
   */
  async leaveChat(chatId: number | string): Promise<boolean> {
    return this.request<boolean>('leaveChat', {
      chat_id: chatId,
    });
  }
}

export const TelegramInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;

    if (!token) {
      throw new Error('Telegram SDK requires auth.token (bot token)');
    }

    const client = new TelegramClient(token);
    return {
      client,
      actions: client,
    };
  },
};
