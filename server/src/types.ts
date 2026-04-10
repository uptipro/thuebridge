export type AuthedApp = {
  id: string;
  name: string;
  apiKey: string;
};

declare global {
  namespace Express {
    interface Request {
      authedApp?: AuthedApp;
    }
  }
}
