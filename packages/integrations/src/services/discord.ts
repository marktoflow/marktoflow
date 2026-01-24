/**
 * Discord Integration
 *
 * Community communication platform.
 * API Docs: https://discord.com/developers/docs
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

const DISCORD_API_URL = 'https://discord.com/api/v10';

export interface DiscordMessage {
  id: string;
  channelId: string;
  guildId?: string;
  author: { id: string; username: string; discriminator: string; avatar?: string; bot?: boolean };
  content: string;
  timestamp: string;
  editedTimestamp?: string;
  mentionEveryone: boolean;
  mentions: { id: string; username: string }[];
  attachments: { id: string; filename: string; url: string; size: number }[];
  embeds: DiscordEmbed[];
  reactions?: { emoji: { name: string }; count: number }[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface DiscordChannel {
  id: string;
  type: number;
  guildId?: string;
  name?: string;
  topic?: string;
  position?: number;
  parentId?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  ownerId: string;
  memberCount?: number;
}

export interface SendMessageOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  tts?: boolean;
  allowedMentions?: {
    parse?: ('roles' | 'users' | 'everyone')[];
    roles?: string[];
    users?: string[];
  };
  messageReference?: { message_id: string; channel_id?: string; guild_id?: string };
  components?: unknown[]; // Action rows with buttons/selects
}

export interface CreateThreadOptions {
  name: string;
  autoArchiveDuration?: 60 | 1440 | 4320 | 10080;
  type?: 11 | 12; // 11 = public, 12 = private
  invitable?: boolean;
  rateLimitPerUser?: number;
}

export interface GetMessagesOptions {
  around?: string;
  before?: string;
  after?: string;
  limit?: number;
}

/**
 * Discord API client for workflow integration
 */
export class DiscordClient {
  constructor(private token: string, private isBot: boolean = true) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${DISCORD_API_URL}${path}`, {
      method,
      headers: {
        Authorization: this.isBot ? `Bot ${this.token}` : this.token,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} ${error}`);
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private parseMessage(msg: Record<string, unknown>): DiscordMessage {
    const author = msg.author as Record<string, unknown>;
    return {
      id: msg.id as string,
      channelId: msg.channel_id as string,
      guildId: msg.guild_id as string | undefined,
      author: {
        id: author.id as string,
        username: author.username as string,
        discriminator: author.discriminator as string,
        avatar: author.avatar as string | undefined,
        bot: author.bot as boolean | undefined,
      },
      content: msg.content as string,
      timestamp: msg.timestamp as string,
      editedTimestamp: msg.edited_timestamp as string | undefined,
      mentionEveryone: msg.mention_everyone as boolean,
      mentions: (msg.mentions as Array<{ id: string; username: string }>) ?? [],
      attachments: (msg.attachments as DiscordMessage['attachments']) ?? [],
      embeds: (msg.embeds as DiscordEmbed[]) ?? [],
      reactions: msg.reactions as DiscordMessage['reactions'],
    };
  }

  /**
   * Get current user
   */
  async getMe(): Promise<{ id: string; username: string; discriminator: string }> {
    return this.request('GET', '/users/@me');
  }

  /**
   * Get guilds (servers) the bot is in
   */
  async getGuilds(): Promise<DiscordGuild[]> {
    const guilds = await this.request<Array<Record<string, unknown>>>('GET', '/users/@me/guilds');
    return guilds.map((g) => ({
      id: g.id as string,
      name: g.name as string,
      icon: g.icon as string | undefined,
      description: g.description as string | undefined,
      ownerId: g.owner_id as string,
      memberCount: g.approximate_member_count as number | undefined,
    }));
  }

  /**
   * Get a guild by ID
   */
  async getGuild(guildId: string): Promise<DiscordGuild> {
    const g = await this.request<Record<string, unknown>>('GET', `/guilds/${guildId}`);
    return {
      id: g.id as string,
      name: g.name as string,
      icon: g.icon as string | undefined,
      description: g.description as string | undefined,
      ownerId: g.owner_id as string,
      memberCount: g.approximate_member_count as number | undefined,
    };
  }

  /**
   * Get channels in a guild
   */
  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    const channels = await this.request<Array<Record<string, unknown>>>('GET', `/guilds/${guildId}/channels`);
    return channels.map((c) => ({
      id: c.id as string,
      type: c.type as number,
      guildId: c.guild_id as string | undefined,
      name: c.name as string | undefined,
      topic: c.topic as string | undefined,
      position: c.position as number | undefined,
      parentId: c.parent_id as string | undefined,
    }));
  }

  /**
   * Get a channel by ID
   */
  async getChannel(channelId: string): Promise<DiscordChannel> {
    const c = await this.request<Record<string, unknown>>('GET', `/channels/${channelId}`);
    return {
      id: c.id as string,
      type: c.type as number,
      guildId: c.guild_id as string | undefined,
      name: c.name as string | undefined,
      topic: c.topic as string | undefined,
      position: c.position as number | undefined,
      parentId: c.parent_id as string | undefined,
    };
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, options: SendMessageOptions | string): Promise<DiscordMessage> {
    const body = typeof options === 'string' ? { content: options } : options;
    const msg = await this.request<Record<string, unknown>>('POST', `/channels/${channelId}/messages`, body);
    return this.parseMessage(msg);
  }

  /**
   * Edit a message
   */
  async editMessage(channelId: string, messageId: string, options: SendMessageOptions | string): Promise<DiscordMessage> {
    const body = typeof options === 'string' ? { content: options } : options;
    const msg = await this.request<Record<string, unknown>>('PATCH', `/channels/${channelId}/messages/${messageId}`, body);
    return this.parseMessage(msg);
  }

  /**
   * Delete a message
   */
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.request('DELETE', `/channels/${channelId}/messages/${messageId}`);
  }

  /**
   * Get messages from a channel
   */
  async getMessages(channelId: string, options: GetMessagesOptions = {}): Promise<DiscordMessage[]> {
    const params: string[] = [];
    if (options.around) params.push(`around=${options.around}`);
    if (options.before) params.push(`before=${options.before}`);
    if (options.after) params.push(`after=${options.after}`);
    if (options.limit) params.push(`limit=${options.limit}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const messages = await this.request<Array<Record<string, unknown>>>('GET', `/channels/${channelId}/messages${query}`);
    return messages.map((m) => this.parseMessage(m));
  }

  /**
   * Get a specific message
   */
  async getMessage(channelId: string, messageId: string): Promise<DiscordMessage> {
    const msg = await this.request<Record<string, unknown>>('GET', `/channels/${channelId}/messages/${messageId}`);
    return this.parseMessage(msg);
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    const encodedEmoji = encodeURIComponent(emoji);
    await this.request('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
  }

  /**
   * Remove own reaction from a message
   */
  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    const encodedEmoji = encodeURIComponent(emoji);
    await this.request('DELETE', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`);
  }

  /**
   * Create a thread from a message
   */
  async createThreadFromMessage(channelId: string, messageId: string, options: CreateThreadOptions): Promise<DiscordChannel> {
    const c = await this.request<Record<string, unknown>>(
      'POST',
      `/channels/${channelId}/messages/${messageId}/threads`,
      {
        name: options.name,
        auto_archive_duration: options.autoArchiveDuration,
        rate_limit_per_user: options.rateLimitPerUser,
      }
    );
    return {
      id: c.id as string,
      type: c.type as number,
      guildId: c.guild_id as string | undefined,
      name: c.name as string | undefined,
      topic: c.topic as string | undefined,
      position: c.position as number | undefined,
      parentId: c.parent_id as string | undefined,
    };
  }

  /**
   * Create a thread in a channel (without a message)
   */
  async createThread(channelId: string, options: CreateThreadOptions): Promise<DiscordChannel> {
    const c = await this.request<Record<string, unknown>>('POST', `/channels/${channelId}/threads`, {
      name: options.name,
      auto_archive_duration: options.autoArchiveDuration,
      type: options.type ?? 11,
      invitable: options.invitable,
      rate_limit_per_user: options.rateLimitPerUser,
    });
    return {
      id: c.id as string,
      type: c.type as number,
      guildId: c.guild_id as string | undefined,
      name: c.name as string | undefined,
      topic: c.topic as string | undefined,
      position: c.position as number | undefined,
      parentId: c.parent_id as string | undefined,
    };
  }

  /**
   * Pin a message
   */
  async pinMessage(channelId: string, messageId: string): Promise<void> {
    await this.request('PUT', `/channels/${channelId}/pins/${messageId}`);
  }

  /**
   * Unpin a message
   */
  async unpinMessage(channelId: string, messageId: string): Promise<void> {
    await this.request('DELETE', `/channels/${channelId}/pins/${messageId}`);
  }

  /**
   * Get pinned messages
   */
  async getPinnedMessages(channelId: string): Promise<DiscordMessage[]> {
    const messages = await this.request<Array<Record<string, unknown>>>('GET', `/channels/${channelId}/pins`);
    return messages.map((m) => this.parseMessage(m));
  }

  /**
   * Create a webhook
   */
  async createWebhook(channelId: string, name: string, avatar?: string): Promise<{ id: string; token: string; url: string }> {
    const webhook = await this.request<Record<string, unknown>>('POST', `/channels/${channelId}/webhooks`, {
      name,
      avatar,
    });
    return {
      id: webhook.id as string,
      token: webhook.token as string,
      url: `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`,
    };
  }

  /**
   * Execute a webhook
   */
  async executeWebhook(
    webhookId: string,
    webhookToken: string,
    options: SendMessageOptions & { username?: string; avatar_url?: string }
  ): Promise<DiscordMessage | undefined> {
    const msg = await this.request<Record<string, unknown> | undefined>(
      'POST',
      `/webhooks/${webhookId}/${webhookToken}?wait=true`,
      options
    );
    return msg ? this.parseMessage(msg) : undefined;
  }
}

export const DiscordInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    const isBot = (config.auth?.['is_bot'] as boolean | undefined) ?? true;

    if (!token) {
      throw new Error('Discord SDK requires auth.token (bot token)');
    }

    const client = new DiscordClient(token, isBot);
    return {
      client,
      actions: client,
    };
  },
};
