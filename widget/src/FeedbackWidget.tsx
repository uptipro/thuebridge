import { useEffect, useState } from 'react';

type FormField = {
  id: string;
  fieldType: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'radio' | 'checkbox';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
};

type Form = {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  fields: FormField[];
};

type UserInfo = {
  email?: string;
  name?: string;
};

type Props = {
  appId: string;
  apiKey: string;
  apiBaseUrl?: string;
  userInfo?: UserInfo;
};

const defaultApiBaseUrl = 'http://localhost:4000';

function parseOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options;
  }
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function FormFieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  const commonClasses =
    'w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400';

  switch (field.fieldType) {
    case 'text':
      return (
        <input
          type="text"
          className={commonClasses}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case 'textarea':
      return (
        <textarea
          className={`${commonClasses} min-h-24 resize-y`}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case 'email':
      return (
        <input
          type="email"
          className={commonClasses}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className={commonClasses}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case 'select':
      return (
        <select
          className={commonClasses}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">-- Select an option --</option>
          {parseOptions(field.options).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case 'radio':
      return (
        <div className="space-y-2">
          {parseOptions(field.options).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name={field.name}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div className="space-y-2">
          {parseOptions(field.options).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                value={opt}
                checked={Array.isArray(value) && value.includes(opt)}
                onChange={(e) => {
                  const arr = Array.isArray(value) ? [...value] : [];
                  if (e.target.checked) {
                    arr.push(opt);
                  } else {
                    arr.splice(arr.indexOf(opt), 1);
                  }
                  onChange(arr);
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function FeedbackWidget({ appId, apiKey, apiBaseUrl, userInfo }: Props) {
  const baseUrl = apiBaseUrl ?? defaultApiBaseUrl;

  const [open, setOpen] = useState(false);
  const [forms, setForms] = useState<Form[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({});
  const [loadingForms, setLoadingForms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get the active form
  const selectedForm = forms.find((f) => f.isActive);

  useEffect(() => {
    if (open && forms.length === 0 && !loadingForms) {
      fetchForms();
    }
  }, [open, forms.length, loadingForms]);

  async function fetchForms() {
    setLoadingForms(true);
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/api/v1/apps/${appId}/forms`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch forms: ${res.status}`);
      }

      const data = await res.json();
      setForms(data.forms || []);
      // Initialize form values for the active form
      const activeForm = (data.forms || []).find((f: Form) => f.isActive);
      if (activeForm) {
        initializeFormValues(activeForm);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load forms');
    } finally {
      setLoadingForms(false);
    }
  }

  function initializeFormValues(form: Form) {
    const values: Record<string, string | string[]> = {};
    form.fields.forEach((field) => {
      values[field.name] = field.fieldType === 'checkbox' ? [] : '';
    });
    setFormValues(values);
  }

  async function submit() {
    if (!selectedForm) return;

    setSubmitting(true);
    setError(null);

    const timestamp = new Date().toISOString();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const language = navigator.language;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const metadata = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp,
      screenWidth,
      screenHeight,
      language,
      timezone,
      formData: formValues,
    };

    const payload = {
      appId,
      userInfo,
      module: selectedForm.name,
      description: selectedForm.description || '',
      impactLevel: 'JUST_ANNOYING',
      metadata,
    };

    try {
      const res = await fetch(`${baseUrl}/api/v1/report`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        // Reset form values
        if (selectedForm) {
          initializeFormValues(selectedForm);
        }
      }, 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send feedback');
    } finally {
      setSubmitting(false);
    }
  }

  const isFormValid = selectedForm && 
    selectedForm.fields
      .filter(f => f.required)
      .every(f => {
        const val = formValues[f.name];
        return val && (Array.isArray(val) ? val.length > 0 : String(val).trim().length > 0);
      });

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow disabled:opacity-50"
        onClick={() => setOpen(true)}
      >
        Send Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => (submitting ? null : setOpen(false))}
          />

          <div className="relative mx-auto mt-24 w-[92vw] max-w-lg rounded-lg bg-white p-5 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">Send Feedback</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  Help us improve your experience.
                </div>
              </div>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => (submitting ? null : setOpen(false))}
              >
                Close
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Thank you for your feedback!
              </div>
            )}

            {loadingForms && (
              <div className="mt-4 text-sm text-slate-600">Loading forms...</div>
            )}

            {!loadingForms && forms.length === 0 && (
              <div className="mt-4 text-sm text-slate-600">No forms available.</div>
            )}

            {!loadingForms && forms.length > 0 && selectedForm && (
              <>
                {userInfo?.email && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-900">Email</label>
                    <div className="mt-2 text-sm text-slate-600">{userInfo.email}</div>
                  </div>
                )}

                {userInfo?.name && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-900">Name</label>
                    <div className="mt-2 text-sm text-slate-600">{userInfo.name}</div>
                  </div>
                )}

                {selectedForm.fields.map((field) => (
                  <div key={field.id} className="mt-4">
                    <label className="text-sm font-medium text-slate-900">
                      {field.label}
                      {field.required && <span className="text-rose-600">*</span>}
                    </label>
                    <div className="mt-2">
                      <FormFieldInput
                        field={field}
                        value={formValues[field.name] || (field.fieldType === 'checkbox' ? [] : '')}
                        onChange={(val) =>
                          setFormValues({
                            ...formValues,
                            [field.name]: val,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={submit}
                    disabled={submitting || !isFormValid || success}
                  >
                    {submitting ? 'Sending…' : 'Send'}
                  </button>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  Auto-captured: URL, user-agent, timestamp, device info.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
