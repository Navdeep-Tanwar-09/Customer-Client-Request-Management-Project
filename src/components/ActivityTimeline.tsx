import React, { useState, useEffect } from 'react';
import { ActivityEntry } from '../types.ts';
import { api } from '../api.ts';
import { Clock, Wrench, RefreshCw, FileText, CheckCircle2, MessageSquare, ArrowRight, User } from 'lucide-react';

interface ActivityTimelineProps {
  requestId: number;
  customerName?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ requestId, customerName }) => {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getActivity(requestId);
      setActivities(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      fetchActivities();
    }
  }, [requestId]);

  // Helper to parse activity JSON details safely
  const parseDetails = (rawJson: string) => {
    try {
      return JSON.parse(rawJson);
    } catch {
      return { note: rawJson };
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: ActivityEntry['action']) => {
    switch (action) {
      case 'CONVERTED_TO_WORK_ITEM':
        return {
          icon: <Wrench className="w-3.5 h-3.5 text-emerald-600" />,
          bg: 'bg-emerald-100 border-emerald-200 text-emerald-800',
          label: 'Converted to Work Item'
        };
      case 'STATUS_CHANGED':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-600" />,
          bg: 'bg-amber-100 border-amber-200 text-amber-800',
          label: 'Status Transition'
        };
      case 'REQUEST_CREATED':
        return {
          icon: <FileText className="w-3.5 h-3.5 text-blue-600" />,
          bg: 'bg-blue-100 border-blue-200 text-blue-800',
          label: 'Request Created'
        };
      case 'NOTE_ADDED':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-purple-600" />,
          bg: 'bg-purple-100 border-purple-200 text-purple-800',
          label: 'Dispatch Note'
        };
      case 'REQUEST_UPDATED':
      default:
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />,
          bg: 'bg-slate-100 border-slate-200 text-slate-800',
          label: 'Request Updated'
        };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Audit Timeline & Activity
        </h4>
        <span className="text-[11px] text-slate-500 font-mono">
          {activities.length} {activities.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Activity Entries List */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex space-x-3">
              <div className="w-2.5 h-2.5 bg-slate-200 rounded-full mt-1.5"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                <div className="h-2 bg-slate-100 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-xs text-red-600 bg-red-50 p-3 rounded border border-red-200">
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">
          No activity logs recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {activities.map((item) => {
            const meta = getActionBadge(item.action);
            const details = parseDetails(item.details);
            const actorDisplayName =
              item.action === 'REQUEST_CREATED'
                ? item.customer_name || customerName || details.customerName || item.actor_name
                : item.actor_name;

            return (
              <div key={item.id} className="relative text-xs group">
                {/* Timeline node */}
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white border border-slate-300 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                </div>

                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-3 space-y-1.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${meta.bg}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      <span className="text-slate-300 hidden sm:inline">&bull;</span>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 shadow-2xs text-xs">
                        <User className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-slate-600 font-medium">action done by :</span>
                        <strong className="font-semibold text-slate-900">{actorDisplayName}</strong>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono" title={item.created_at}>
                      {formatTimestamp(item.created_at)}
                    </span>
                  </div>

                  {/* Render action-specific details */}
                  {item.action === 'CONVERTED_TO_WORK_ITEM' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-900 text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Work Item Generated: {details.workItemId || details.workOrderNumber}</span>
                      </div>
                      <div className="text-[11px] text-emerald-800 grid grid-cols-2 gap-1 pt-1 border-t border-emerald-200">
                        <div>
                          <span className="text-emerald-700">Scheduled:</span>{' '}
                          <span className="font-medium font-mono">{details.scheduledDate}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700">Technician:</span>{' '}
                          <span className="font-medium">{details.assignedTechnician}</span>
                        </div>
                      </div>
                      {details.notes && (
                        <p className="text-[11px] text-emerald-800 italic mt-1">"{details.notes}"</p>
                      )}
                    </div>
                  )}

                  {item.action === 'STATUS_CHANGED' && (
                    <div className="text-xs text-slate-700 space-y-1">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{details.oldStatus}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">{details.newStatus}</span>
                      </div>
                      {details.note && <p className="text-slate-600 text-[11px]">{details.note}</p>}
                    </div>
                  )}

                  {item.action === 'REQUEST_CREATED' && (
                    <p className="text-slate-600 text-[11px]">
                      {details.note || `Intake recorded for "${details.serviceTitle || 'Customer Request'}".`}
                    </p>
                  )}

                  {item.action === 'NOTE_ADDED' && (
                    <p className="text-slate-800 text-xs font-normal whitespace-pre-wrap bg-white p-2 rounded border border-slate-200">
                      {details.note}
                    </p>
                  )}

                  {item.action === 'REQUEST_UPDATED' && (
                    <p className="text-slate-600 text-[11px]">
                      {details.note || 'Request attributes updated by team member.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
