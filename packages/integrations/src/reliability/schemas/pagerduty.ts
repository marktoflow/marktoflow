/**
 * Zod input schemas for PagerDuty API actions.
 */

import { z } from 'zod';

export const pagerdutySchemas: Record<string, z.ZodTypeAny> = {
  listIncidents: z.object({
    statuses: z.array(z.string()).optional(),
    serviceIds: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }).optional().default({}),

  getIncident: z.object({
    incidentId: z.string().min(1, 'incidentId is required'),
  }),

  createIncident: z.object({
    title: z.string().min(1, 'title is required'),
    serviceId: z.string().min(1, 'serviceId is required'),
    escalationPolicyId: z.string().optional(),
    urgency: z.enum(['high', 'low']).optional(),
    body: z.object({
      type: z.literal('incident_body'),
      details: z.string(),
    }).optional(),
    incidentKey: z.string().optional(),
    fromEmail: z.string().email('Valid email is required'),
  }),

  updateIncident: z.object({
    incidentId: z.string().min(1, 'incidentId is required'),
    updates: z.object({
      title: z.string().optional(),
      urgency: z.enum(['high', 'low']).optional(),
      status: z.string().optional(),
    }),
    fromEmail: z.string().email('Valid email is required'),
  }),

  resolveIncident: z.object({
    incidentId: z.string().min(1, 'incidentId is required'),
    fromEmail: z.string().email('Valid email is required'),
  }),

  acknowledgeIncident: z.object({
    incidentId: z.string().min(1, 'incidentId is required'),
    fromEmail: z.string().email('Valid email is required'),
  }),

  listServices: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }).optional().default({}),

  getService: z.object({
    serviceId: z.string().min(1, 'serviceId is required'),
  }),
};
