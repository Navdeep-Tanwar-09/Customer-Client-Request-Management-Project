import React, { useState } from 'react';
import { CustomerRequest, RequestStatus } from '../types.ts';
import { api } from '../api.ts';
import { ActivityTimeline } from './ActivityTimeline.tsx';
import {
  CheckCircle2, User, Phone, Mail, Calendar,
  FileText, ShieldCheck, Wrench, LockKeyhole, AlertTriangle
} from 'lucide-react';

interface RequestDetailProps {
  request: CustomerRequest | null;
  onRequestUpdated: (updated: CustomerRequest) => void;
  onOpenCreateWork: () => void;
}

export const RequestDetail: React.FC<RequestDetailProps> = ({
  request,
  onRequestUpdated,
  onOpenCreateWork
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null);

  if (!request) {
    return (
      <div className="h-full bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center text-slate-400">
        <FileText className="w-10 h-10 mb-3 text-slate-300" />
        <h4 className="text-sm font-semibold text-slate-700">No Request Selected</h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Select a customer request from the list on the left to review scope, update status, view the activity timeline, or convert into a work order.
        </p>
      </div>
    );
  }

  const isQualified = request.status === 'QUALIFIED';
  const isConverted = !!request.work_item_id;
  const canChangeStatus = request.status === 'NEW';

  const handleStatusChange = async () => {
    if (!pendingStatus || !canChangeStatus || isUpdatingStatus) return;

    try {
      setIsUpdatingStatus(true);
      const res = await api.updateRequest(request.id, {
        status: pendingStatus,
        activity_note: `Manual desk status transition: ${request.status} -> ${pendingStatus}`
      });
      onRequestUpdated(res.data);
      setPendingStatus(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update request status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Detail Header & Action Bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[11px] text-slate-500 font-semibold">{request.id}</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-[11px] text-slate-500">
                Created {new Date(request.created_at).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {request.service_title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isConverted && (
              <span className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Work Order Converted</span>
              </span>
            )}
            <button
              type="button"
              onClick={onOpenCreateWork}
              disabled={!isQualified || isConverted}
              title={isConverted ? 'A work item has already been created for this request.' : isQualified ? 'Create a work item' : 'Qualify this request before creating work.'}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md shadow-sm transition-colors flex items-center gap-1.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <Wrench className="w-3.5 h-3.5" />
              Create Work
            </button>
          </div>
        </div>

        {/* Status Transition Control Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Desk Status:
            </span>
            {canChangeStatus ? (
              <div className="flex items-center gap-1">
                {(['QUALIFIED', 'CLOSED'] as RequestStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPendingStatus(st)}
                    disabled={isUpdatingStatus}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors border disabled:opacity-50 disabled:cursor-not-allowed ${
                      st === 'QUALIFIED'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Mark {st === 'QUALIFIED' ? 'Qualified' : 'Closed'}
                  </button>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <LockKeyhole className="w-3.5 h-3.5" />
                Status locked after the initial decision
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Isolated in workspace</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 pt-1 border-t border-slate-200 text-xs font-medium">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-1 transition-colors border-b-2 ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Scope & Customer
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-1 transition-colors border-b-2 ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Audit Timeline
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeTab === 'details' && (
          <div className="space-y-5">
            {/* Customer Information Card */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Customer & Site Contacts
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Contact Person</span>
                  <span className="font-semibold text-slate-900 block mt-0.5">{request.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Direct Phone</span>
                  <span className="font-mono text-slate-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {request.customer_phone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Email Address</span>
                  <span className="text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    {request.customer_email}
                  </span>
                </div>
              </div>
            </div>

            {/* Parameters & Scope */}
            <div className="border border-slate-200 rounded-lg p-3.5 space-y-1">
              <span className="text-slate-500 text-[11px] block flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Requested Service Window / Date
              </span>
              <span className="text-sm font-semibold font-mono text-slate-900">
                {request.preferred_date || 'Flexible / As soon as possible'}
              </span>
            </div>

            {/* Description */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Detailed Technical Scope
              </h4>
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                {request.description}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <ActivityTimeline
            requestId={request.id}
            customerName={request.customer_name}
          />
        )}
      </div>

      {pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-confirmation-title"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="status-confirmation-title" className="text-sm font-bold text-slate-900">Confirm status decision</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Set this request to <strong>{pendingStatus === 'QUALIFIED' ? 'Qualified' : 'Closed'}</strong>? This is a one-time decision and cannot be changed again.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingStatus(null)}
                disabled={isUpdatingStatus}
                className="rounded-md px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={isUpdatingStatus}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUpdatingStatus ? 'Saving...' : 'Confirm status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
