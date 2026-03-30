import { useEffect, useMemo, useState } from 'react';
import {
  createApp,
  deleteApp,
  impactLabel,
  impactRank,
  listApps,
  listAppsWithKeys,
  listReports,
  nextStatus,
  statusLabel,
  updateApp,
  updateReportStatus,
  type Application,
  type ApplicationDetail,
  type FeedbackReport,
} from './api';

type View = 'INBOX' | 'ONBOARDING' | 'APPLICATIONS';
type SortMode = 'IMPACT_DESC' | 'CREATED_DESC' | 'CREATED_ASC';

export default function App() {
  const [view, setView] = useState<View>('INBOX');
  const [apps, setApps] = useState<Application[]>([]);
  const [allReports, setAllReports] = useState<FeedbackReport[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('IMPACT_DESC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inboxMenuOpen, setInboxMenuOpen] = useState(true);
  const [inboxAppId, setInboxAppId] = useState<string>('ALL');
  const [activeReport, setActiveReport] = useState<FeedbackReport | null>(null);

  const [appsWithKeys, setAppsWithKeys] = useState<ApplicationDetail[]>([]);
  const [apiKeyHiddenByAppId, setApiKeyHiddenByAppId] = useState<Record<string, boolean>>({});
  const [appsPageBusy, setAppsPageBusy] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [newAppName, setNewAppName] = useState('');
  const [lastCreatedApiKey, setLastCreatedApiKey] = useState<string | null>(null);

  async function refreshApps() {
    const data = await listApps();
    setApps(data);
  }

  async function refreshReports() {
    const data = await listReports();
    setAllReports(data);
  }

  useEffect(() => {
    setBusy(true);
    setError(null);
    Promise.all([refreshApps(), refreshReports()])
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setBusy(false));
  }, []);

  const reportCountsByAppId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allReports) {
      map.set(r.appId, (map.get(r.appId) ?? 0) + 1);
    }
    return map;
  }, [allReports]);

  const visibleReports = useMemo(() => {
    const items = allReports.filter((r) => (inboxAppId === 'ALL' ? true : r.appId === inboxAppId));

    items.sort((a, b) => {
      if (sortMode === 'IMPACT_DESC') {
        const byImpact = impactRank(b.impactLevel) - impactRank(a.impactLevel);
        if (byImpact !== 0) return byImpact;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortMode === 'CREATED_ASC') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items;
  }, [allReports, inboxAppId, sortMode]);

  async function onCreateApp() {
    setBusy(true);
    setError(null);
    setLastCreatedApiKey(null);
    try {
      const created = await createApp(newAppName.trim());
      setLastCreatedApiKey(created.apiKey);
      setNewAppName('');
      await refreshApps();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create application');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus(report: FeedbackReport) {
    setError(null);
    const next = nextStatus(report.status);
    setAllReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: next } : r)));
    try {
      await updateReportStatus(report.id, next);
    } catch (e: unknown) {
      setAllReports((prev) => prev.map((r) => (r.id === report.id ? report : r)));
      setError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  function openInbox() {
    setView('INBOX');
    setActiveReport(null);
  }

  function openOnboarding() {
    setView('ONBOARDING');
    setActiveReport(null);
  }

  async function refreshAppsWithKeys() {
    const data = await listAppsWithKeys();
    setAppsWithKeys(data);
    setApiKeyHiddenByAppId((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const a of data) {
        if (next[a.id] === undefined) next[a.id] = true;
      }
      return next;
    });
  }

  async function openApplications() {
    setView('APPLICATIONS');
    setActiveReport(null);
    setError(null);
    setAppsPageBusy(true);
    try {
      await refreshAppsWithKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setAppsPageBusy(false);
    }
  }

  function beginEditApp(app: ApplicationDetail) {
    setEditingAppId(app.id);
    setEditingName(app.name);
  }

  function cancelEditApp() {
    setEditingAppId(null);
    setEditingName('');
  }

  async function saveEditApp(appId: string) {
    const name = editingName.trim();
    if (name.length < 2) return;
    setAppsPageBusy(true);
    setError(null);
    try {
      const updated = await updateApp(appId, name);
      setAppsWithKeys((prev) => prev.map((a) => (a.id === appId ? updated : a)));
      await refreshApps();
      cancelEditApp();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update application');
    } finally {
      setAppsPageBusy(false);
    }
  }

  async function onDeleteApp(appId: string) {
    const ok = window.confirm('Delete this application and all its reports?');
    if (!ok) return;
    setAppsPageBusy(true);
    setError(null);
    try {
      await deleteApp(appId);
      await Promise.all([refreshApps(), refreshReports()]);
      await refreshAppsWithKeys();
      if (editingAppId === appId) cancelEditApp();
      if (view === 'INBOX' && inboxAppId === appId) setInboxAppId('ALL');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete application');
    } finally {
      setAppsPageBusy(false);
    }
  }

  return (
    <div className="h-full bg-slate-50 text-slate-900">
      <div className="flex h-full">
        <aside className="w-72 border-r border-slate-200 bg-white">
          <div className="p-4">
            <div className="text-lg font-semibold">Feedback Hub</div>
            <div className="mt-1 text-sm text-slate-500">Centralized Inbox</div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                className="w-full rounded bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={openOnboarding}
                type="button"
                disabled={busy}
              >
                Register New App
              </button>
              <button
                className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setInboxMenuOpen((v) => !v);
                  openInbox();
                }}
                type="button"
              >
                <span className={`font-medium ${view === 'INBOX' ? 'text-slate-900' : 'text-slate-800'}`}>Inbox</span>
                <span className="text-slate-500">{inboxMenuOpen ? '▾' : '▸'}</span>
              </button>

              {inboxMenuOpen && (
                <div className="space-y-1 pl-2">
                  <button
                    className={`w-full rounded px-3 py-2 text-left text-sm ${
                      view === 'INBOX' && inboxAppId === 'ALL'
                        ? 'bg-slate-100 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setInboxAppId('ALL');
                      openInbox();
                    }}
                    type="button"
                  >
                    <span className="flex items-center justify-between">
                      <span>All Inboxes</span>
                      <span className="text-xs text-slate-500">{allReports.length}</span>
                    </span>
                  </button>

                  {apps.map((a) => (
                    <button
                      key={a.id}
                      className={`w-full rounded px-3 py-2 text-left text-sm ${
                        view === 'INBOX' && inboxAppId === a.id
                          ? 'bg-slate-100 font-medium'
                          : 'hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setInboxAppId(a.id);
                        openInbox();
                      }}
                      type="button"
                    >
                      <span className="flex items-center justify-between">
                        <span className="truncate">{a.name}</span>
                        <span className="text-xs text-slate-500">{reportCountsByAppId.get(a.id) ?? 0}</span>
                      </span>
                    </button>
                  ))}

                  {apps.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-500">No applications created.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <nav className="px-2 pb-4">
            <button
              className={`w-full rounded px-3 py-2 text-left text-sm ${
                view === 'APPLICATIONS' ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'
              }`}
              onClick={openApplications}
              type="button"
            >
              Applications
            </button>
          </nav>
        </aside>

        <main className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="text-base font-semibold">
                {view === 'INBOX'
                  ? 'Master Inbox'
                  : view === 'ONBOARDING'
                    ? 'Register a New Internal App'
                    : 'Applications'}
              </div>
              <div className="text-sm text-slate-500">
                {view === 'INBOX'
                  ? 'All feedback reports across all applications'
                  : view === 'ONBOARDING'
                    ? 'Generate an API key for the widget integration'
                    : 'All applications and their API keys'}
              </div>
            </div>
          </header>

          <div className="px-6 py-5">
            {error && (
              <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            {view === 'ONBOARDING' ? (
              <div className="max-w-xl rounded border border-slate-200 bg-white p-5">
                <div className="text-sm font-medium text-slate-900">Application Name</div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
                    placeholder="e.g. Sales CRM"
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                  />
                  <button
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    onClick={onCreateApp}
                    disabled={busy || newAppName.trim().length < 2}
                    type="button"
                  >
                    Create
                  </button>
                </div>

                {lastCreatedApiKey && (
                  <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-sm font-semibold text-emerald-900">API Key (shown once)</div>
                    <div className="mt-2 break-all rounded bg-white px-3 py-2 font-mono text-sm text-slate-900">
                      {lastCreatedApiKey}
                    </div>
                    <div className="mt-2 text-xs text-emerald-800">
                      Use this as the widget’s <span className="font-mono">apiKey</span> prop.
                    </div>
                  </div>
                )}
              </div>
            ) : view === 'APPLICATIONS' ? (
              <div className="max-w-4xl">
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="text-sm font-semibold text-slate-900">All Applications</div>
                    <div className="mt-1 text-xs text-slate-500">Each app is listed with its API key</div>
                  </div>

                  {appsPageBusy ? (
                    <div className="px-5 py-6 text-sm text-slate-500">Loading…</div>
                  ) : appsWithKeys.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-500">No applications created.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {appsWithKeys.map((a) => {
                        const hidden = apiKeyHiddenByAppId[a.id] ?? true;
                        const isEditing = editingAppId === a.id;
                        return (
                          <div key={a.id} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      className="w-64 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      disabled={appsPageBusy}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-slate-900">{a.name}</div>
                                  </div>
                                )}
                                <div className="mt-1 text-xs text-slate-500">
                                  App ID: <span className="font-mono">{a.id}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Created: {new Date(a.createdAt).toLocaleString()}
                                </div>
                              </div>

                              <div className="w-full max-w-xl">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">API Key</div>
                                </div>

                                <div className="mt-1 flex items-start gap-2">
                                  <div className="flex-1 break-all rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900">
                                    {hidden ? '••••••••••••••••••••••••••••••••' : a.apiKey}
                                  </div>
                                  <div className="shrink-0">
                                    <button
                                      type="button"
                                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      onClick={() =>
                                        setApiKeyHiddenByAppId((prev) => ({ ...prev, [a.id]: !hidden }))
                                      }
                                      disabled={appsPageBusy}
                                    >
                                      {hidden ? 'Unhide' : 'Hide'}
                                    </button>
                                  </div>

                                  <div className="shrink-0 flex items-start gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="button"
                                          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                          onClick={() => saveEditApp(a.id)}
                                          disabled={
                                            appsPageBusy ||
                                            editingName.trim().length < 2 ||
                                            editingName.trim() === a.name
                                          }
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                          onClick={cancelEditApp}
                                          disabled={appsPageBusy}
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                          onClick={() => beginEditApp(a)}
                                          disabled={appsPageBusy}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                          onClick={() => onDeleteApp(a.id)}
                                          disabled={appsPageBusy}
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-slate-700">
                    Showing{' '}
                    <span className="font-medium">{visibleReports.length}</span>
                    {' '}reports
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-slate-600">Sort</span>
                    <select
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                    >
                      <option value="IMPACT_DESC">Business Impact (High → Low)</option>
                      <option value="CREATED_DESC">Created (Newest first)</option>
                      <option value="CREATED_ASC">Created (Oldest first)</option>
                    </select>
                  </label>
                </div>

                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                  <table className="w-full table-fixed">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="w-56 px-4 py-3">Application</th>
                        <th className="w-40 px-4 py-3">Module</th>
                        <th className="w-44 px-4 py-3">Impact</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="w-40 px-4 py-3">Status</th>
                        <th className="w-40 px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleReports.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer text-sm hover:bg-slate-50"
                          onClick={() => setActiveReport(r)}
                        >
                          <td className="px-4 py-3 text-slate-900">{r.application?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{r.module}</td>
                          <td className="px-4 py-3 text-slate-700">{impactLabel(r.impactLevel)}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="truncate">{r.description}</div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleStatus(r);
                              }}
                            >
                              {statusLabel(r.status)}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {!busy && visibleReports.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                            No feedback reports yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {activeReport && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setActiveReport(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200 bg-white shadow">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-slate-900">Report Details</div>
                <div className="mt-1 text-sm text-slate-600">{activeReport.application?.name ?? '—'}</div>
              </div>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => setActiveReport(null)}
              >
                Close
              </button>
            </div>

            <div className="h-[calc(100%-64px)] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module</div>
                  <div className="mt-1 text-sm text-slate-900">{activeReport.module}</div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Impact</div>
                  <div className="mt-1 text-sm text-slate-900">{impactLabel(activeReport.impactLevel)}</div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                  <div className="mt-2">
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                      onClick={() => onToggleStatus(activeReport)}
                    >
                      {statusLabel(activeReport.status)}
                    </button>
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</div>
                  <div className="mt-1 text-sm text-slate-900">{new Date(activeReport.createdAt).toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{activeReport.description}</div>
              </div>

              <div className="mt-4 rounded border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata</div>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-800">
{JSON.stringify(activeReport.metadataJson ?? null, null, 2)}
                </pre>
              </div>

              <div className="mt-4 rounded border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">User Info</div>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-800">
{JSON.stringify(activeReport.userInfo ?? null, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
