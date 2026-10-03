import React, { useState, useEffect } from 'react';
import { api } from '../api.ts';
import { ActivityEntry } from '../types.ts';
import { Clock, X, RefreshCw, Wrench, FileText, CheckCircle2, MessageSquare, ArrowRight, User } from 'lucide-react';

interface GlobalActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'WORKPLACE' | 'CUSTOMER';
  initialRequestId?: number | null;
}

export const GlobalActivityModal: React.FC<GlobalActivityModalProps> = ({
  isOpen,
  onClose,
  userRole,
  initialRequestId
}) => {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>(initialRequestId?.toString() || '');

  const loadFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getActivityFeed();
      setActivities(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFeed();
      if (initialRequestId) {
        setSearchQuery(initialRequestId.toString());
      }
    }
  }, [isOpen, initialRequestId]);

  if (!isOpen) return null;

  const parseDetails = (rawJson: string) => {
    try {
      return JSON.parse(rawJson);
    } catch {
      return { note: rawJson };
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CONVERTED_TO_WORK_ITEM':
        return {
          icon: <Wrench className="w-3.5 h-3.5 text-emerald-600" />,
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: 'Converted to Work Order'
        };
      case 'STATUS_CHANGED':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-600" />,
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          label: 'Status Transition'
        };
      case 'REQUEST_CREATED':
        return {
          icon: <FileText className="w-3.5 h-3.5 text-blue-600" />,
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          label: 'Request Created'
        };
      case 'NOTE_ADDED':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-purple-600" />,
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          label: 'Dispatch Note'
        };
      default:
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />,
          bg: 'bg-slate-50 text-slate-800 border-slate-200',
          label: 'Updated'
        };
    }
  };

  const filteredActivities = activities.filter((act) => {
    const matchesAction = filterAction === 'ALL' || act.action === filterAction;
    const matchesSearch =
      !searchQuery ||
      String(act.request_id || '').includes(searchQuery) ||
      act.service_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.actor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.details?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Request Action & Activity Timeline
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Chronological log of all actions performed, timestamps, and performing actors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFeed}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Refresh timeline"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg">
            {['ALL', 'REQUEST_CREATED', 'STATUS_CHANGED', 'CONVERTED_TO_WORK_ITEM'].map((act) => (
              <button
                key={act}
                onClick={() => setFilterAction(act)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  filterAction === act
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {act === 'ALL'
                  ? 'All Actions'
                  : act === 'REQUEST_CREATED'
                  ? 'Requests Created'
                  : act === 'STATUS_CHANGED'
                  ? 'Status'
                  : act === 'CONVERTED_TO_WORK_ITEM'
                  ? 'Work Orders'
                  : act}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search request or actor..."
              className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
              <span>Loading activity trail...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 text-center">
              {error}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No activity events found</p>
              <p className="text-[11px] text-slate-500">
                Actions performed on requests will be recorded here automatically.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {filteredActivities.map((act) => {
                const badge = getActionBadge(act.action);
                const details = parseDetails(act.details);
                const actorDisplayName =
                  act.action === 'REQUEST_CREATED'
                    ? act.customer_name || details.customerName || act.actor_name
                    : act.actor_name;

                return (
                  <div key={act.id} className="relative text-xs">
                    {/* Node */}
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border border-slate-300 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3.5 space-y-2 hover:bg-slate-50 transition-colors">
                      {/* Top Bar: Action, Actor, Time */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${badge.bg}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                          <span className="text-slate-300 hidden sm:inline">&bull;</span>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 shadow-2xs text-xs">
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-slate-600 font-medium">action done by :</span>
                            <strong className="font-semibold text-slate-900">{actorDisplayName}</strong>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-slate-500" title={act.created_at}>
                          {new Date(act.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Request Context */}
                      <div className="text-[11px] text-slate-600 flex items-center gap-2 pt-1 border-t border-slate-200/60">
                        <span className="font-mono font-bold text-slate-700">{act.request_id}</span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="font-semibold text-slate-900 truncate max-w-sm">
                          {act.service_title || 'Customer Service Request'}
                        </span>
                      </div>

                      {/* Detail Specifics */}
                      {act.action === 'CONVERTED_TO_WORK_ITEM' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-[11px] text-emerald-900 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-emerald-700" />
                            <span>Work Item: {details.workItemId || details.workOrderNumber}</span>
                          </div>
                          <div className="text-emerald-800">
                            Scheduled Date: <strong className="font-mono">{details.scheduledDate}</strong>
                            {details.assignedTechnician && ` • Assigned to: ${details.assignedTechnician}`}
                          </div>
                        </div>
                      )}

                      {act.action === 'STATUS_CHANGED' && (
                        <div className="text-[11px] flex items-center gap-1.5 font-mono">
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-medium">{details.oldStatus}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">{details.newStatus}</span>
                          {details.note && <span className="font-sans text-slate-600 ml-2 font-normal">({details.note})</span>}
                        </div>
                      )}

                      {act.action === 'REQUEST_CREATED' && (
                        <p className="text-[11px] text-slate-600">
                          {details.note || 'Initial service request registered.'}
                        </p>
                      )}

                      {act.action === 'NOTE_ADDED' && (
                        <p className="text-[11px] text-slate-800 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap">
                          {details.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>{filteredActivities.length} actions logged</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
