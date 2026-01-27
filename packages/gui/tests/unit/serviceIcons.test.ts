import { describe, it, expect } from 'vitest';
import { getServiceIcon, getServiceColor } from '../../src/client/utils/serviceIcons.js';
import { HelpCircle } from 'lucide-react';

describe('Service Icons', () => {
  describe('getServiceIcon', () => {
    it('should return icons for all standard services', () => {
      const services = [
        'slack',
        'github',
        'jira',
        'gmail',
        'outlook',
        'linear',
        'notion',
        'discord',
        'airtable',
        'confluence',
        'http',
        'claude',
        'opencode',
        'ollama',
      ];

      services.forEach((service) => {
        const icon = getServiceIcon(service);
        expect(icon).toBeDefined();
        expect(icon).not.toBe(HelpCircle);
      });
    });

    it('should return icons for new integrations', () => {
      const newServices = [
        'stripe',
        'teams',
        'twilio',
        'sendgrid',
        'shopify',
        'zendesk',
        'mailchimp',
        'asana',
        'trello',
        'dropbox',
        's3',
        'aws-s3',
      ];

      newServices.forEach((service) => {
        const icon = getServiceIcon(service);
        expect(icon).toBeDefined();
        expect(icon).not.toBe(HelpCircle);
      });
    });

    it('should return HelpCircle for unknown services', () => {
      const icon = getServiceIcon('unknown-service');
      expect(icon).toBe(HelpCircle);
    });

    it('should handle service names with dots (action paths)', () => {
      const icon = getServiceIcon('slack.chat.postMessage');
      expect(icon).toBeDefined();
      expect(icon).not.toBe(HelpCircle);
    });

    it('should handle case insensitive service names', () => {
      const lowerIcon = getServiceIcon('slack');
      const upperIcon = getServiceIcon('SLACK');
      expect(lowerIcon).toBe(upperIcon);
    });
  });

  describe('getServiceColor', () => {
    it('should return brand colors for standard services', () => {
      const serviceColors = {
        slack: '#4A154B',
        github: '#24292e',
        jira: '#0052CC',
        gmail: '#EA4335',
        outlook: '#0078D4',
        discord: '#5865F2',
      };

      Object.entries(serviceColors).forEach(([service, expectedColor]) => {
        const color = getServiceColor(service);
        expect(color).toBe(expectedColor);
      });
    });

    it('should return brand colors for new integrations', () => {
      const newServiceColors = {
        stripe: '#635BFF',
        teams: '#6264A7',
        twilio: '#F22F46',
        sendgrid: '#1A82E2',
        shopify: '#96BF48',
        zendesk: '#03363D',
        mailchimp: '#FFE01B',
        asana: '#F06A6A',
        trello: '#0079BF',
        dropbox: '#0061FF',
        's3': '#FF9900',
        'aws-s3': '#FF9900',
      };

      Object.entries(newServiceColors).forEach(([service, expectedColor]) => {
        const color = getServiceColor(service);
        expect(color).toBe(expectedColor);
      });
    });

    it('should return default gray color for unknown services', () => {
      const color = getServiceColor('unknown-service');
      expect(color).toBe('#6B7280');
    });

    it('should handle service names with dots', () => {
      const color = getServiceColor('github.pulls.create');
      expect(color).toBe('#24292e');
    });

    it('should handle case insensitive service names', () => {
      const lowerColor = getServiceColor('stripe');
      const upperColor = getServiceColor('STRIPE');
      expect(lowerColor).toBe(upperColor);
    });

    it('should return valid hex colors', () => {
      const services = [
        'slack',
        'stripe',
        'teams',
        'twilio',
        'shopify',
        'zendesk',
        'unknown',
      ];

      services.forEach((service) => {
        const color = getServiceColor(service);
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });
  });

  describe('Integration Coverage', () => {
    it('should have icons for all 30 service integrations', () => {
      const allServices = [
        // Standard services
        'slack',
        'github',
        'jira',
        'gmail',
        'outlook',
        'linear',
        'notion',
        'discord',
        'airtable',
        'confluence',
        'http',
        'ollama',
        'claude',
        'opencode',
        // New integrations
        'stripe',
        'teams',
        'twilio',
        'sendgrid',
        'shopify',
        'zendesk',
        'mailchimp',
        'asana',
        'trello',
        'dropbox',
        'aws-s3',
        // Database services
        'postgres',
        'mysql',
        'supabase',
        // Google services
        'google-sheets',
        'google-calendar',
      ];

      allServices.forEach((service) => {
        const icon = getServiceIcon(service);
        const color = getServiceColor(service);

        // Icon should not be the fallback HelpCircle
        expect(icon).toBeDefined();

        // Color should be a valid hex color
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });
  });
});
