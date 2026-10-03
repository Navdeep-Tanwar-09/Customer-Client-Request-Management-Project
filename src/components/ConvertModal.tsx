import React, { useState, useEffect } from 'react';
import { CustomerRequest, WorkItem } from '../types.ts';
import { api, getErrorMessage, isApiClientError, isWorkItem } from '../api.ts';
import { X, Calendar, User, Wrench, AlertTriangle, CheckCircle2, ShieldAlert, Clock, ArrowRight } from 'lucide-react';

interface ConvertModalProps {
  request: CustomerRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onConverted: (workItem: WorkItem, updatedRequest: CustomerRequest) => void;
}

export const ConvertModal: React.FC<ConvertModalProps> = ({
  request,
  isOpen,
  onClose,
  onConverted
}) => {
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignedTechnician, setAssignedTechnician] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictItem, setConflictItem] = useState<WorkItem | null>(null);

  // Default suggested technicians based on workspace industry / context
  const defaultTechnicians = [
    'Alex Mercer (Senior Thermal Tech)',
    'Samira Khan (Heavy Civil Tech)',
    'Marcus Vance (Lead Dispatcher)',
    'Elena Rostova (Operations Director)',
    'Carlos Mendez (Field Specialist)',
    'Unassigned / Queue'
  ];

  useEffect(() => {
    if (request && isOpen) {
      // Prefill scheduled date: use request.preferred_date or 2 business days in future
      const defaultDate = request.preferred_date || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
      setScheduledDate(defaultDate);
      setAssignedTechnician(defaultTechnicians[0]);
      setNotes(request.description || '');
      setErrorMessage(null);
      setConflictItem(null);
      setIsConfirming(false);
    }
  }, [request, isOpen]);

  if (!isOpen || !request) return null;

  const isQualified = request.status === 'QUALIFIED';
  const isAlreadyConverted = !!request.work_item_id;

  const handleReviewConversion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isQualified || isAlreadyConverted || isSubmitting) return;

    if (!scheduledDate) {
      setErrorMessage('Please select a scheduled dispatch date.');
      return;
    }

    setIsConfirming(true);
  };

  const handleConfirmConversion = async () => {
    if (!isQualified || isAlreadyConverted || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await api.convertToWorkItem(request.id, {
        scheduled_date: scheduledDate,
        assigned_technician: assignedTechnician,
        notes: notes
      });

      onConverted(response.data.work_item, response.data.request);
      onClose();
    } catch (err: unknown) {
      setIsConfirming(false);
      if (isApiClientError(err) && (err.status === 409 || err.code === 'ALREADY_CONVERTED')) {
        setErrorMessage(getErrorMessage(err, 'This request has already been converted into a work item.'));
        if (err.raw && typeof err.raw === 'object' && 'work_item' in err.raw) {
          const item: unknown = err.raw.work_item;
          if (isWorkItem(item)) setConflictItem(item);
        }
      } else if (isApiClientError(err) && (err.status === 400 || err.code === 'NOT_QUALIFIED')) {
        setErrorMessage(getErrorMessage(err, 'Only QUALIFIED requests can be converted into work items.'));
      } else {
        setErrorMessage(getErrorMessage(err, 'Failed to convert request to work item.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-400" />
              Human Confirmed Action: Convert to Work Item
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and confirm dispatch conversion details before creating the official work order.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleReviewConversion} className="p-6 space-y-5">
          {/* Status Warning if Not Qualified */}
          {!isQualified && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Conversion Blocked: Request is not QUALIFIED.</span>
                <p className="mt-0.5 text-amber-800">
                  Current status is <span className="font-mono font-bold text-amber-900">{request.status}</span>.
                  The business rules require requests to be qualified before a work item can be created.
                </p>
              </div>
            </div>
          )}

          {/* Conflict Warning if Already Converted */}
          {isAlreadyConverted && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Request Already Converted</span>
                <p className="mt-0.5 text-blue-800">
                  This request has already been converted into a work order. Re-submitting is blocked to prevent duplicate dispatches.
                </p>
              </div>
            </div>
          )}

          {/* API Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">{errorMessage}</span>
                {conflictItem && (
                  <p className="mt-1 text-red-600">
                    Existing Work Item: <span className="font-mono font-bold">{conflictItem.work_item_id}</span> (Scheduled: {conflictItem.scheduled_date})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Required Confirmation Summary: Customer & Requested Service */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Verified Conversion Parameters
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Customer</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {request.customer_name}
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  {request.customer_phone} &bull; {request.customer_email}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px]">Requested Service</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <Wrench className="w-3.5 h-3.5 text-slate-500" />
                  {request.service_title}
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields: Scheduled Date & Technician */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scheduled Service Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  disabled={!isQualified || isAlreadyConverted || isSubmitting}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {request.preferred_date ? `Customer requested window: ${request.preferred_date}` : 'Scheduled date for dispatch team assignment.'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Lead Technician
              </label>
              <select
                value={assignedTechnician}
                onChange={(e) => setAssignedTechnician(e.target.value)}
                disabled={!isQualified || isAlreadyConverted || isSubmitting}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 bg-white"
              >
                {defaultTechnicians.map((tech) => (
                  <option key={tech} value={tech}>
                    {tech}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispatch Instructions & Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={!isQualified || isAlreadyConverted || isSubmitting}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Include access codes, key contacts, or equipment serials..."
              />
            </div>
          </div>

          {/* Audit Note */}
          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-md flex items-center gap-2 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              This conversion will generate an immutable entry in the activity timeline logging your user identity, timestamp, and work order ID.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isQualified || isAlreadyConverted || isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Creating Work Item...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Create Work Item</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {isConfirming && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/55 p-5">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h4 className="text-sm font-bold text-slate-900">Create this work item?</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                You are creating work for <strong>{request.customer_name}</strong> on <strong>{scheduledDate}</strong>, assigned to <strong>{assignedTechnician}</strong>.
              </p>
              <p className="mt-2 text-[11px] text-slate-500">This action creates the official work item and cannot be duplicated.</p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  disabled={isSubmitting}
                  className="rounded-md px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConversion}
                  disabled={isSubmitting}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Yes, create work'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
