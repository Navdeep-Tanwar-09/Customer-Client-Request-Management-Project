import React, { useState, useEffect } from 'react';
import { CustomerRequest, AssistantSuggestion } from '../types.ts';
import { api } from '../api.ts';
import { Sparkles, ArrowRight, ShieldCheck, Check, AlertCircle, X, HelpCircle } from 'lucide-react';

interface AssistantPanelProps {
  request: CustomerRequest;
  onRequestUpdated: (updated: CustomerRequest) => void;
  onOpenConvertModal: () => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  request,
  onRequestUpdated,
  onOpenConvertModal,
}) => {
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssistantSuggestion | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadSuggestions = async () => {
      try {
        setLoading(true);
        const res = await api.getAssistantSuggestions(request.id);
        if (isMounted) {
          setSuggestions(res.data.suggestions);
        }
      } catch (err) {
        console.error('Failed to load assistant suggestions:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSuggestions();
    return () => {
      isMounted = false;
    };
  }, [request.id, request.status, request.work_item_id]);

  const handleConfirmAction = async () => {
    if (!selectedSuggestion || isApplying) return;

    setIsApplying(true);
    setFeedbackMessage(null);

    try {
      if (selectedSuggestion.type === 'CONVERT_TO_WORK_ITEM') {
        setSelectedSuggestion(null);
        onOpenConvertModal();
        return;
      }

      if (selectedSuggestion.targetStatus) {
        const res = await api.updateRequest(request.id, {
          status: selectedSuggestion.targetStatus,
          activity_note: `Action applied via Desk Assistant recommendation: ${selectedSuggestion.title}`
        });
        onRequestUpdated(res.data);
        setFeedbackMessage(`Request status successfully updated to ${selectedSuggestion.targetStatus}.`);
      } else if (selectedSuggestion.type === 'SCHEDULE_FOLLOWUP') {
        await api.addActivityNote(
          request.id,
          `Follow-up task logged via Assistant: Confirm scope, preferred date, and budget estimate with ${request.customer_name}.`
        );
        setFeedbackMessage('Dispatch follow-up task logged in activity timeline.');
      }
      setSelectedSuggestion(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to apply suggestion.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl p-4 border border-slate-800 shadow-sm space-y-3">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
              Simulated Desk Assistant
              <span className="text-[10px] text-indigo-400 font-normal">Bonus Feature</span>
            </h4>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Requires User Confirmation
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Rule-based workflow heuristics analyze request completeness and recommend the optimal next operational step. Never updates data without your review and confirmation.
      </p>

      {feedbackMessage && (
        <div className="p-2 bg-emerald-950/60 border border-emerald-800 rounded-md text-[11px] text-emerald-300 flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Suggestions List */}
      {loading ? (
        <div className="p-3 text-center text-xs text-slate-400 animate-pulse">
          Evaluating workflow heuristics...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="p-3 text-center text-xs text-slate-400 bg-slate-800/40 rounded-lg">
          No immediate actions recommended for this request.
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((sug) => (
            <div
              key={sug.id}
              className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-lg hover:border-indigo-500/50 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  {sug.title}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                  {sug.confidence} confidence
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-normal">
                {sug.reasoning}
              </p>

              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedSuggestion(sug)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>{sug.suggestedActionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal to Guarantee Human in the Loop */}
      {selectedSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Review & Confirm Recommendation
              </h4>
              <button
                onClick={() => setSelectedSuggestion(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-800 rounded-lg space-y-1">
                <span className="text-[11px] text-indigo-300 uppercase font-semibold">Recommended Action</span>
                <p className="font-semibold text-white">{selectedSuggestion.title}</p>
                <p className="text-slate-300 text-[11px] mt-1">{selectedSuggestion.reasoning}</p>
              </div>

              <div className="p-2.5 bg-slate-800/60 rounded border border-slate-700/60 text-[11px] text-slate-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  The assistant cannot modify records autonomously. You are confirming this action as{' '}
                  <strong className="text-white">{request.customer_name}</strong>'s assigned desk team.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedSuggestion(null)}
                disabled={isApplying}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isApplying}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isApplying ? 'Applying...' : 'Confirm & Apply'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
