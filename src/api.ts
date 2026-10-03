import { CustomerRequest, WorkItem, ActivityEntry, RequestStatus, ConversionPayload, User, Workspace, LoginPayload, AuthSession, WorkspaceStats, DemoAccount, AssistantSuggestion, AssistantSuggestionsResponse, CreateRequestPayload, UpdateRequestPayload, CreateCustomerRequestPayload } from './types.ts';

// Storage keys
const WS_STORAGE_KEY = 'crd_workspace_id';
const USER_DATA_KEY = 'crd_user_data';
const ROLE_STORAGE_KEY = 'crd_role';
const ACCESS_TOKEN_KEY = 'crd_access_token';
const AUTH_NOTICE_KEY = 'crd_auth_notice';

export function getActiveWorkspaceId(): string {
  const user = getStoredUser();
  if (user && user.user_type === 'WORKPLACE' && user.workspace_id) {
    return user.workspace_id;
  }
  return localStorage.getItem(WS_STORAGE_KEY) || user?.workspace_id || 'ws_apex';
}

export function setActiveWorkspaceId(id: string): void {
  localStorage.setItem(WS_STORAGE_KEY, id);
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_DATA_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredSession(user: User, workspace: Workspace | null, token: string): void {
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  localStorage.setItem(ROLE_STORAGE_KEY, user.user_type);
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  if (workspace) {
    localStorage.setItem(WS_STORAGE_KEY, workspace.id);
  } else if (user.workspace_id) {
    localStorage.setItem(WS_STORAGE_KEY, user.workspace_id);
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(USER_DATA_KEY);
  localStorage.removeItem(ROLE_STORAGE_KEY);
  localStorage.removeItem(WS_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function consumeAuthNotice(): string | null {
  const message = sessionStorage.getItem(AUTH_NOTICE_KEY);
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return message;
}

function fallbackMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Some submitted information is invalid. Please review it and try again.',
    401: 'Your login session is missing, invalid, or has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested record or API route was not found.',
    409: 'This action conflicts with the current data. Refresh the page and try again.',
    413: 'The submitted request is too large.',
    415: 'The request format is not supported.',
    429: 'Too many requests were sent. Please wait a moment and try again.',
    500: 'The server could not complete this request. Please try again shortly.',
    502: 'The server is temporarily unavailable. Please try again shortly.',
    503: 'The service is temporarily unavailable. Please try again shortly.'
  };
  return messages[status] || `The request failed with HTTP ${status}.`;
}

export interface ApiClientError extends Error {
  status: number;
  code?: string;
  details?: Record<string, string>;
  raw?: unknown;
}

function createApiError(message: string, status: number, code?: string): ApiClientError {
  const error = new Error(message) as ApiClientError;
  error.status = status;
  error.code = code;
  return error;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof Error && typeof (error as { status?: unknown }).status === 'number';
}

function notifyApiError(message: string, status?: number): void {
  window.dispatchEvent(new CustomEvent('api:error', { detail: { message, status } }));
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    const message = 'Unable to reach the server. Check your connection and try again.';
    notifyApiError(message);
    const error = createApiError(message, 0, 'NETWORK_ERROR');
    throw error;
  }
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const wsId = getActiveWorkspaceId();
  if (wsId) headers['X-Workspace-Id'] = wsId;
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type ResponseValidator<T> = (value: unknown) => value is T;
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: JsonRecord, key: string): boolean {
  return value[key] === undefined || isString(value[key]);
}

function isOptionalNullableString(value: JsonRecord, key: string): boolean {
  return value[key] === undefined || value[key] === null || isString(value[key]);
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return isString(value) && choices.includes(value as T);
}

function isWorkspace(value: unknown): value is Workspace {
  return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.industry) && isString(value.created_at);
}

function isUser(value: unknown): value is User {
  return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.email) &&
    (value.workspace_id === null || isString(value.workspace_id)) && isOneOf(value.user_type, ['WORKPLACE', 'CUSTOMER'] as const) &&
    (value.phone === undefined || value.phone === null || isString(value.phone));
}

function isCustomerRequest(value: unknown): value is CustomerRequest {
  return isRecord(value) && isNumber(value.id) && isString(value.workspace_id) && isString(value.customer_id) &&
    isString(value.customer_name) && isString(value.customer_email) && (value.customer_phone === null || isString(value.customer_phone)) &&
    isString(value.service_title) && isString(value.description) && isOneOf(value.status, ['NEW', 'QUALIFIED', 'CLOSED'] as const) &&
    (value.preferred_date === null || isString(value.preferred_date)) && (value.work_item_id === null || isNumber(value.work_item_id)) && isString(value.created_at) &&
    isOptionalString(value, 'workspace_name') && isOptionalNullableString(value, 'work_order_scheduled_date') &&
    isOptionalNullableString(value, 'work_order_technician') &&
    (value.work_order_status === undefined || value.work_order_status === null || isOneOf(value.work_order_status, ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const));
}

export function isWorkItem(value: unknown): value is WorkItem {
  return isRecord(value) && isNumber(value.work_item_id) && isNumber(value.request_id) && isString(value.scheduled_date) &&
    isString(value.assigned_technician) && isString(value.description) && isOneOf(value.status, ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) &&
    isString(value.created_by_user_id) && isString(value.created_at) && isOptionalString(value, 'created_by_user_name') &&
    isOptionalString(value, 'customer_name') && isOptionalString(value, 'service_title') &&
    (value.request_status === undefined || isOneOf(value.request_status, ['NEW', 'QUALIFIED', 'CLOSED'] as const));
}

function isActivityEntry(value: unknown): value is ActivityEntry {
  return isRecord(value) && isString(value.id) && isString(value.workspace_id) && isNumber(value.request_id) &&
    isString(value.actor_id) && isOneOf(value.action, ['REQUEST_CREATED', 'STATUS_CHANGED', 'REQUEST_UPDATED', 'CONVERTED_TO_WORK_ITEM', 'NOTE_ADDED'] as const) &&
    isString(value.details) && isString(value.created_at) && isOptionalString(value, 'actor_name') &&
    isOptionalString(value, 'customer_name') && isOptionalString(value, 'service_title');
}

function isAssistantSuggestion(value: unknown): value is AssistantSuggestion {
  return isRecord(value) && isString(value.id) && isOneOf(value.type, ['QUALIFY_REQUEST', 'CONVERT_TO_WORK_ITEM', 'CLOSE_REQUEST', 'SCHEDULE_FOLLOWUP'] as const) &&
    isString(value.title) && isString(value.reasoning) && isString(value.suggestedActionLabel) && isOneOf(value.confidence, ['HIGH', 'MEDIUM'] as const) &&
    (value.targetStatus === undefined || isOneOf(value.targetStatus, ['NEW', 'QUALIFIED', 'CLOSED'] as const)) &&
    isOptionalString(value, 'suggestedScheduledDate');
}

function isWorkspaceStats(value: unknown): value is WorkspaceStats {
  return isRecord(value) && isNumber(value.totalRequests) && isNumber(value.newRequests) && isNumber(value.qualifiedRequests) &&
    isNumber(value.closedRequests) && isNumber(value.workItemsCount);
}

function dataResponse<T>(validator: ResponseValidator<T>): ResponseValidator<{ data: T }> {
  return (value: unknown): value is { data: T } => isRecord(value) && validator(value.data);
}

function dataListResponse<T>(validator: ResponseValidator<T>): ResponseValidator<{ data: T[]; total: number }> {
  return (value: unknown): value is { data: T[]; total: number } => isRecord(value) && Array.isArray(value.data) && value.data.every(validator) && isNumber(value.total);
}

function isAuthSession(value: unknown): value is AuthSession {
  return isRecord(value) && isUser(value.user) && (value.workspace === null || isWorkspace(value.workspace)) &&
    (value.token === undefined || isString(value.token));
}

function isDemoAccount(value: unknown): value is DemoAccount {
  return isRecord(value) && isString(value.email) && isString(value.password) && isString(value.name) &&
    isOneOf(value.user_type, ['WORKPLACE', 'CUSTOMER'] as const) && (value.workspace_name === null || isString(value.workspace_name));
}

function hasMessage<T>(validator: ResponseValidator<T>): ResponseValidator<{ data: T; message: string }> {
  return (value: unknown): value is { data: T; message: string } => dataResponse(validator)(value) && isString(value.message);
}

const isAuthResponse = dataResponse(isAuthSession);
const isDemoAccountsResponse: ResponseValidator<{ data: { workplace: DemoAccount[]; customer: DemoAccount[] } }> =
  (value): value is { data: { workplace: DemoAccount[]; customer: DemoAccount[] } } => isRecord(value) && isRecord(value.data) &&
    Array.isArray(value.data.workplace) && value.data.workplace.every(isDemoAccount) && Array.isArray(value.data.customer) && value.data.customer.every(isDemoAccount);
const isCurrentWorkspaceResponse: ResponseValidator<{ workspace: Workspace; user: User; stats: WorkspaceStats }> =
  (value): value is { workspace: Workspace; user: User; stats: WorkspaceStats } => isRecord(value) && isWorkspace(value.workspace) && isUser(value.user) && isWorkspaceStats(value.stats);
const isAssistantSuggestionsResponse = dataResponse((value: unknown): value is AssistantSuggestionsResponse =>
  isRecord(value) && isNumber(value.request_id) && Array.isArray(value.suggestions) && value.suggestions.every(isAssistantSuggestion) &&
  isNumber(value.rules_evaluated_count) && isString(value.evaluated_at));

async function handleResponse<T>(res: Response, validate: ResponseValidator<T>): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorData: JsonRecord = isRecord(data) ? data : {};
    const errorMsg = typeof errorData.detail === 'string' && errorData.detail.trim()
      ? errorData.detail
      : typeof errorData.message === 'string' && errorData.message.trim()
      ? errorData.message
      : fallbackMessage(res.status);
    if (res.status === 401 && !res.url.endsWith('/api/auth/login')) {
      sessionStorage.setItem(AUTH_NOTICE_KEY, errorMsg);
      clearStoredSession();
      window.dispatchEvent(new Event('auth:unauthorized'));
    } else if (!res.url.endsWith('/api/auth/login') && !res.url.endsWith('/api/auth/demo-accounts')) {
      notifyApiError(errorMsg, res.status);
    }
    const err = createApiError(errorMsg, res.status, isString(errorData.code) ? errorData.code : isString(errorData.error) ? errorData.error : undefined);
    err.details = isStringRecord(errorData.errors) ? errorData.errors : isStringRecord(errorData.details) ? errorData.details : undefined;
    err.raw = errorData;
    throw err;
  }
  if (!validate(data)) {
    const endpoint = res.url ? new URL(res.url).pathname : 'the API';
    const message = `The server returned an invalid response from ${endpoint}. Please try again.`;
    notifyApiError(message, res.status);
    throw createApiError(message, res.status, 'INVALID_SERVER_RESPONSE');
  }
  return data;
}

export const api = {
  // Auth
  async login(payload: LoginPayload) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(res, hasMessage(isAuthSession));
  },

  async getDemoAccounts() {
    const res = await apiFetch('/api/auth/demo-accounts');
    return handleResponse(res, isDemoAccountsResponse);
  },

  async getMe() {
    const res = await apiFetch('/api/auth/me', { headers: getHeaders() });
    return handleResponse(res, isAuthResponse);
  },

  // Workspaces
  async getWorkspaces() {
    const res = await apiFetch('/api/workspaces');
    return handleResponse(res, dataResponse((value: unknown): value is Workspace[] => Array.isArray(value) && value.every(isWorkspace)));
  },

  async getCurrentWorkspace() {
    const res = await apiFetch('/api/workspaces/current', { headers: getHeaders() });
    return handleResponse(res, isCurrentWorkspaceResponse);
  },

  // Requests (Workplace)
  async listRequests(status?: string, search?: string, sort?: string) {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);

    const res = await apiFetch(`/api/requests?${params.toString()}`, { headers: getHeaders() });
    return handleResponse(res, dataListResponse(isCustomerRequest));
  },

  async getRequest(id: number) {
    const res = await apiFetch(`/api/requests/${id}`, { headers: getHeaders() });
    return handleResponse(res, dataResponse(isCustomerRequest));
  },

  async createRequest(payload: CreateRequestPayload) {
    const res = await apiFetch('/api/requests', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res, dataResponse(isCustomerRequest));
  },

  async updateRequest(id: number, payload: UpdateRequestPayload) {
    const res = await apiFetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res, dataResponse(isCustomerRequest));
  },

  // Customer Portal Endpoints
  async getCustomerRequests() {
    const res = await apiFetch('/api/customer/my-requests', { headers: getHeaders() });
    return handleResponse(res, dataListResponse(isCustomerRequest));
  },

  async createCustomerRequest(payload: CreateCustomerRequestPayload) {
    const res = await apiFetch('/api/customer/my-requests', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res, hasMessage(isCustomerRequest));
  },

  // Work Items & Conversion
  async convertToWorkItem(requestId: number, payload: ConversionPayload) {
    const res = await apiFetch(`/api/work-items/convert/${requestId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res, hasMessage((value: unknown): value is { work_item: WorkItem; request: CustomerRequest } =>
      isRecord(value) && isWorkItem(value.work_item) && isCustomerRequest(value.request)));
  },

  // Activity Timeline
  async getActivity(requestId: number) {
    const res = await apiFetch(`/api/activity/requests/${requestId}`, { headers: getHeaders() });
    return handleResponse(res, dataListResponse(isActivityEntry));
  },

  async getActivityFeed() {
    const res = await apiFetch('/api/activity/feed', { headers: getHeaders() });
    return handleResponse(res, dataListResponse(isActivityEntry));
  },

  async addActivityNote(requestId: number, note: string) {
    const res = await apiFetch(`/api/activity/requests/${requestId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ note })
    });
    return handleResponse(res, dataResponse(isActivityEntry));
  },

  // Assistant Suggestions
  async getAssistantSuggestions(requestId: number) {
    const res = await apiFetch(`/api/assistant/requests/${requestId}`, { headers: getHeaders() });
    return handleResponse(res, isAssistantSuggestionsResponse);
  },

};
