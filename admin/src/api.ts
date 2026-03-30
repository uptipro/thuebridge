export type Application = {
  id: string;
  name: string;
  createdAt: string;
};

export type ApplicationDetail = Application & {
  apiKey: string;
};

export type ModuleConditionalField = {
  id: string;
  name: 'leadId' | 'propertyId';
  label: string;
};

export type Module = {
  id: string;
  appId: string;
  value: string;
  label: string;
  conditionalFields: ModuleConditionalField[];
  createdAt: string;
};

export type FormField = {
  id: string;
  formId: string;
  fieldType: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'radio' | 'checkbox';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
  createdAt: string;
};

export type Form = {
  id: string;
  appId: string;
  name: string;
  description?: string;
  isActive?: boolean;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
};

export type ReportStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
export type ImpactLevel = 'LOSING_LEADS' | 'DELAYING_FOLLOWUPS' | 'JUST_ANNOYING';

export type FeedbackReport = {
  id: string;
  appId: string;
  userInfo?: unknown | null;
  module: string;
  description: string;
  impactLevel: ImpactLevel;
  metadataJson?: unknown | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt?: string;
  application?: { name: string };
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000';

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function listApps(): Promise<Application[]> {
  const data = await apiFetch('/api/v1/apps');
  return data.applications;
}

export async function listAppsWithKeys(): Promise<ApplicationDetail[]> {
  const data = await apiFetch('/api/v1/apps?includeApiKey=true');
  return data.applications;
}

export async function createApp(name: string): Promise<{ id: string; name: string; apiKey: string }> {
  const data = await apiFetch('/api/v1/apps', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.application;
}

export async function getApp(id: string): Promise<ApplicationDetail> {
  const data = await apiFetch(`/api/v1/apps/${encodeURIComponent(id)}`);
  return data.application;
}

export async function updateApp(id: string, name: string): Promise<ApplicationDetail> {
  const data = await apiFetch(`/api/v1/apps/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return data.application;
}

export async function deleteApp(id: string): Promise<void> {
  await apiFetch(`/api/v1/apps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listReports(appId?: string): Promise<FeedbackReport[]> {
  const qs = appId ? `?appId=${encodeURIComponent(appId)}` : '';
  const data = await apiFetch(`/api/v1/reports${qs}`);
  return data.reports;
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<FeedbackReport> {
  const data = await apiFetch(`/api/v1/reports/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return data.report;
}

export function impactLabel(level: ImpactLevel): string {
  switch (level) {
    case 'LOSING_LEADS':
      return 'Losing Leads';
    case 'DELAYING_FOLLOWUPS':
      return 'Delaying Follow-ups';
    case 'JUST_ANNOYING':
      return 'Just Annoying';
  }
}

export function impactRank(level: ImpactLevel): number {
  switch (level) {
    case 'LOSING_LEADS':
      return 3;
    case 'DELAYING_FOLLOWUPS':
      return 2;
    case 'JUST_ANNOYING':
      return 1;
  }
}

export function statusLabel(status: ReportStatus): string {
  switch (status) {
    case 'NEW':
      return 'New';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'RESOLVED':
      return 'Resolved';
  }
}

export function nextStatus(status: ReportStatus): ReportStatus {
  switch (status) {
    case 'NEW':
      return 'IN_PROGRESS';
    case 'IN_PROGRESS':
      return 'RESOLVED';
    case 'RESOLVED':
      return 'NEW';
  }
}

// Module management functions
export async function listModules(appId: string): Promise<Module[]> {
  const data = await apiFetch(`/api/v1/apps/${encodeURIComponent(appId)}/modules`);
  return data.modules ?? [];
}

export async function createModule(
  appId: string,
  value: string,
  label: string,
  conditionalFields?: Array<{ name: 'leadId' | 'propertyId'; label: string }>
): Promise<Module> {
  const data = await apiFetch(`/api/v1/apps/${encodeURIComponent(appId)}/modules`, {
    method: 'POST',
    body: JSON.stringify({ value, label, conditionalFields }),
  });
  return data.module;
}

export async function updateModule(
  id: string,
  label: string,
  conditionalFields?: Array<{ id?: string; name: 'leadId' | 'propertyId'; label: string }>
): Promise<Module> {
  const data = await apiFetch(`/api/v1/modules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ label, conditionalFields }),
  });
  return data.module;
}

export async function deleteModule(id: string): Promise<void> {
  await apiFetch(`/api/v1/modules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// Form management functions
export async function listForms(appId: string): Promise<Form[]> {
  const data = await apiFetch(`/api/v1/apps/${encodeURIComponent(appId)}/forms`);
  return data.forms ?? [];
}

export async function createForm(
  appId: string,
  name: string,
  description?: string,
  fields?: Array<{
    fieldType: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'radio' | 'checkbox';
    label: string;
    name: string;
    required?: boolean;
    placeholder?: string;
    options?: string[];
  }>
): Promise<Form> {
  const data = await apiFetch(`/api/v1/apps/${encodeURIComponent(appId)}/forms`, {
    method: 'POST',
    body: JSON.stringify({ name, description, fields }),
  });
  return data.form;
}

export async function updateForm(
  id: string,
  name?: string,
  description?: string,
  fields?: Array<{
    id?: string;
    fieldType: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'radio' | 'checkbox';
    label: string;
    name: string;
    required?: boolean;
    placeholder?: string;
    options?: string[];
    order?: number;
  }>
): Promise<Form> {
  const data = await apiFetch(`/api/v1/forms/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description, fields }),
  });
  return data.form;
}

export async function deleteForm(id: string): Promise<void> {
  await apiFetch(`/api/v1/forms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function setFormActive(id: string): Promise<Form> {
  const data = await apiFetch(`/api/v1/forms/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: true }),
  });
  return data.form;
}
