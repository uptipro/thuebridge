import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import { prisma } from './db.js';
import { requireApiKey } from './apiKeyAuth.js';
import './types.js';
import crypto from 'node:crypto';

dotenv.config();

const corsOriginsRaw = process.env.CORS_ORIGINS ?? '*';
const corsOrigins = corsOriginsRaw
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

export const app = express();

app.use(express.json({ limit: '1mb' }));

app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  }),
);

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

const createAppSchema = z.object({
  name: z.string().min(2).max(80),
});

app.post('/api/v1/apps', async (req: Request, res: Response) => {
  const parsed = createAppSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const apiKey = crypto.randomBytes(24).toString('base64url');

  const application = await prisma.application.create({
    data: {
      name: parsed.data.name,
      apiKey,
    },
    select: { id: true, name: true, apiKey: true, createdAt: true },
  });

  return res.status(201).json({ application });
});

app.get('/api/v1/apps', async (req: Request, res: Response) => {
  const includeApiKeyRaw = typeof req.query.includeApiKey === 'string' ? req.query.includeApiKey : undefined;
  const includeApiKey = includeApiKeyRaw === 'true' || includeApiKeyRaw === '1';

  const applications = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
    select: includeApiKey
      ? { id: true, name: true, apiKey: true, createdAt: true }
      : { id: true, name: true, createdAt: true },
  });
  return res.json({ applications });
});

app.get('/api/v1/apps/:id', async (req: Request, res: Response) => {
  const rawId = (req.params as unknown as { id?: string | string[] }).id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  if (!id) {
    return res.status(400).json({ error: 'Missing application id' });
  }

  const application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, name: true, apiKey: true, createdAt: true },
  });

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  return res.json({ application });
});

const updateAppSchema = z.object({
  name: z.string().min(2).max(80),
});

app.patch('/api/v1/apps/:id', async (req: Request, res: Response) => {
  const rawId = (req.params as unknown as { id?: string | string[] }).id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  if (!id) {
    return res.status(400).json({ error: 'Missing application id' });
  }

  const parsed = updateAppSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  try {
    const application = await prisma.application.update({
      where: { id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, apiKey: true, createdAt: true },
    });
    return res.json({ application });
  } catch {
    return res.status(404).json({ error: 'Application not found' });
  }
});

app.delete('/api/v1/apps/:id', async (req: Request, res: Response) => {
  const rawId = (req.params as unknown as { id?: string | string[] }).id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  if (!id) {
    return res.status(400).json({ error: 'Missing application id' });
  }

  try {
    await prisma.feedbackReport.deleteMany({ where: { appId: id } });
    await prisma.application.delete({ where: { id } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ error: 'Application not found' });
  }
});

const impactLevelSchema = z.enum(['LOSING_LEADS', 'DELAYING_FOLLOWUPS', 'JUST_ANNOYING']);
const statusSchema = z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']);

const createReportSchema = z.object({
  appId: z.string().min(1),
  userInfo: z.unknown().optional(),
  module: z.string().min(1).max(80),
  description: z.string().min(5).max(5000),
  impactLevel: impactLevelSchema,
  metadata: z.unknown().optional(),
});

app.post('/api/v1/report', requireApiKey, async (req: Request, res: Response) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const userInfo = parsed.data.userInfo;
  const metadata = parsed.data.metadata;

  if (!req.authedApp) {
    return res.status(500).json({ error: 'Auth context missing' });
  }

  if (parsed.data.appId !== req.authedApp.id) {
    return res.status(403).json({ error: 'appId does not match API key' });
  }

  const report = await prisma.feedbackReport.create({
    data: {
      appId: req.authedApp.id,
      ...(userInfo !== undefined && userInfo !== null
        ? { userInfo: userInfo as any }
        : {}),
      module: parsed.data.module,
      description: parsed.data.description,
      impactLevel: parsed.data.impactLevel,
      ...(metadata !== undefined && metadata !== null
        ? { metadataJson: metadata as any }
        : {}),
      status: 'NEW',
    },
    select: {
      id: true,
      appId: true,
      module: true,
      description: true,
      impactLevel: true,
      status: true,
      createdAt: true,
    },
  });

  return res.status(201).json({ report });
});

app.get('/api/v1/reports', async (req: Request, res: Response) => {
  const appId = typeof req.query.appId === 'string' ? req.query.appId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const statusParsed = statusSchema.optional().safeParse(status);
  if (!statusParsed.success) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  const reports = await prisma.feedbackReport.findMany({
    where: {
      ...(appId ? { appId } : {}),
      ...(statusParsed.data ? { status: statusParsed.data } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    include: { application: { select: { name: true } } },
    take: 500,
  });

  return res.json({ reports });
});

app.patch('/api/v1/reports/:id/status', async (req: Request, res: Response) => {
  const rawId = (req.params as unknown as { id?: string | string[] }).id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  if (!id) {
    return res.status(400).json({ error: 'Missing report id' });
  }
  const parsed = statusSchema.safeParse(req.body?.status);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const report = await prisma.feedbackReport.update({
      where: { id },
      data: { status: parsed.data },
      include: { application: { select: { name: true } } },
    });

    return res.json({ report });
  } catch {
    return res.status(404).json({ error: 'Report not found' });
  }
});

// Module management endpoints
app.get('/api/v1/apps/:id/modules', async (req: Request, res: Response) => {
  const appId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!appId) {
    return res.status(400).json({ error: 'Missing app id' });
  }

  try {
    const modules = await prisma.module.findMany({
      where: { appId },
      include: { conditionalFields: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ modules });
  } catch {
    return res.status(404).json({ error: 'Application not found' });
  }
});

const createModuleSchema = z.object({
  value: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  conditionalFields: z
    .array(
      z.object({
        name: z.enum(['leadId', 'propertyId']),
        label: z.string().min(1).max(80),
      })
    )
    .optional(),
});

app.post('/api/v1/apps/:id/modules', async (req: Request, res: Response) => {
  const appId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!appId) {
    return res.status(400).json({ error: 'Missing app id' });
  }

  const parsed = createModuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  try {
    const module = await prisma.module.create({
      data: {
        appId,
        value: parsed.data.value,
        label: parsed.data.label,
        conditionalFields: {
          create: parsed.data.conditionalFields || [],
        },
      },
      include: { conditionalFields: true },
    });
    return res.status(201).json({ module });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'Module value already exists for this app' });
    }
    return res.status(404).json({ error: 'Application not found' });
  }
});

const updateModuleSchema = z.object({
  label: z.string().min(1).max(80),
  conditionalFields: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.enum(['leadId', 'propertyId']),
        label: z.string().min(1).max(80),
      })
    )
    .optional(),
});

app.patch('/api/v1/modules/:id', async (req: Request, res: Response) => {
  const moduleId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!moduleId) {
    return res.status(400).json({ error: 'Missing module id' });
  }

  const parsed = updateModuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  try {
    await prisma.moduleConditionalField.deleteMany({ where: { moduleId } });

    const module = await prisma.module.update({
      where: { id: moduleId },
      data: {
        label: parsed.data.label,
        conditionalFields: {
          create: parsed.data.conditionalFields?.map((f) => ({ name: f.name, label: f.label })) || [],
        },
      },
      include: { conditionalFields: true },
    });
    return res.json({ module });
  } catch {
    return res.status(404).json({ error: 'Module not found' });
  }
});

app.delete('/api/v1/modules/:id', async (req: Request, res: Response) => {
  const moduleId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!moduleId) {
    return res.status(400).json({ error: 'Missing module id' });
  }

  try {
    await prisma.module.delete({ where: { id: moduleId } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ error: 'Module not found' });
  }
});

// Form management endpoints
app.get('/api/v1/apps/:id/forms', async (req: Request, res: Response) => {
  const appId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!appId) {
    return res.status(400).json({ error: 'Missing app id' });
  }

  try {
    const forms = await prisma.form.findMany({
      where: { appId },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ forms });
  } catch {
    return res.status(404).json({ error: 'Application not found' });
  }
});

const createFormSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  fields: z
    .array(
      z.object({
        fieldType: z.enum(['text', 'textarea', 'email', 'number', 'select', 'radio', 'checkbox']),
        label: z.string().min(1).max(100),
        name: z.string().min(1).max(100),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional(),
        order: z.number().optional(),
      })
    )
    .optional(),
});

app.post('/api/v1/apps/:id/forms', async (req: Request, res: Response) => {
  const appId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!appId) {
    return res.status(400).json({ error: 'Missing app id' });
  }

  const parsed = createFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  try {
    const form = await prisma.form.create({
      data: {
        appId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        fields: {
          create: (parsed.data.fields ?? []).map((f, idx) => ({
            fieldType: f.fieldType,
            label: f.label,
            name: f.name,
            required: f.required ?? true,
            placeholder: f.placeholder ?? null,
            options: f.options ? JSON.stringify(f.options) : null,
            order: f.order ?? idx,
          })),
        },
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });
    return res.status(201).json({ form });
  } catch (e: any) {
    return res.status(400).json({ error: 'Failed to create form', details: e.message });
  }
});

app.get('/api/v1/forms/:id', async (req: Request, res: Response) => {
  const formId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!formId) {
    return res.status(400).json({ error: 'Missing form id' });
  }

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    return res.json({ form });
  } catch {
    return res.status(404).json({ error: 'Form not found' });
  }
});

const updateFormSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  fields: z
    .array(
      z.object({
        id: z.string().optional(),
        fieldType: z.enum(['text', 'textarea', 'email', 'number', 'select', 'radio', 'checkbox']),
        label: z.string().min(1).max(100),
        name: z.string().min(1).max(100),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional(),
        order: z.number().optional(),
      })
    )
    .optional(),
});

app.patch('/api/v1/forms/:id', async (req: Request, res: Response) => {
  const formId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!formId) {
    return res.status(400).json({ error: 'Missing form id' });
  }

  const parsed = updateFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  try {
    // If setting isActive to true, deactivate other forms in the same app
    if (parsed.data.isActive) {
      const form = await prisma.form.findUnique({ where: { id: formId } });
      if (form) {
        await prisma.form.updateMany({
          where: { appId: form.appId, id: { not: formId } },
          data: { isActive: false },
        });
      }
    }

    // Delete old fields if new fields are provided
    if (parsed.data.fields) {
      await prisma.formField.deleteMany({ where: { formId } });
    }

    const form = await prisma.form.update({
      where: { id: formId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
        fields: parsed.data.fields
          ? {
              create: parsed.data.fields.map((f, idx) => ({
                fieldType: f.fieldType,
                label: f.label,
                name: f.name,
                required: f.required ?? true,
                placeholder: f.placeholder ?? null,
                options: f.options ? JSON.stringify(f.options) : null,
                order: f.order ?? idx,
              })),
            }
          : undefined,
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });
    return res.json({ form });
  } catch {
    return res.status(404).json({ error: 'Form not found' });
  }
});

app.delete('/api/v1/forms/:id', async (req: Request, res: Response) => {
  const formId = typeof req.params.id === 'string' ? req.params.id : undefined;
  if (!formId) {
    return res.status(400).json({ error: 'Missing form id' });
  }

  try {
    await prisma.form.delete({ where: { id: formId } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ error: 'Form not found' });
  }
});
