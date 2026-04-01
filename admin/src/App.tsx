import { useEffect, useMemo, useState } from "react";
import {
  createApp,
  createForm,
  deleteApp,
  deleteForm,
  impactLabel,
  impactRank,
  listApps,
  listAppsWithKeys,
  listForms,
  listModules,
  listReports,
  nextStatus,
  setFormActive,
  statusLabel,
  updateApp,
  updateReportStatus,
  type Application,
  type ApplicationDetail,
  type FeedbackReport,
  type Form,
  type FormField,
  type Module,
} from "./api";

type View = "INBOX" | "ONBOARDING" | "APPLICATIONS" | "APP_DETAILS";
type SortMode = "IMPACT_DESC" | "CREATED_DESC" | "CREATED_ASC";

export default function App() {
  // Global state
  const [view, setView] = useState<View>("INBOX");
  const [apps, setApps] = useState<Application[]>([]);
  const [allReports, setAllReports] = useState<FeedbackReport[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("IMPACT_DESC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inbox state
  const [inboxMenuOpen, setInboxMenuOpen] = useState(true);
  const [inboxAppId, setInboxAppId] = useState<string>("ALL");
  const [activeReport, setActiveReport] = useState<FeedbackReport | null>(null);

  // Applications list state
  const [appsWithKeys, setAppsWithKeys] = useState<ApplicationDetail[]>([]);
  const [apiKeyHiddenByAppId, setApiKeyHiddenByAppId] = useState<
    Record<string, boolean>
  >({});
  const [appsPageBusy, setAppsPageBusy] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newAppName, setNewAppName] = useState("");
  const [lastCreatedApiKey, setLastCreatedApiKey] = useState<string | null>(
    null,
  );

  // App details state
  const [selectedAppForDetails, setSelectedAppForDetails] =
    useState<ApplicationDetail | null>(null);
  const [_modules, setModules] = useState<Module[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  // Form builder state
  const [newFormName, setNewFormName] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");

  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [newFieldType, setNewFieldType] =
    useState<FormField["fieldType"]>("text");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState("");
  const [newFieldOptions, setNewFieldOptions] = useState("");

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
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
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
    const items = allReports.filter((r) =>
      inboxAppId === "ALL" ? true : r.appId === inboxAppId,
    );

    items.sort((a, b) => {
      if (sortMode === "IMPACT_DESC") {
        const byImpact = impactRank(b.impactLevel) - impactRank(a.impactLevel);
        if (byImpact !== 0) return byImpact;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      if (sortMode === "CREATED_ASC") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
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
      setNewAppName("");
      await refreshApps();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create application");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus(report: FeedbackReport) {
    setError(null);
    const next = nextStatus(report.status);
    setAllReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, status: next } : r)),
    );
    try {
      await updateReportStatus(report.id, next);
    } catch (e: unknown) {
      setAllReports((prev) =>
        prev.map((r) => (r.id === report.id ? report : r)),
      );
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  function openInbox() {
    setView("INBOX");
    setActiveReport(null);
  }

  function openOnboarding() {
    setView("ONBOARDING");
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
    setView("APPLICATIONS");
    setActiveReport(null);
    setError(null);
    setAppsPageBusy(true);
    try {
      await refreshAppsWithKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load applications");
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
    setEditingName("");
  }

  async function saveEditApp(appId: string) {
    const name = editingName.trim();
    if (name.length < 2) return;
    setAppsPageBusy(true);
    setError(null);
    try {
      const updated = await updateApp(appId, name);
      setAppsWithKeys((prev) =>
        prev.map((a) => (a.id === appId ? updated : a)),
      );
      await refreshApps();
      cancelEditApp();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update application");
    } finally {
      setAppsPageBusy(false);
    }
  }

  async function onDeleteApp(appId: string) {
    const ok = window.confirm("Delete this application and all its reports?");
    if (!ok) return;
    setAppsPageBusy(true);
    setError(null);
    try {
      await deleteApp(appId);
      await Promise.all([refreshApps(), refreshReports()]);
      await refreshAppsWithKeys();
      if (editingAppId === appId) cancelEditApp();
      if (view === "INBOX" && inboxAppId === appId) setInboxAppId("ALL");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete application");
    } finally {
      setAppsPageBusy(false);
    }
  }

  // Module management functions
  async function openAppDetails(app: ApplicationDetail) {
    setSelectedAppForDetails(app);
    setView("APP_DETAILS");
    setModulesLoading(true);
    setError(null);
    try {
      const [mods, frms] = await Promise.all([
        listModules(app.id),
        listForms(app.id),
      ]);
      setModules(mods);
      setForms(frms);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setModulesLoading(false);
    }
  }

  // Form builder functions
  async function onCreateForm() {
    if (!selectedAppForDetails) return;
    if (newFormName.trim().length < 1) return;

    setModulesLoading(true);
    setError(null);
    try {
      const formFieldsData = formFields.map((f) => ({
        fieldType: f.fieldType,
        label: f.label,
        name: f.name,
        required: f.required,
        placeholder: f.placeholder,
        options: f.options,
      }));

      const newForm = await createForm(
        selectedAppForDetails.id,
        newFormName.trim(),
        newFormDescription.trim() || undefined,
        formFieldsData,
      );
      setForms((prev) => [...prev, newForm]);
      setNewFormName("");
      setNewFormDescription("");
      setFormFields([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create form");
    } finally {
      setModulesLoading(false);
    }
  }

  function addFormField() {
    if (newFieldLabel.trim().length < 1 || newFieldName.trim().length < 1)
      return;

    const newField: FormField = {
      id: `temp-${Date.now()}`,
      formId: "",
      fieldType: newFieldType,
      label: newFieldLabel.trim(),
      name: newFieldName.trim(),
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
      options: newFieldOptions.trim()
        ? newFieldOptions.split("\n").filter((o) => o.trim())
        : undefined,
      order: formFields.length,
      createdAt: new Date().toISOString(),
    };

    setFormFields((prev) => [...prev, newField]);
    setNewFieldType("text");
    setNewFieldLabel("");
    setNewFieldName("");
    setNewFieldRequired(true);
    setNewFieldPlaceholder("");
    setNewFieldOptions("");
  }

  function removeFormField(index: number) {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveFormFieldUp(index: number) {
    if (index <= 0) return;
    const newFields = [...formFields];
    [newFields[index], newFields[index - 1]] = [
      newFields[index - 1],
      newFields[index],
    ];
    // Update order values
    newFields.forEach((field, idx) => {
      field.order = idx;
    });
    setFormFields(newFields);
  }

  function moveFormFieldDown(index: number) {
    if (index >= formFields.length - 1) return;
    const newFields = [...formFields];
    [newFields[index], newFields[index + 1]] = [
      newFields[index + 1],
      newFields[index],
    ];
    // Update order values
    newFields.forEach((field, idx) => {
      field.order = idx;
    });
    setFormFields(newFields);
  }

  async function onSetFormActive(formId: string) {
    try {
      setModulesLoading(true);
      await setFormActive(formId);
      await refreshForms();
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Failed to update form");
    } finally {
      setModulesLoading(false);
    }
  }

  async function refreshForms() {
    if (!selectedAppForDetails) return;
    setModulesLoading(true);
    try {
      const data = await listForms(selectedAppForDetails.id);
      setForms(data);
    } catch {
      // silently fail
    } finally {
      setModulesLoading(false);
    }
  }

  async function onDeleteForm(formId: string) {
    const ok = window.confirm("Delete this form?");
    if (!ok) return;
    setModulesLoading(true);
    setError(null);
    try {
      await deleteForm(formId);
      setForms((prev) => prev.filter((f) => f.id !== formId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete form");
    } finally {
      setModulesLoading(false);
    }
  }

  const embedCode = selectedAppForDetails
    ? `import { FeedbackWidget } from '@thebridge/widget';

export default function App() {
  return (
    <div>
      {/* Your app content here */}
      <FeedbackWidget
        appId="${selectedAppForDetails.id}"
        apiKey="${selectedAppForDetails.apiKey}"
        apiBaseUrl="http://localhost:4000"
      />
    </div>
  );
}`
    : "";

  return (
    <div className="h-full bg-slate-50 text-slate-900">
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-200 bg-white">
          <div className="px-4 py-4">
            <div className="text-lg font-bold text-slate-900">The Bridge</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Feedback as a Service
            </div>
          </div>

          <nav className="mt-6 space-y-1 px-2">
            <button
              type="button"
              onClick={openInbox}
              className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition ${
                view === "INBOX"
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={openApplications}
              className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition ${
                view === "APPLICATIONS" || view === "APP_DETAILS"
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Applications
            </button>
            <button
              type="button"
              onClick={openOnboarding}
              className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition ${
                view === "ONBOARDING"
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              New App
            </button>
          </nav>

          {view === "INBOX" && inboxMenuOpen && (
            <div className="mt-6 border-t border-slate-200 px-2 py-3">
              <button
                type="button"
                className="w-full rounded px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
                onClick={() => setInboxMenuOpen(false)}
              >
                ▼ Filter by App
              </button>
              <div className="mt-2 space-y-1">
                <button
                  type="button"
                  onClick={() => setInboxAppId("ALL")}
                  className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                    inboxAppId === "ALL"
                      ? "bg-slate-200 font-medium text-slate-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  All Apps
                </button>
                {apps.map((a) => {
                  const count = reportCountsByAppId.get(a.id) ?? 0;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setInboxAppId(a.id)}
                      className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                        inboxAppId === a.id
                          ? "bg-slate-200 font-medium text-slate-900"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{a.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">
                          {count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {view === "INBOX"
                  ? "Inbox"
                  : view === "ONBOARDING"
                    ? "Create Application"
                    : view === "APP_DETAILS"
                      ? selectedAppForDetails?.name
                      : "All Applications"}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {view === "INBOX"
                  ? "All feedback reports across all applications"
                  : view === "ONBOARDING"
                    ? "Generate an API key for the widget integration"
                    : view === "APP_DETAILS"
                      ? "Manage modules and embed instructions"
                      : "All applications and their API keys"}
              </div>
            </div>
          </header>

          <div className="px-6 py-5">
            {error && (
              <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            {view === "ONBOARDING" ? (
              <div className="max-w-xl rounded border border-slate-200 bg-white p-5">
                <div className="text-sm font-medium text-slate-900">
                  Application Name
                </div>
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
                    <div className="text-sm font-semibold text-emerald-900">
                      API Key (shown once)
                    </div>
                    <div className="mt-2 break-all rounded bg-white px-3 py-2 font-mono text-sm text-slate-900">
                      {lastCreatedApiKey}
                    </div>
                    <div className="mt-2 text-xs text-emerald-800">
                      Use this as the widget's{" "}
                      <span className="font-mono">apiKey</span> prop.
                    </div>
                  </div>
                )}
              </div>
            ) : view === "APP_DETAILS" && selectedAppForDetails ? (
              <div className="max-w-6xl space-y-6">
                {/* Forms section */}
                <div className="rounded border border-slate-200 bg-white p-5">
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Create Feedback Form
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Define custom fields to collect specific feedback data
                    </div>
                  </div>

                  {forms.length > 0 && (
                    <div className="mb-6 space-y-2 border-b border-slate-200 pb-6">
                      <div className="text-xs font-semibold uppercase text-slate-600">
                        Existing Forms
                      </div>
                      {forms.map((form) => (
                        <div
                          key={form.id}
                          className={`relative flex items-center justify-between rounded border p-3 ${form.isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
                        >
                          {form.isActive && (
                            <div className="absolute -top-2 -left-2 inline-block rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                              Active
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {form.name}
                            </div>
                            {form.description && (
                              <div className="text-xs text-slate-600">
                                {form.description}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-slate-600">
                              {form.fields.length} field(s)
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!form.isActive && (
                              <button
                                type="button"
                                className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                                onClick={() => onSetFormActive(form.id)}
                                disabled={modulesLoading}
                              >
                                Set Active
                              </button>
                            )}
                            <button
                              type="button"
                              className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                              onClick={() => onDeleteForm(form.id)}
                              disabled={modulesLoading}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Form builder */}
                  <div className="space-y-4 rounded border border-slate-300 bg-slate-50 p-4">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-600">
                        Form Name*
                      </label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
                        value={newFormName}
                        onChange={(e) => setNewFormName(e.target.value)}
                        placeholder="e.g., 'Sales Feedback Form'"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-600">
                        Description
                      </label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
                        value={newFormDescription}
                        onChange={(e) => setNewFormDescription(e.target.value)}
                        placeholder="Optional description"
                      />
                    </div>

                    {/* Form fields editor */}
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="mb-3 text-xs font-semibold text-slate-600">
                        Form Fields
                      </div>

                      {formFields.length > 0 && (
                        <div className="mb-3 space-y-2 rounded bg-slate-100 p-2">
                          {formFields.map((field, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded bg-white p-3 text-xs hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                    onClick={() => moveFormFieldUp(idx)}
                                    disabled={idx === 0}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                    onClick={() => moveFormFieldDown(idx)}
                                    disabled={idx === formFields.length - 1}
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900">
                                    {field.label}
                                  </div>
                                  <div className="text-slate-600">
                                    {field.fieldType}{" "}
                                    {field.required
                                      ? "(required)"
                                      : "(optional)"}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="text-rose-600 hover:text-rose-700"
                                onClick={() => removeFormField(idx)}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add field section */}
                      <div className="space-y-2 rounded border border-slate-300 bg-white p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Field Type
                            </label>
                            <select
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              value={newFieldType}
                              onChange={(e) =>
                                setNewFieldType(
                                  e.target.value as FormField["fieldType"],
                                )
                              }
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Textarea</option>
                              <option value="email">Email</option>
                              <option value="number">Number</option>
                              <option value="select">Select</option>
                              <option value="radio">Radio</option>
                              <option value="checkbox">Checkbox</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Label*
                            </label>
                            <input
                              type="text"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              value={newFieldLabel}
                              onChange={(e) => setNewFieldLabel(e.target.value)}
                              placeholder="Field label"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Field Name*
                            </label>
                            <input
                              type="text"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              value={newFieldName}
                              onChange={(e) => setNewFieldName(e.target.value)}
                              placeholder="e.g., 'customer_name'"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Placeholder
                            </label>
                            <input
                              type="text"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              value={newFieldPlaceholder}
                              onChange={(e) =>
                                setNewFieldPlaceholder(e.target.value)
                              }
                              placeholder="Optional placeholder"
                            />
                          </div>
                        </div>

                        {(newFieldType === "select" ||
                          newFieldType === "radio" ||
                          newFieldType === "checkbox") && (
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Options (one per line)
                            </label>
                            <textarea
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-400"
                              value={newFieldOptions}
                              onChange={(e) =>
                                setNewFieldOptions(e.target.value)
                              }
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              rows={3}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="required"
                            checked={newFieldRequired}
                            onChange={(e) =>
                              setNewFieldRequired(e.target.checked)
                            }
                            className="rounded border-slate-300"
                          />
                          <label
                            htmlFor="required"
                            className="text-xs font-semibold text-slate-600"
                          >
                            Required field
                          </label>
                        </div>

                        <button
                          type="button"
                          className="w-full rounded bg-slate-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          onClick={addFormField}
                          disabled={
                            newFieldLabel.trim().length < 1 ||
                            newFieldName.trim().length < 1
                          }
                        >
                          Add Field
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      onClick={onCreateForm}
                      disabled={modulesLoading || newFormName.trim().length < 1}
                    >
                      Create Form
                    </button>
                  </div>
                </div>

                {/* Embedding code section */}
                <div className="rounded border border-slate-200 bg-white p-5">
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Embed Instructions
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Copy this code to embed the feedback widget in your
                      application
                    </div>
                  </div>

                  <pre className="overflow-x-auto rounded border border-slate-300 bg-slate-900 p-4 text-xs text-slate-100">
                    {embedCode}
                  </pre>

                  <button
                    type="button"
                    className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode);
                      alert("Code copied to clipboard!");
                    }}
                  >
                    Copy Code
                  </button>
                </div>

                {/* Feedback reports for this app */}
                <div className="rounded border border-slate-200 bg-white p-5">
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Recent Feedback
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Latest reports from this application
                    </div>
                  </div>

                  {allReports.filter(
                    (r) => r.appId === selectedAppForDetails.id,
                  ).length === 0 ? (
                    <div className="text-sm text-slate-600">
                      No feedback reports yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Module
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Impact
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-700">
                              Created
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allReports
                            .filter((r) => r.appId === selectedAppForDetails.id)
                            .slice(0, 10)
                            .map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-900">
                                  {r.module}
                                </td>
                                <td className="px-4 py-2 text-slate-700">
                                  {impactLabel(r.impactLevel)}
                                </td>
                                <td className="px-4 py-2">
                                  <button
                                    type="button"
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                                    onClick={() => onToggleStatus(r)}
                                  >
                                    {statusLabel(r.status)}
                                  </button>
                                </td>
                                <td className="px-4 py-2 text-slate-600">
                                  {new Date(r.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : view === "APPLICATIONS" ? (
              <div className="max-w-4xl">
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="text-sm font-semibold text-slate-900">
                      All Applications
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Each app is listed with its API key
                    </div>
                  </div>

                  {appsPageBusy ? (
                    <div className="px-5 py-6 text-sm text-slate-500">
                      Loading…
                    </div>
                  ) : appsWithKeys.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-500">
                      No applications created.
                    </div>
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
                                      onChange={(e) =>
                                        setEditingName(e.target.value)
                                      }
                                      disabled={appsPageBusy}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-slate-900">
                                      {a.name}
                                    </div>
                                  </div>
                                )}
                                <div className="mt-1 text-xs text-slate-500">
                                  App ID:{" "}
                                  <span className="font-mono">{a.id}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Created:{" "}
                                  {new Date(a.createdAt).toLocaleString()}
                                </div>
                              </div>

                              <div className="w-full max-w-xl">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    API Key
                                  </div>
                                </div>

                                <div className="mt-1 flex items-start gap-2">
                                  <div className="flex-1 break-all rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900">
                                    {hidden
                                      ? "••••••••••••••••••••••••••••••••"
                                      : a.apiKey}
                                  </div>
                                  <div className="shrink-0">
                                    <button
                                      type="button"
                                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                      onClick={() =>
                                        setApiKeyHiddenByAppId((prev) => ({
                                          ...prev,
                                          [a.id]: !hidden,
                                        }))
                                      }
                                      disabled={appsPageBusy}
                                    >
                                      {hidden ? "Unhide" : "Hide"}
                                    </button>
                                  </div>
                                </div>
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
                                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                      onClick={() => openAppDetails(a)}
                                      disabled={appsPageBusy}
                                    >
                                      Details
                                    </button>
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
                    Showing{" "}
                    <span className="font-medium">{visibleReports.length}</span>{" "}
                    reports
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-slate-600">Sort</span>
                    <select
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-slate-400"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                    >
                      <option value="IMPACT_DESC">
                        Business Impact (High → Low)
                      </option>
                      <option value="CREATED_DESC">
                        Created (Newest first)
                      </option>
                      <option value="CREATED_ASC">
                        Created (Oldest first)
                      </option>
                    </select>
                  </label>
                </div>

                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                  <table className="w-full table-fixed">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                          <td className="px-4 py-3 text-slate-700">
                            {r.module}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {impactLabel(r.impactLevel)}
                          </td>
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
                          <td
                            className="px-4 py-6 text-sm text-slate-500"
                            colSpan={5}
                          >
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
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setActiveReport(null)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200 bg-white shadow">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  Report Details
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {activeReport.application?.name ?? "—"}
                </div>
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
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Module
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {activeReport.module}
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Impact
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {impactLabel(activeReport.impactLevel)}
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </div>
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
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </div>
                  <div className="mt-1 text-sm text-slate-900">
                    {new Date(activeReport.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
                  {activeReport.description}
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Metadata
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-800">
                  {JSON.stringify(activeReport.metadataJson ?? null, null, 2)}
                </pre>
              </div>

              <div className="mt-4 rounded border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  User Info
                </div>
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
