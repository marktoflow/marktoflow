/**
 * Microsoft Teams Integration
 *
 * Team collaboration and communication via Microsoft Graph API.
 * API Docs: https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview
 * SDK: @microsoft/microsoft-graph-client
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';

export interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
  webUrl: string;
  isArchived: boolean;
  visibility: 'private' | 'public';
  internalId?: string;
}

export interface TeamsChannel {
  id: string;
  displayName: string;
  description?: string;
  webUrl: string;
  membershipType: 'standard' | 'private' | 'shared';
  email?: string;
}

export interface TeamsMessage {
  id: string;
  messageType: 'message' | 'systemEventMessage';
  from: {
    user?: {
      id: string;
      displayName: string;
    };
  };
  body: {
    content: string;
    contentType: 'text' | 'html';
  };
  createdDateTime: string;
  webUrl?: string;
  attachments?: Array<{
    id: string;
    contentType: string;
    name?: string;
  }>;
}

export interface TeamsChatMessage {
  id: string;
  chatId: string;
  from: {
    user?: {
      id: string;
      displayName: string;
    };
  };
  body: {
    content: string;
    contentType: 'text' | 'html';
  };
  createdDateTime: string;
}

export interface TeamsOnlineMeeting {
  id: string;
  joinWebUrl: string;
  subject?: string;
  startDateTime?: string;
  endDateTime?: string;
  audioConferencing?: {
    conferenceId: string;
    tollNumber: string;
    dialinUrl: string;
  };
}

export interface SendMessageOptions {
  teamId: string;
  channelId: string;
  content: string;
  contentType?: 'text' | 'html';
  subject?: string;
}

export interface SendChatMessageOptions {
  chatId: string;
  content: string;
  contentType?: 'text' | 'html';
}

export interface CreateChannelOptions {
  teamId: string;
  displayName: string;
  description?: string;
  membershipType?: 'standard' | 'private';
}

export interface CreateMeetingOptions {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  participants?: {
    attendees?: Array<{
      identity: { user: { id: string } };
      role?: 'presenter' | 'attendee';
    }>;
  };
  lobbyBypassSettings?: {
    scope: 'organization' | 'everyone';
  };
}

export interface ListTeamsOptions {
  filter?: string;
  top?: number;
}

export interface ListChannelsOptions {
  teamId: string;
  filter?: string;
}

export interface ListMessagesOptions {
  teamId: string;
  channelId: string;
  top?: number;
}

/**
 * Microsoft Teams client for workflow integration
 */
export class TeamsClient {
  constructor(private client: Client) {}

  // ==================== Teams ====================

  /**
   * List teams the user is a member of
   */
  async listTeams(options: ListTeamsOptions = {}): Promise<TeamsTeam[]> {
    const { filter, top = 50 } = options;

    let request = this.client.api('/me/joinedTeams').top(top);

    if (filter) {
      request = request.filter(filter);
    }

    const response = await request.get();
    return response.value || [];
  }

  /**
   * Get a team by ID
   */
  async getTeam(teamId: string): Promise<TeamsTeam> {
    return await this.client.api(`/teams/${teamId}`).get();
  }

  // ==================== Channels ====================

  /**
   * List channels in a team
   */
  async listChannels(options: ListChannelsOptions): Promise<TeamsChannel[]> {
    const { teamId, filter } = options;

    let request = this.client.api(`/teams/${teamId}/channels`);

    if (filter) {
      request = request.filter(filter);
    }

    const response = await request.get();
    return response.value || [];
  }

  /**
   * Get a channel by ID
   */
  async getChannel(teamId: string, channelId: string): Promise<TeamsChannel> {
    return await this.client.api(`/teams/${teamId}/channels/${channelId}`).get();
  }

  /**
   * Create a channel in a team
   */
  async createChannel(options: CreateChannelOptions): Promise<TeamsChannel> {
    const { teamId, displayName, description, membershipType = 'standard' } = options;

    const channelData = {
      displayName,
      description,
      membershipType,
    };

    return await this.client.api(`/teams/${teamId}/channels`).post(channelData);
  }

  /**
   * Delete a channel
   */
  async deleteChannel(teamId: string, channelId: string): Promise<void> {
    await this.client.api(`/teams/${teamId}/channels/${channelId}`).delete();
  }

  // ==================== Messages ====================

  /**
   * Send a message to a channel
   */
  async sendMessage(options: SendMessageOptions): Promise<TeamsMessage> {
    const { teamId, channelId, content, contentType = 'html', subject } = options;

    const messageData: {
      body: { contentType: string; content: string };
      subject?: string;
    } = {
      body: {
        contentType,
        content,
      },
    };

    if (subject) {
      messageData.subject = subject;
    }

    return await this.client.api(`/teams/${teamId}/channels/${channelId}/messages`).post(messageData);
  }

  /**
   * List messages in a channel
   */
  async listMessages(options: ListMessagesOptions): Promise<TeamsMessage[]> {
    const { teamId, channelId, top = 50 } = options;

    const response = await this.client.api(`/teams/${teamId}/channels/${channelId}/messages`).top(top).get();

    return response.value || [];
  }

  /**
   * Get a specific message
   */
  async getMessage(teamId: string, channelId: string, messageId: string): Promise<TeamsMessage> {
    return await this.client.api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}`).get();
  }

  /**
   * Reply to a message
   */
  async replyToMessage(
    teamId: string,
    channelId: string,
    messageId: string,
    content: string,
    contentType: 'text' | 'html' = 'html'
  ): Promise<TeamsMessage> {
    const replyData = {
      body: {
        contentType,
        content,
      },
    };

    return await this.client.api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`).post(replyData);
  }

  // ==================== Chats ====================

  /**
   * List chats for the user
   */
  async listChats(options: { top?: number } = {}): Promise<Array<{ id: string; topic?: string; chatType: string }>> {
    const { top = 50 } = options;

    const response = await this.client.api('/me/chats').top(top).get();

    return response.value || [];
  }

  /**
   * Send a message in a chat
   */
  async sendChatMessage(options: SendChatMessageOptions): Promise<TeamsChatMessage> {
    const { chatId, content, contentType = 'html' } = options;

    const messageData = {
      body: {
        contentType,
        content,
      },
    };

    return await this.client.api(`/chats/${chatId}/messages`).post(messageData);
  }

  /**
   * List messages in a chat
   */
  async listChatMessages(chatId: string, options: { top?: number } = {}): Promise<TeamsChatMessage[]> {
    const { top = 50 } = options;

    const response = await this.client.api(`/chats/${chatId}/messages`).top(top).get();

    return response.value || [];
  }

  // ==================== Online Meetings ====================

  /**
   * Create an online meeting
   */
  async createMeeting(options: CreateMeetingOptions): Promise<TeamsOnlineMeeting> {
    const meetingData = {
      subject: options.subject,
      startDateTime: options.startDateTime,
      endDateTime: options.endDateTime,
      participants: options.participants,
      lobbyBypassSettings: options.lobbyBypassSettings || {
        scope: 'organization',
      },
    };

    return await this.client.api('/me/onlineMeetings').post(meetingData);
  }

  /**
   * Get an online meeting
   */
  async getMeeting(meetingId: string): Promise<TeamsOnlineMeeting> {
    return await this.client.api(`/me/onlineMeetings/${meetingId}`).get();
  }

  /**
   * Delete an online meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    await this.client.api(`/me/onlineMeetings/${meetingId}`).delete();
  }

  // ==================== Members ====================

  /**
   * List members of a team
   */
  async listTeamMembers(teamId: string): Promise<
    Array<{
      id: string;
      displayName: string;
      email?: string;
      roles: string[];
    }>
  > {
    const response = await this.client.api(`/teams/${teamId}/members`).get();

    return response.value || [];
  }

  /**
   * Add a member to a team
   */
  async addTeamMember(
    teamId: string,
    userId: string,
    roles: string[] = ['member']
  ): Promise<{
    id: string;
    roles: string[];
  }> {
    const memberData = {
      '@odata.type': '#microsoft.graph.aadUserConversationMember',
      'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${userId}')`,
      roles,
    };

    return await this.client.api(`/teams/${teamId}/members`).post(memberData);
  }

  /**
   * Remove a member from a team
   */
  async removeTeamMember(teamId: string, membershipId: string): Promise<void> {
    await this.client.api(`/teams/${teamId}/members/${membershipId}`).delete();
  }
}

/**
 * Load saved Teams tokens from credential storage
 */
async function loadTeamsTokens(): Promise<{ access_token?: string; refresh_token?: string } | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { createCredentialManager } = await import('@marktoflow/core');
    const { homedir } = await import('node:os');
    const { join } = await import('node:path');

    const stateDir = join(homedir(), '.marktoflow', 'state');
    const credentialManager = createCredentialManager({ stateDir });

    const credentialName = 'oauth:teams';
    if (!credentialManager.exists(credentialName)) {
      return null;
    }

    const decrypted = credentialManager.get(credentialName);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

export const TeamsInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const tenantId = config.auth?.['tenant_id'] as string | undefined;
    let accessToken = config.auth?.['access_token'] as string | undefined;

    // Try to load saved tokens if no access token provided
    if (!accessToken) {
      const savedTokens = await loadTeamsTokens();
      if (savedTokens?.access_token) {
        accessToken = savedTokens.access_token;
      }
    }

    if (!accessToken && (!clientId || !clientSecret || !tenantId)) {
      throw new Error(
        'Microsoft Teams SDK requires auth.access_token (or run "marktoflow connect teams" first), ' +
        'or provide auth.client_id, auth.client_secret, and auth.tenant_id for client credentials flow'
      );
    }

    // Initialize Microsoft Graph Client
    const client = Client.init({
      authProvider: (done) => {
        if (accessToken) {
          done(null, accessToken);
        } else {
          // Client credentials flow would require @azure/identity
          done(
            new Error(
              'No access token available. Run "marktoflow connect teams" to authenticate, ' +
              'or provide auth.access_token in your workflow.'
            ),
            null
          );
        }
      },
    });

    const teamsClient = new TeamsClient(client);
    const wrapped = wrapIntegration('teams', teamsClient, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
