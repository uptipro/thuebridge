import { FeedbackWidget } from './FeedbackWidget';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000';
const appId = (import.meta.env.VITE_APP_ID as string | undefined) ?? '';
const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) ?? '';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl rounded border border-slate-200 bg-white p-5">
        <div className="text-lg font-semibold">Widget Dev Harness</div>
        <div className="mt-1 text-sm text-slate-600">
          Set <span className="font-mono">VITE_APP_ID</span> and <span className="font-mono">VITE_API_KEY</span> in
          <span className="font-mono"> widget/.env</span> to send real reports.
        </div>
        <div className="mt-4 text-sm text-slate-700">
          API: <span className="font-mono">{apiBaseUrl}</span>
        </div>
      </div>

      {appId && apiKey ? (
        <FeedbackWidget appId={appId} apiKey={apiKey} apiBaseUrl={apiBaseUrl} />
      ) : (
        <div className="mx-auto mt-4 max-w-2xl rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Missing <span className="font-mono">VITE_APP_ID</span> or <span className="font-mono">VITE_API_KEY</span>.
        </div>
      )}
    </div>
  );
}
