import React from 'react';
import { Plus, Building2, Clock, LogOut } from 'lucide-react';
import { Workspace, User as UserType } from '../types.ts';

interface HeaderProps {
  currentWorkspace: Workspace | null;
  currentUser: UserType | null;
  onOpenNewRequest: () => void;
  onOpenTestInspector?: () => void;
  onOpenActivityModal: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentWorkspace,
  currentUser,
  onOpenNewRequest,
  onOpenActivityModal,
  onLogout
}) => {
  const isCustomer = currentUser?.user_type === 'CUSTOMER';

  return (
    <header className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCustomer ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
              {isCustomer ? 'Customer Request Desk' : 'Client Request Desk'}
            </span>
          </div>

          {/* Zone 3: Actions, Activity Button, and User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Activity Button in Header (Requested for BOTH workplace and customer) */}
            <button
              onClick={onOpenActivityModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors shadow-2xs"
              title="View full action timeline of each request"
            >
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Activity Timeline</span>
            </button>

            {/* Workplace-only actions: Assigned Workplace (Non-selectable) */}
            {!isCustomer && (
              <div className="relative hidden md:block">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 rounded-md text-slate-200">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-white truncate max-w-[180px]">
                    {currentWorkspace?.name || 'Workspace'}
                  </span>
                </div>
              </div>
            )}

            {/* + New Request Button (Only for Customer) */}
            {isCustomer && (
              <button
                onClick={onOpenNewRequest}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-xs transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Request</span>
              </button>
            )}

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-white leading-tight">
                  {currentUser?.name || 'User'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {currentUser?.user_type === 'WORKPLACE' ? 'Workplace User' : 'Customer'}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                title="Sign out / Switch account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
