import React from 'react';
import { CustomerRequest, RequestStatus } from '../types.ts';
import { Search, Filter, AlertCircle, Wrench, Calendar, ArrowUpDown, ChevronRight } from 'lucide-react';

interface RequestListProps {
  requests: CustomerRequest[];
  selectedRequestId: number | null;
  onSelectRequest: (request: CustomerRequest) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenCreate?: () => void;
}

export const RequestList: React.FC<RequestListProps> = ({
  requests,
  selectedRequestId,
  onSelectRequest,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortByChange,
  isLoading,
  error,
  onRetry
}) => {
  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="text-[11px] font-medium text-blue-700">NEW</span>;
      case 'QUALIFIED':
        return <span className="text-[11px] font-semibold text-emerald-700">QUALIFIED</span>;
      case 'CLOSED':
        return <span className="text-[11px] font-medium text-slate-500">CLOSED</span>;
      default:
        return <span className="text-[11px] text-slate-600">{status}</span>;
    }
  };

  const statusOptions = [
    { label: 'All Requests', value: 'ALL' },
    { label: 'New', value: 'NEW' },
    { label: 'Qualified', value: 'QUALIFIED' },
    { label: 'Closed', value: 'CLOSED' },
  ];

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Search and Filters Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 space-y-3">
        {/* Search Bar & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by customer, service, phone..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-600">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-md focus:outline-hidden"
              title="Sort requests"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-lg text-xs overflow-x-auto">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusFilterChange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === opt.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Request List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Filter className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-slate-700">No requests found</h5>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {searchTerm || statusFilter !== 'ALL'
                  ? 'No client requests match your current search and filter criteria.'
                  : 'This workspace has no active customer requests. Client requests submitted by customers will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          requests.map((req) => {
            const isSelected = selectedRequestId === req.id;
            const isConverted = !!req.work_item_id;

            return (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className={`p-4 cursor-pointer transition-colors text-left flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/60 border-l-4 border-l-blue-600 pl-3'
                    : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  {/* Top line: Status, Date, Work Order */}
                  <div className="flex items-center gap-2 text-xs">
                    {getStatusBadge(req.status)}
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {req.id}
                    </span>
                    {isConverted && (
                      <>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          <Wrench className="w-2.5 h-2.5" />
                          Work Order Active
                        </span>
                      </>
                    )}
                  </div>

                  {/* Service Title */}
                  <h4 className="text-xs font-semibold text-slate-900 truncate">
                    {req.service_title}
                  </h4>

                  {/* Customer info and details */}
                  <p className="text-[11px] text-slate-600 line-clamp-2">
                    {req.description}
                  </p>

                  {/* Bottom metadata */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 font-sans">
                    <span className="font-medium text-slate-700 truncate max-w-[140px]">{req.customer_name}</span>
                    {req.preferred_date && (
                      <>
                        <span aria-hidden="true">&bull;</span>
                        <span className="font-mono flex items-center gap-0.5 text-slate-500">
                          <Calendar className="w-2.5 h-2.5" />
                          {req.preferred_date}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 self-center">
                  <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Count */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span>{requests.length} {requests.length === 1 ? 'request' : 'requests'} listed</span>
        <span className="font-mono text-[10px]">Strict Workspace Scope</span>
      </div>
    </div>
  );
};
