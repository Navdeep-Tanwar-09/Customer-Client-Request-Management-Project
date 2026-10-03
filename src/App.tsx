import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CustomerRequest, Workspace, User, AuthSession, WorkspaceStats } from './types.ts';
import {
  api,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  getStoredToken,
  setStoredSession,
  consumeAuthNotice,
  clearStoredSession
} from './api.ts';
import { Header } from './components/Header.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { CustomerPortal } from './components/CustomerPortal.tsx';
import { CustomerRequestModal } from './components/CustomerRequestModal.tsx';
import { GlobalActivityModal } from './components/GlobalActivityModal.tsx';
import { RequestList } from './components/RequestList.tsx';
import { RequestDetail } from './components/RequestDetail.tsx';
import { ConvertModal } from './components/ConvertModal.tsx';
import {
  CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  // Session & Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(getStoredToken()));
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Navigation & View
  const [mobileActivePane, setMobileActivePane] = useState<'list' | 'detail'>('list');

  // Workplace Requests Data
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<CustomerRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null);

  // Modals
  const [isCustomerRequestModalOpen, setIsCustomerRequestModalOpen] = useState(false);
  const [customerRefreshTrigger, setCustomerRefreshTrigger] = useState(0);
  const [isGlobalActivityOpen, setIsGlobalActivityOpen] = useState(false);
  const [activitySelectedRequestId, setActivitySelectedRequestId] = useState<number | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Notification Banner
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const onApiError = (event: Event) => {
      const { message, status } = (event as CustomEvent<{ message?: string; status?: number }>).detail || {};
      if (status !== 401 && message) {
        setBannerMessage({ type: 'error', text: message });
      }
    };
    window.addEventListener('api:error', onApiError);
    return () => window.removeEventListener('api:error', onApiError);
  }, []);

  // Restore a session only after the server confirms the saved seven-day JWT is valid.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      clearStoredSession();
      setIsCheckingSession(false);
      return;
    }
    api.getMe()
      .then(({ data }) => {
        setCurrentUser(data.user);
        setCurrentWorkspace(data.workspace);
        setStoredSession(data.user, data.workspace, token);
      })
      .catch(() => clearStoredSession())
      .finally(() => setIsCheckingSession(false));
  }, []);

  // Load session & workspaces
  const loadWorkspaceContext = useCallback(async () => {
    try {
      const wsRes = await api.getWorkspaces();
      const wsList = wsRes.data || [];
      setWorkspaces(wsList);

      if (currentUser?.user_type === 'WORKPLACE' && currentUser.workspace_id) {
        setActiveWorkspaceId(currentUser.workspace_id);
        const currentRes = await api.getCurrentWorkspace();
        setCurrentWorkspace(currentRes.workspace);
        setWorkspaceStats(currentRes.stats);
      } else if (currentUser?.workspace_id) {
        const matched = wsList.find((w) => w.id === currentUser.workspace_id);
        if (matched) setCurrentWorkspace(matched);
      }
    } catch (err: unknown) {
      console.error('Failed to load workspace context:', err);
      setBannerMessage({
        type: 'error',
        text: err.message || 'Failed to load workspace information. Please refresh the page and try again.'
      });
    }
  }, [currentUser]);

  // Fetch requests for Workplace users
  const fetchRequests = useCallback(async (preserveSelectedId?: number) => {
    if (!currentUser || currentUser.user_type !== 'WORKPLACE') return;
    try {
      setIsLoadingRequests(true);
      setRequestsError(null);
      const res = await api.listRequests(statusFilter, searchTerm, sortBy);
      setRequests(res.data);

      if (res.data.length > 0) {
        if (preserveSelectedId) {
          const matched = res.data.find((r) => r.id === preserveSelectedId);
          setSelectedRequest(matched || res.data[0]);
        } else if (!selectedRequest || !res.data.some((r) => r.id === selectedRequest.id)) {
          setSelectedRequest(res.data[0]);
        }
      } else {
        setSelectedRequest(null);
      }
    } catch (err: unknown) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to fetch customer requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [currentUser, statusFilter, searchTerm, sortBy, selectedRequest]);

  useEffect(() => {
    if (currentUser) {
      loadWorkspaceContext();
    }
  }, [currentUser, loadWorkspaceContext]);

  useEffect(() => {
    if (currentUser?.user_type === 'WORKPLACE' && currentWorkspace) {
      fetchRequests();
    }
  }, [currentUser, currentWorkspace?.id, statusFilter, searchTerm, sortBy]);

  // Login handler
  const handleLoginSuccess = (session: AuthSession) => {
    setCurrentUser(session.user);
    setCurrentWorkspace(session.workspace);
    if (session.token) setStoredSession(session.user, session.workspace, session.token);
    if (session.user.workspace_id) {
      setActiveWorkspaceId(session.user.workspace_id);
    } else if (session.workspace) {
      setActiveWorkspaceId(session.workspace.id);
    }
    setBannerMessage({
      type: 'success',
      text: `Welcome back, ${session.user.name}! Signed in as ${session.user.user_type === 'WORKPLACE' ? 'Workplace Member' : 'Customer Client'}.`
    });
    navigate(session.user.user_type === 'CUSTOMER' ? '/customer' : '/client-request-desk', { replace: true });
  };

  // Logout handler
  const handleLogout = () => {
    clearStoredSession();
    setCurrentUser(null);
    setCurrentWorkspace(null);
    setRequests([]);
    setSelectedRequest(null);
    setBannerMessage(null);
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [handleLogout]);

  // Open timeline modal from header or card
  const handleOpenActivityModal = (requestId?: number) => {
    setActivitySelectedRequestId(requestId || null);
    setIsGlobalActivityOpen(true);
  };

  const homePath = currentUser?.user_type === 'CUSTOMER' ? '/customer' : '/client-request-desk';

  if (isCheckingSession) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Checking your session…</div>;
  }

  // Login is the only public page. All other URLs redirect unauthenticated visitors here.
  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} initialError={consumeAuthNotice()} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isCustomer = currentUser.user_type === 'CUSTOMER';

  // Keep each role on its own production URL, including on direct visits or refreshes.
  if (location.pathname === '/' || location.pathname === '/login') {
    return <Navigate to={homePath} replace />;
  }
  if (isCustomer && location.pathname !== '/customer') {
    return <Navigate to="/customer" replace />;
  }
  if (!isCustomer && location.pathname !== '/client-request-desk') {
    return <Navigate to="/client-request-desk" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Header with Activity Button and Role Badge */}
      <Header
        currentWorkspace={currentWorkspace}
        currentUser={currentUser}
        onOpenNewRequest={() => {
          if (isCustomer) {
            setIsCustomerRequestModalOpen(true);
          }
        }}
        onOpenActivityModal={() => handleOpenActivityModal()}
        onLogout={handleLogout}
      />

      {/* Global Status Banner */}
      {bannerMessage && (
        <div className={`px-4 py-2.5 text-xs border-b flex items-center justify-between ${
          bannerMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : bannerMessage.type === 'error'
            ? 'bg-red-50 text-red-900 border-red-200'
            : 'bg-blue-50 text-blue-900 border-blue-200'
        }`}>
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : bannerMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span className="font-medium">{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-slate-500 hover:text-slate-800 ml-4 font-semibold text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main View: Customer View vs Workplace View */}
      {isCustomer ? (
        /* CUSTOMER VIEW: Can only create requests and see status of requests + activity timeline */
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <CustomerPortal
            currentUser={currentUser}
            currentWorkspace={currentWorkspace}
            onOpenCreateRequest={() => setIsCustomerRequestModalOpen(true)}
            onOpenActivityFeed={(reqId) => handleOpenActivityModal(reqId)}
            refreshTrigger={customerRefreshTrigger}
          />
        </main>
      ) : (
        /* WORKPLACE USER VIEW: Full Dispatch Desk with Status Filters, Work Orders, and Isolation Controls */
        <>
          {/* Workspace KPI Metrics Strip */}
          <div className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 lg:px-8 shadow-2xs">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Workspace Desk
                </span>
                <span className="text-xs text-slate-300">&bull;</span>
                <span className="text-xs font-bold text-slate-900">{currentWorkspace?.name}</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">({currentWorkspace?.industry})</span>
              </div>

              <div className="flex items-center gap-3 sm:gap-6 text-xs divide-x divide-slate-200">
                <div className="flex items-center gap-1.5 pl-3 first:pl-0">
                  <span className="text-slate-500">Total:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {workspaceStats?.totalRequests ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-3">
                  <span className="text-blue-600 font-medium">New:</span>
                  <span className="font-mono font-bold text-blue-700 tabular-nums">
                    {workspaceStats?.newRequests ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-3">
                  <span className="text-emerald-600 font-medium">Qualified:</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {workspaceStats?.qualifiedRequests ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-3">
                  <span className="text-slate-500">Closed:</span>
                  <span className="font-mono font-bold text-slate-600 tabular-nums">
                    {workspaceStats?.closedRequests ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            <div className="h-[calc(100vh-14rem)] min-h-[550px]">
              {/* Mobile View Toggle */}
              <div className="md:hidden mb-3 flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                <button
                  onClick={() => setMobileActivePane('list')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${
                    mobileActivePane === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  Requests List ({requests.length})
                </button>
                <button
                  onClick={() => setMobileActivePane('detail')}
                  disabled={!selectedRequest}
                  className={`px-3 py-1 text-xs font-semibold rounded ${
                    mobileActivePane === 'detail' ? 'bg-slate-900 text-white' : 'text-slate-600 disabled:opacity-40'
                  }`}
                >
                  Request Details
                </button>
              </div>

              {/* Desktop 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">
                <div className={`md:col-span-5 h-full ${mobileActivePane === 'detail' ? 'hidden md:block' : 'block'}`}>
                  <RequestList
                    requests={requests}
                    selectedRequestId={selectedRequest?.id || null}
                    onSelectRequest={(req) => {
                      setSelectedRequest(req);
                      setMobileActivePane('detail');
                    }}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    isLoading={isLoadingRequests}
                    error={requestsError}
                    onRetry={() => fetchRequests()}
                  />
                </div>

                <div className={`md:col-span-7 h-full ${mobileActivePane === 'list' ? 'hidden md:block' : 'block'}`}>
                  <RequestDetail
                    request={selectedRequest}
                    onOpenCreateWork={() => setIsConvertModalOpen(true)}
                    onRequestUpdated={(updated) => {
                      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                      setSelectedRequest(updated);
                      api.getCurrentWorkspace()
                        .then((res) => setWorkspaceStats(res.stats))
                        .catch(() => {});
                    }}
                  />
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* Customer Request Creation Modal */}
      {isCustomer && (
        <CustomerRequestModal
          isOpen={isCustomerRequestModalOpen}
          onClose={() => setIsCustomerRequestModalOpen(false)}
          currentUser={currentUser}
          onSuccess={(newReq) => {
            setCustomerRefreshTrigger((prev) => prev + 1);
            setBannerMessage({
              type: 'success',
              text: `Your service request "${newReq.service_title}" has been submitted successfully.`
            });
          }}
        />
      )}

      {/* Activity Timeline Modal (Accessible via Header for BOTH Workplace and Customer) */}
      <GlobalActivityModal
        isOpen={isGlobalActivityOpen}
        onClose={() => {
          setIsGlobalActivityOpen(false);
          setActivitySelectedRequestId(null);
        }}
        userRole={currentUser.user_type}
        initialRequestId={activitySelectedRequestId}
      />

      <ConvertModal
        request={selectedRequest}
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        onConverted={(_workItem, updatedRequest) => {
          setRequests((prev) => prev.map((request) => (
            request.id === updatedRequest.id ? updatedRequest : request
          )));
          setSelectedRequest(updatedRequest);
          setIsConvertModalOpen(false);
          api.getCurrentWorkspace()
            .then((res) => setWorkspaceStats(res.stats))
            .catch(() => {});
          setBannerMessage({
            type: 'success',
            text: `Work item created for "${updatedRequest.service_title}".`
          });
        }}
      />
    </div>
  );
}
