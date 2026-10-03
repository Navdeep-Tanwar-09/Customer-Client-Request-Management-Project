import React, { useState, useEffect } from 'react';
import { CustomerRequest, User, Workspace } from '../types.ts';
import { api } from '../api.ts';
import { Plus, Search, Calendar, Building2, Wrench, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface CustomerPortalProps {
  currentUser: User;
  currentWorkspace: Workspace | null;
  onOpenCreateRequest: () => void;
  onOpenActivityFeed: (requestId?: number) => void;
  refreshTrigger?: number;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  currentUser,
  currentWorkspace,
  onOpenCreateRequest,
  onOpenActivityFeed,
  refreshTrigger = 0
}) => {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchCustomerRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCustomerRequests();
      setRequests(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerRequests();
  }, [refreshTrigger]);

  const filteredRequests = requests.filter((req) => {
    const matchesFilter = filterStatus === 'ALL' || req.status === filterStatus;
    const matchesSearch =
      !searchTerm ||
      req.service_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(req.work_item_id || '').includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">NEW</span>;
      case 'QUALIFIED':
        return <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">QUALIFIED</span>;
      case 'CLOSED':
        return <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">CLOSED</span>;
      default:
        return <span className="text-[11px] text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Customer Request Desk
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">
            Welcome, {currentUser.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track status, review scheduled dates, and submit service requests for your facilities.
          </p>
        </div>

        <button
          onClick={onOpenCreateRequest}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-md shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Service Request</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs w-full sm:w-auto">
          {['ALL', 'NEW', 'QUALIFIED', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterStatus === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? 'All' : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your requests..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
            <span>Loading your service requests...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-700">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
            <p>{error}</p>
            <button
              onClick={fetchCustomerRequests}
              className="px-3 py-1 bg-white border border-red-300 rounded text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-800">No requests found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || filterStatus !== 'ALL'
                ? 'No requests match your current search or filter.'
                : 'You have not submitted any service requests yet.'}
            </p>
            <button
              onClick={onOpenCreateRequest}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs transition-colors"
            >
              Create New Request
            </button>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isConverted = Boolean(req.work_item_id);

            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-slate-300 transition-colors space-y-3"
              >
                {/* Status & ID Line */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status)}
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-xs font-semibold text-slate-600 font-mono">
                      {req.id}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-[11px] text-slate-500">
                      Submitted {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Activity button for this request */}
                  <button
                    onClick={() => onOpenActivityFeed(req.id)}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Timeline</span>
                  </button>
                </div>

                {/* Service Title */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {req.service_title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {req.description}
                  </p>
                </div>

                {/* Converted Work Order Notice if converted */}
                {isConverted && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                        Official Work Item: {req.work_item_id}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900">
                        {req.work_order_status || 'SCHEDULED'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-800 pt-1">
                      <div>
                        Scheduled Dispatch Date:{' '}
                        <strong className="font-mono">{req.work_order_scheduled_date}</strong>
                      </div>
                      {req.work_order_technician && (
                        <div>
                          Lead Technician:{' '}
                          <strong>{req.work_order_technician}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata Row */}
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100 flex-wrap">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Assigned Workplace: {req.workspace_name || 'Apex Mechanical & HVAC'}</span>
                  </span>
                  {req.preferred_date && (
                    <>
                      <span className="text-slate-300">&bull;</span>
                      <span className="font-mono flex items-center gap-1 text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Requested Window: {req.preferred_date}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
