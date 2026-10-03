import { strict as assert } from 'node:assert';
import { env, exit } from 'node:process';

interface ApiResult {
  status: number;
  contentType: string;
  body: unknown;
}

interface DemoAccount {
  email: string;
  password: string;
  user_type: 'WORKPLACE' | 'CUSTOMER';
}

interface Session {
  token: string;
  userId: string;
  workspaceId: string | null;
}

interface TestCase {
  name: string;
  run: () => Promise<void>;
}

const baseUrl = (env.API_BASE_URL || `http://localhost:${env.PORT || '3000'}`).replace(/\/$/, '');

function record(value: unknown, label: string): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  return value;
}

async function callApi(
  path: string,
  options: {
    method?: string;
    token?: string;
    workspaceId?: string;
    json?: unknown;
    rawBody?: string;
    contentType?: string;
  } = {},
): Promise<ApiResult> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.workspaceId) headers.set('X-Workspace-Id', options.workspaceId);
  if (options.json !== undefined) {
    headers.set('Content-Type', options.contentType || 'application/json');
  } else if (options.contentType) {
    headers.set('Content-Type', options.contentType);
  }

  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: options.method || 'GET',
    headers,
    ...(options.json !== undefined ? { body: JSON.stringify(options.json) } : {}),
    ...(options.rawBody !== undefined ? { body: options.rawBody } : {}),
  });
  const body = await response.json().catch(() => null) as unknown;
  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    body,
  };
}

function expectStatus(result: ApiResult, status: number): void {
  assert.equal(result.status, status, `Expected HTTP ${status}, received ${result.status}: ${JSON.stringify(result.body)}`);
}

function expectProblem(result: ApiResult, status: number): void {
  expectStatus(result, status);
  assert.match(result.contentType, /application\/problem\+json/i, 'Error response must use Problem Details JSON');
  assert.equal(record(result.body, 'Problem response').status, status, 'Problem response status must match HTTP status');
}

function getSession(body: unknown): Session {
  const payload = record(body, 'Login response');
  const data = record(payload.data, 'Login data');
  const user = record(data.user, 'Login user');
  assert.equal(typeof data.token, 'string', 'Login response must include a token');
  assert.equal(typeof user.id, 'string', 'Login response must include a user ID');
  return {
    token: data.token as string,
    userId: user.id as string,
    workspaceId: typeof user.workspace_id === 'string' ? user.workspace_id : null,
  };
}

async function login(account: DemoAccount): Promise<Session> {
  const result = await callApi('/api/auth/login', {
    method: 'POST',
    json: { email: account.email, password: account.password, role: account.user_type },
  });
  expectStatus(result, 200);
  return getSession(result.body);
}

async function run(): Promise<void> {
  console.log(`API safety checks: ${baseUrl}`);

  const workspacesResult = await callApi('/api/workspaces');
  expectStatus(workspacesResult, 200);
  const workspaces = array(record(workspacesResult.body, 'Workspace response').data, 'Workspace data');
  assert.ok(workspaces.length > 0, 'At least one workspace must be available');
  for (const item of workspaces) {
    const workspace = record(item, 'Workspace');
    assert.equal(typeof workspace.id, 'string');
    assert.equal(typeof workspace.created_at, 'string');
  }

  const demoResult = await callApi('/api/auth/demo-accounts');
  expectStatus(demoResult, 200);
  const demoData = record(record(demoResult.body, 'Demo account response').data, 'Demo account data');
  const workplaceAccounts = array(demoData.workplace, 'Workplace demo accounts') as DemoAccount[];
  const customerAccounts = array(demoData.customer, 'Customer demo accounts') as DemoAccount[];
  assert.ok(workplaceAccounts.length > 0, 'At least one workplace test account is required');
  assert.ok(customerAccounts.length > 0, 'At least one customer test account is required');

  const workplaceSessions: Array<{ account: DemoAccount; session: Session }> = [];
  const seenWorkspaces = new Set<string>();
  for (const account of workplaceAccounts) {
    const session = await login(account);
    if (session.workspaceId && !seenWorkspaces.has(session.workspaceId)) {
      seenWorkspaces.add(session.workspaceId);
      workplaceSessions.push({ account, session });
    }
    if (workplaceSessions.length >= 2) break;
  }
  const customerSession = await login(customerAccounts[0]);
  const workplace = workplaceSessions[0];
  assert.ok(workplace, 'A workplace login is required');
  assert.ok(workplace.session.workspaceId, 'Workplace user must belong to a workspace');

  const headersFor = (session: Session) => ({ token: session.token, workspaceId: session.workspaceId || undefined });
  const requestList = await callApi('/api/requests', headersFor(workplace.session));
  expectStatus(requestList, 200);
  const initialRequests = array(record(requestList.body, 'Request-list response').data, 'Request data');
  const firstRequest = initialRequests[0] ? record(initialRequests[0], 'Request') : null;
  if (firstRequest) assert.equal(typeof firstRequest.id, 'number');

  const cases: TestCase[] = [
    {
      name: 'workplace session and workspace stats',
      run: async () => {
        const [me, current] = await Promise.all([
          callApi('/api/auth/me', headersFor(workplace.session)),
          callApi('/api/workspaces/current', headersFor(workplace.session)),
        ]);
        expectStatus(me, 200);
        expectStatus(current, 200);
        assert.ok(record(record(current.body, 'Current workspace').stats, 'Workspace stats'));
      },
    },
    {
      name: 'customer session and request listing',
      run: async () => {
        const result = await callApi('/api/customer/my-requests', {
          token: customerSession.token,
          workspaceId: 'ws_apex',
        });
        expectStatus(result, 200);
        assert.ok(Array.isArray(record(result.body, 'Customer request response').data));
      },
    },
    {
      name: 'activity feed and assistant read routes',
      run: async () => {
        const feed = await callApi('/api/activity/feed', headersFor(workplace.session));
        expectStatus(feed, 200);
        assert.ok(Array.isArray(record(feed.body, 'Activity feed').data));
        if (firstRequest) {
          const [activity, assistant] = await Promise.all([
            callApi(`/api/activity/requests/${firstRequest.id}`, headersFor(workplace.session)),
            callApi(`/api/assistant/requests/${firstRequest.id}`, headersFor(workplace.session)),
          ]);
          expectStatus(activity, 200);
          expectStatus(assistant, 200);
          assert.ok(Array.isArray(record(activity.body, 'Request activity').data));
          assert.ok(Array.isArray(record(record(assistant.body, 'Assistant response').data, 'Assistant data').suggestions));
        }
      },
    },
    {
      name: 'unauthenticated, wrong-role, and workspace-mismatch access is rejected',
      run: async () => {
        expectProblem(await callApi('/api/requests'), 401);
        const roleMismatch = await callApi('/api/auth/login', {
          method: 'POST',
          json: {
            email: workplace.account.email,
            password: workplace.account.password,
            role: 'CUSTOMER',
          },
        });
        expectProblem(roleMismatch, 403);
        expectProblem(await callApi('/api/requests', {
          token: customerSession.token,
          workspaceId: 'ws_apex',
        }), 403);
        expectProblem(await callApi('/api/requests', {
          token: workplace.session.token,
          workspaceId: 'ws_not_owned',
        }), 403);
        const invalidToken = await callApi('/api/auth/me', { token: 'invalid.token.value' });
        expectProblem(invalidToken, 401);
      },
    },
    {
      name: 'cross-workspace request details are hidden',
      run: async () => {
        if (workplaceSessions.length < 2) return;
        const other = workplaceSessions[1];
        const otherList = await callApi('/api/requests', headersFor(other.session));
        expectStatus(otherList, 200);
        const otherRequests = array(record(otherList.body, 'Other workspace requests').data, 'Other request data');
        if (otherRequests.length === 0) return;
        const id = record(otherRequests[0], 'Other workspace request').id;
        expectProblem(await callApi(`/api/requests/${id}`, headersFor(workplace.session)), 404);
      },
    },
    {
      name: 'invalid query parameters are rejected',
      run: async () => {
        expectProblem(await callApi('/api/requests?status=INVALID', headersFor(workplace.session)), 422);
        expectProblem(await callApi('/api/requests?sort=INVALID', headersFor(workplace.session)), 422);
        expectProblem(await callApi('/api/requests?status=NEW&status=CLOSED', headersFor(workplace.session)), 422);
      },
    },
    {
      name: 'malformed JSON and unsupported media type return structured errors',
      run: async () => {
        expectProblem(await callApi('/api/auth/login', {
          method: 'POST',
          rawBody: '{',
          contentType: 'application/json',
        }), 400);
        expectProblem(await callApi('/api/auth/login', {
          method: 'POST',
          rawBody: '{}',
          contentType: 'text/plain',
        }), 415);
      },
    },
    {
      name: 'request creation rejects status, date, and object fields without inserting',
      run: async () => {
        const before = array(record((await callApi('/api/requests', headersFor(workplace.session))).body, 'Requests before').data, 'Requests before data').length;
        const invalidBodies = [
          { customer_id: customerSession.userId, service_title: 'Valid title', description: 'Valid description', status: 'QUALIFIED' },
          { customer_id: customerSession.userId, service_title: 'Valid title', description: 'Valid description', preferred_date: '2026-02-30' },
          { customer_id: customerSession.userId, service_title: { invalid: true }, description: 'Valid description' },
        ];
        for (const body of invalidBodies) {
          expectProblem(await callApi('/api/requests', { ...headersFor(workplace.session), method: 'POST', json: body }), 422);
        }
        const after = array(record((await callApi('/api/requests', headersFor(workplace.session))).body, 'Requests after').data, 'Requests after data').length;
        assert.equal(after, before, 'Rejected creates must not add requests');
      },
    },
    {
      name: 'request updates reject invalid types and dates without mutation',
      run: async () => {
        if (!firstRequest) return;
        const before = await callApi(`/api/requests/${firstRequest.id}`, headersFor(workplace.session));
        expectStatus(before, 200);
        const original = record(record(before.body, 'Request detail').data, 'Request data');
        expectProblem(await callApi(`/api/requests/${firstRequest.id}`, {
          ...headersFor(workplace.session),
          method: 'PATCH',
          json: { service_title: { invalid: true } },
        }), 422);
        expectProblem(await callApi(`/api/requests/${firstRequest.id}`, {
          ...headersFor(workplace.session),
          method: 'PATCH',
          json: { preferred_date: 'not-a-date' },
        }), 422);
        const after = await callApi(`/api/requests/${firstRequest.id}`, headersFor(workplace.session));
        const current = record(record(after.body, 'Request after update').data, 'Request data after update');
        assert.equal(current.service_title, original.service_title, 'Rejected updates must not change request fields');
      },
    },
    {
      name: 'customer creation rejects invalid dates without inserting',
      run: async () => {
        const headers = { token: customerSession.token, workspaceId: 'ws_apex' };
        const before = array(record((await callApi('/api/customer/my-requests', headers)).body, 'Customer requests before').data, 'Customer requests before data').length;
        expectProblem(await callApi('/api/customer/my-requests', {
          ...headers,
          method: 'POST',
          json: { workspace_id: 'ws_apex', service_title: 'Valid title', description: 'Valid description', preferred_date: '2026-02-30' },
        }), 422);
        const after = array(record((await callApi('/api/customer/my-requests', headers)).body, 'Customer requests after').data, 'Customer requests after data').length;
        assert.equal(after, before, 'Rejected customer requests must not be inserted');
      },
    },
    {
      name: 'conversion rejects invalid dates without creating a work item',
      run: async () => {
        let candidate: { session: Session; id: number } | undefined;
        for (const item of workplaceSessions) {
          const result = await callApi('/api/requests?status=QUALIFIED', headersFor(item.session));
          expectStatus(result, 200);
          const rows = array(record(result.body, 'Qualified requests').data, 'Qualified request data');
          const request = rows.map((row) => record(row, 'Qualified request')).find((row) => row.work_item_id === null);
          if (request && typeof request.id === 'number') {
            candidate = { session: item.session, id: request.id };
            break;
          }
        }
        if (!candidate) return;
        const headers = headersFor(candidate.session);
        expectProblem(await callApi(`/api/work-items/convert/${candidate.id}`, {
          ...headers,
          method: 'POST',
          json: { scheduled_date: '2026-02-30' },
        }), 422);
        const detail = await callApi(`/api/requests/${candidate.id}`, headers);
        const request = record(record(detail.body, 'Request after rejected conversion').data, 'Request data');
        assert.equal(request.work_item_id, null, 'Rejected conversion must not attach a work item');
      },
    },
    {
      name: 'activity notes reject non-object and oversized payloads without insertion',
      run: async () => {
        if (!firstRequest) return;
        const path = `/api/activity/requests/${firstRequest.id}`;
        const before = array(record((await callApi(path, headersFor(workplace.session))).body, 'Activity before').data, 'Activity before data').length;
        expectProblem(await callApi(path, { ...headersFor(workplace.session), method: 'POST', json: [] }), 422);
        expectProblem(await callApi(path, { ...headersFor(workplace.session), method: 'POST', json: { note: 'x'.repeat(2001) } }), 422);
        const after = array(record((await callApi(path, headersFor(workplace.session))).body, 'Activity after').data, 'Activity after data').length;
        assert.equal(after, before, 'Rejected activity notes must not be inserted');
      },
    },
    {
      name: 'test/reset route is not exposed and unknown methods are structured',
      run: async () => {
        for (const path of ['/api/test/run', '/api/test/reset', '/api/test/reset-seed']) {
          expectProblem(await callApi(path, { method: 'GET' }), 404);
          expectProblem(await callApi(path, { method: 'POST' }), 404);
        }
        const wrongMethod = await callApi('/api/workspaces', { method: 'POST' });
        expectProblem(wrongMethod, 405);
        assert.match(wrongMethod.contentType, /application\/problem\+json/i);
      },
    },
  ];

  let failures = 0;
  for (const test of cases) {
    try {
      await test.run();
      console.log(`[PASS] ${test.name}`);
    } catch (error) {
      failures++;
      console.error(`[FAIL] ${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${cases.length - failures}/${cases.length} API checks passed.`);
  if (failures > 0) exit(1);
}

run().catch((error: unknown) => {
  console.error(`API test setup failed: ${error instanceof Error ? error.message : String(error)}`);
  exit(1);
});