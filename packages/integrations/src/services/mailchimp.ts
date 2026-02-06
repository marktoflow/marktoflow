/**
 * Mailchimp Integration
 *
 * Email marketing automation platform.
 * API Docs: https://mailchimp.com/developer/marketing/api/
 * SDK: https://github.com/mailchimp/mailchimp-marketing-node
 */

// @ts-expect-error - mailchimp doesn't have types
import mailchimp from '@mailchimp/mailchimp_marketing';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';

export interface MailchimpMember {
  email_address: string;
  status: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
  merge_fields?: Record<string, string>;
  interests?: Record<string, boolean>;
  tags?: string[];
  vip?: boolean;
}

export interface MailchimpCampaign {
  id?: string;
  type: 'regular' | 'plaintext' | 'absplit' | 'rss' | 'variate';
  recipients: {
    list_id: string;
    segment_opts?: {
      saved_segment_id?: number;
      match?: 'any' | 'all';
      conditions?: Array<Record<string, unknown>>;
    };
  };
  settings: {
    subject_line: string;
    title?: string;
    from_name: string;
    reply_to: string;
    preview_text?: string;
  };
}

export interface SendCampaignOptions {
  campaign_id: string;
  schedule_time?: string;
}

/**
 * Mailchimp client wrapper for workflow integration
 */
export class MailchimpClient {
  constructor(private apiKey: string, private server: string) {
    mailchimp.setConfig({
      apiKey: this.apiKey,
      server: this.server,
    });
  }

  // ==================== Lists ====================

  /**
   * Get all lists
   */
  async getLists(options?: { count?: number; offset?: number }) {
    return await mailchimp.lists.getAllLists(options);
  }

  /**
   * Get list by ID
   */
  async getList(listId: string) {
    return await mailchimp.lists.getList(listId);
  }

  /**
   * Create list
   */
  async createList(options: {
    name: string;
    contact: {
      company: string;
      address1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    permission_reminder: string;
    campaign_defaults: {
      from_name: string;
      from_email: string;
      subject: string;
      language: string;
    };
    email_type_option: boolean;
  }) {
    return await mailchimp.lists.createList(options);
  }

  // ==================== Members ====================

  /**
   * Get list members
   */
  async getListMembers(listId: string, options?: { count?: number; offset?: number; status?: string }) {
    return await mailchimp.lists.getListMembersInfo(listId, options);
  }

  /**
   * Get member
   */
  async getMember(listId: string, subscriberHash: string) {
    return await mailchimp.lists.getListMember(listId, subscriberHash);
  }

  /**
   * Add member to list
   */
  async addMember(listId: string, member: MailchimpMember) {
    return await mailchimp.lists.addListMember(listId, member);
  }

  /**
   * Update member
   */
  async updateMember(listId: string, subscriberHash: string, member: Partial<MailchimpMember>) {
    return await mailchimp.lists.updateListMember(listId, subscriberHash, member);
  }

  /**
   * Delete member
   */
  async deleteMember(listId: string, subscriberHash: string) {
    return await mailchimp.lists.deleteListMember(listId, subscriberHash);
  }

  /**
   * Add or update member
   */
  async setMember(listId: string, subscriberHash: string, member: MailchimpMember) {
    return await mailchimp.lists.setListMember(listId, subscriberHash, member);
  }

  // ==================== Campaigns ====================

  /**
   * Get all campaigns
   */
  async getCampaigns(options?: { count?: number; offset?: number; status?: string }) {
    return await mailchimp.campaigns.list(options);
  }

  /**
   * Get campaign
   */
  async getCampaign(campaignId: string) {
    return await mailchimp.campaigns.get(campaignId);
  }

  /**
   * Create campaign
   */
  async createCampaign(campaign: MailchimpCampaign) {
    return await mailchimp.campaigns.create(campaign);
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, campaign: Partial<MailchimpCampaign>) {
    return await mailchimp.campaigns.update(campaignId, campaign);
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string) {
    return await mailchimp.campaigns.remove(campaignId);
  }

  /**
   * Send campaign
   */
  async sendCampaign(campaignId: string) {
    return await mailchimp.campaigns.send(campaignId);
  }

  /**
   * Schedule campaign
   */
  async scheduleCampaign(campaignId: string, scheduleTime: string) {
    return await mailchimp.campaigns.schedule(campaignId, { schedule_time: scheduleTime });
  }

  // ==================== Automations ====================

  /**
   * Get all automations
   */
  async getAutomations(options?: { count?: number; offset?: number }) {
    return await mailchimp.automations.list(options);
  }

  /**
   * Get automation
   */
  async getAutomation(workflowId: string) {
    return await mailchimp.automations.get(workflowId);
  }

  /**
   * Pause automation
   */
  async pauseAutomation(workflowId: string) {
    return await mailchimp.automations.pauseAllEmails(workflowId);
  }

  /**
   * Start automation
   */
  async startAutomation(workflowId: string) {
    return await mailchimp.automations.startAllEmails(workflowId);
  }

  // ==================== Tags ====================

  /**
   * Add tags to member
   */
  async addMemberTags(listId: string, subscriberHash: string, tags: string[]) {
    return await mailchimp.lists.updateListMemberTags(listId, subscriberHash, {
      tags: tags.map((name) => ({ name, status: 'active' as const })),
    });
  }

  /**
   * Remove tags from member
   */
  async removeMemberTags(listId: string, subscriberHash: string, tags: string[]) {
    return await mailchimp.lists.updateListMemberTags(listId, subscriberHash, {
      tags: tags.map((name) => ({ name, status: 'inactive' as const })),
    });
  }
}

export const MailchimpInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const apiKey = config.auth?.['api_key'] as string | undefined;
    const server = config.auth?.['server'] as string | undefined;

    if (!apiKey || !server) {
      throw new Error('Mailchimp SDK requires auth.api_key and auth.server');
    }

    const client = new MailchimpClient(apiKey, server);
    const wrapped = wrapIntegration('mailchimp', client, {
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
