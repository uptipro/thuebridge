import type { Application } from '@prisma/client';

export type AuthedApp = Pick<Application, 'id' | 'name' | 'apiKey'>;

declare global {
  namespace Express {
    interface Request {
      authedApp?: AuthedApp;
    }
  }
}
