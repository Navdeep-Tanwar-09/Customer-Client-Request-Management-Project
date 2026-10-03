export type RequestStatus = 'NEW' | 'QUALIFIED' | 'CLOSED';
export type WorkItemStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type UserType = 'WORKPLACE' | 'CUSTOMER';

export interface Workspace {
  id: string;
  name: string;
  industry: string;
  created_at: string;
}

export interface User {
  id: string;
  workspace_id: string | null;
  name: string;
  email: string;
  user_type: UserType;
  phone?: string | null;
}

export interface AuthSession {
  user: User;
  workspace: Workspace | null;
  token?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  role: UserType;
}

export interface CreateRequestPayload {
  customer_id: string;
  service_title: string;
  description: string;
  preferred_date?: string | null;
  status?: 'NEW';
}

export interface UpdateRequestPayload {
  service_title?: string;
  description?: string;
  preferred_date?: string | null;
  status?: RequestStatus;
  activity_note?: string;
}

export interface CreateCustomerRequestPayload {
  workspace_id: string;
  service_title: string;
  description: string;
  preferred_date?: string | null;
  customer_phone?: string;
}

export interface CustomerRequest {
  id: number;
  workspace_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  service_title: string;
  description: string;
  status: RequestStatus;
  preferred_date: string | null;
  work_item_id: number | null;
  created_at: string;
  workspace_name?: string;
  work_order_scheduled_date?: string | null;
  work_order_technician?: string | null;
  work_order_status?: WorkItemStatus | null;
}

export interface WorkItem {
  work_item_id: number;
  request_id: number;
  scheduled_date: string;
  assigned_technician: string;
  description: string;
  status: WorkItemStatus;
  created_by_user_id: string;
  created_by_user_name?: string;
  created_at: string;
  customer_name?: string;
  service_title?: string;
  request_status?: RequestStatus;
}

export interface WorkspaceStats {
  totalRequests: number;
  newRequests: number;
  qualifiedRequests: number;
  closedRequests: number;
  workItemsCount: number;
}

export interface ActivityEntry {
  id: string;
  workspace_id: string;
  request_id: number;
  actor_id: string;
  action: 'REQUEST_CREATED' | 'STATUS_CHANGED' | 'REQUEST_UPDATED' | 'CONVERTED_TO_WORK_ITEM' | 'NOTE_ADDED';
  details: string; // JSON string
  created_at: string;
  // Derived by API joins; these are not stored in activity_log.
  actor_name?: string;
  customer_name?: string;
  service_title?: string;
}

export interface ConversionPayload {
  scheduled_date: string;
  assigned_technician?: string;
  notes?: string;
}

export interface AssistantSuggestion {
  id: string;
  type: 'QUALIFY_REQUEST' | 'CONVERT_TO_WORK_ITEM' | 'CLOSE_REQUEST' | 'SCHEDULE_FOLLOWUP';
  title: string;
  reasoning: string;
  suggestedActionLabel: string;
  targetStatus?: RequestStatus;
  suggestedScheduledDate?: string;
  confidence: 'HIGH' | 'MEDIUM';
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string>;
}

export interface DemoAccount {
  email: string;
  password: string;
  name: string;
  user_type: UserType;
  workspace_name: string | null;
}

export interface AssistantSuggestionsResponse {
  request_id: number;
  suggestions: AssistantSuggestion[];
  rules_evaluated_count: number;
  evaluated_at: string;
}
