/**
 * Zod input schemas for HubSpot API actions.
 */

import { z } from 'zod';

export const hubspotSchemas: Record<string, z.ZodTypeAny> = {
  createContact: z.object({
    email: z.string().email('Valid email is required'),
    firstname: z.string().optional(),
    lastname: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
  }).passthrough(),

  getContact: z.object({
    contactId: z.string().min(1, 'contactId is required'),
    properties: z.array(z.string()).optional(),
  }),

  listContacts: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
  }).optional().default({}),

  updateContact: z.object({
    contactId: z.string().min(1, 'contactId is required'),
    properties: z.record(z.unknown()),
  }),

  deleteContact: z.object({
    contactId: z.string().min(1, 'contactId is required'),
  }),

  searchContacts: z.object({
    filterGroups: z.array(z.object({
      filters: z.array(z.object({
        propertyName: z.string(),
        operator: z.string(),
        value: z.string(),
      })),
    })),
    sorts: z.array(z.object({
      propertyName: z.string(),
      direction: z.enum(['ASCENDING', 'DESCENDING']),
    })).optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
  }),

  createDeal: z.object({
    dealname: z.string().min(1, 'dealname is required'),
    pipeline: z.string().min(1, 'pipeline is required'),
    dealstage: z.string().min(1, 'dealstage is required'),
    amount: z.number().optional(),
    closedate: z.string().optional(),
  }).passthrough(),

  getDeal: z.object({
    dealId: z.string().min(1, 'dealId is required'),
    properties: z.array(z.string()).optional(),
  }),

  listDeals: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
  }).optional().default({}),

  updateDeal: z.object({
    dealId: z.string().min(1, 'dealId is required'),
    properties: z.record(z.unknown()),
  }),

  createCompany: z.object({
    name: z.string().min(1, 'name is required'),
  }).passthrough(),

  getCompany: z.object({
    companyId: z.string().min(1, 'companyId is required'),
    properties: z.array(z.string()).optional(),
  }),

  listCompanies: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
  }).optional().default({}),

  createTicket: z.object({
    subject: z.string().min(1, 'subject is required'),
    hs_pipeline: z.string().min(1, 'hs_pipeline is required'),
    hs_pipeline_stage: z.string().min(1, 'hs_pipeline_stage is required'),
  }).passthrough(),

  getTicket: z.object({
    ticketId: z.string().min(1, 'ticketId is required'),
    properties: z.array(z.string()).optional(),
  }),

  listTickets: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    properties: z.array(z.string()).optional(),
  }).optional().default({}),
};
