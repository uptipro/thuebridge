import type { RequestHandler } from 'express';
import { prisma } from './db.js';

export const requireApiKey: RequestHandler = async (req, res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const application = await prisma.application.findUnique({
    where: { apiKey },
    select: { id: true, name: true, apiKey: true },
  });

  if (!application) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.authedApp = application;
  next();
};
