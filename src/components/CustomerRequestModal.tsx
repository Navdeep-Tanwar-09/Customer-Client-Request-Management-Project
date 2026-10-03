import React, { useState, useEffect } from 'react';
import { User, CustomerRequest, Workspace } from '../types.ts';
import { api } from '../api.ts';
import { X, AlertCircle, Wrench, Building2, CheckCircle2 } from 'lucide-react';

interface CustomerRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSuccess: (request: CustomerRequest) => void;
}

export const CustomerRequestModal: React.FC<CustomerRequestModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 'ws_apex',
      name: 'Apex Mechanical & HVAC',
      industry: 'Commercial & Industrial Climate Systems',
      created_at: ''
    },
    {
      id: 'ws_beacon',
      name: 'Beacon Commercial Plumbing',
      industry: 'Municipal & Commercial Fluid Systems',
      created_at: ''
    }
  ]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(currentUser.workspace_id || 'ws_beacon');
  const [serviceTitle, setServiceTitle] = useState('');
  const [description, setDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [customerPhone, setCustomerPhone] = useState(currentUser.phone || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setServiceTitle('');
      setDescription('');
      setPreferredDate('');
      setCustomerPhone(currentUser.phone || '');
      setErrors({});
      setGeneralError(null);
      setIsSubmitting(false);

      api.getWorkspaces().then((res) => {
        const list = res.data || [];
        if (list.length > 0) {
          setWorkspaces(list);
          if (!selectedWorkspaceId || !list.some((w) => w.id === selectedWorkspaceId)) {
            setSelectedWorkspaceId(currentUser.workspace_id || list[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedWorkspaceId) {
      errs.workspace_id = 'Please select a destination workplace.';
    }
    if (!serviceTitle || !serviceTitle.trim() || serviceTitle.trim().length < 2) {
      errs.service_title = 'Please enter a service title.';
    }
    if (!description || !description.trim() || description.trim().length < 2) {
      errs.description = 'Please enter details describing the issue or work requested.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setGeneralError('Please fill in the required fields marked with an asterisk (*).');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const res = await api.createCustomerRequest({
        workspace_id: selectedWorkspaceId || 'ws_beacon',
        service_title: serviceTitle.trim(),
        description: description.trim(),
        preferred_date: preferredDate || null,
        customer_phone: (customerPhone || currentUser.phone || '(555) 000-0000').trim()
      });

      if (res && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        throw new Error('Server returned an unexpected response. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Customer request creation failed:', err);
      setGeneralError(err instanceof Error ? err.message : 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const chosenWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-400" />
              New Service Request
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Submit your maintenance or repair requirements to your chosen service workplace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Submitter Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              Requesting Client
            </div>
            <div className="font-semibold text-slate-900">{currentUser.name}</div>
            <div className="text-slate-500 text-[11px]">{currentUser.email}</div>
          </div>

          {/* Destination Workplace Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Choose Destination Workplace</span>
              <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.industry})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              This request will be routed directly to <strong>{chosenWorkspace?.name || selectedWorkspaceId}</strong> and will be visible to their assigned dispatch team.
            </p>
            {errors.workspace_id && <p className="text-[11px] text-red-600 mt-0.5">{errors.workspace_id}</p>}
          </div>

          {/* Service Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Service Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serviceTitle}
              onChange={(e) => {
                setServiceTitle(e.target.value);
                if (errors.service_title) {
                  setErrors((prev) => ({ ...prev, service_title: '' }));
                }
              }}
              placeholder="e.g. Server Room Air Conditioning Vibration Alarm"
              className={`w-full text-xs px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                errors.service_title ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
              }`}
            />
            {errors.service_title && <p className="text-[11px] text-red-600 mt-0.5">{errors.service_title}</p>}
          </div>

          {/* Preferred Access Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Preferred Service Date (Optional)
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Scope Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Scope & Equipment Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  setErrors((prev) => ({ ...prev, description: '' }));
                }
              }}
              placeholder="Describe symptoms, equipment location, or building access requirements..."
              className={`w-full text-xs px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
              }`}
            />
            {errors.description && <p className="text-[11px] text-red-600 mt-0.5">{errors.description}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-md shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Request</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
