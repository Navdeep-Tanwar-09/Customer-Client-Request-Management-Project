import React, { useState, useEffect } from 'react';
import { UserType, AuthSession, DemoAccount } from '../types.ts';
import { api } from '../api.ts';
import { Building2, User, KeyRound, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (session: AuthSession) => void;
  initialError?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, initialError = null }) => {
  const [role, setRole] = useState<UserType>('WORKPLACE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  const [demoAccounts, setDemoAccounts] = useState<{
    workplace: DemoAccount[];
    customer: DemoAccount[];
  }>({
    workplace: [],
    customer: []
  });

  useEffect(() => {
    api.getDemoAccounts()
      .then((res) => setDemoAccounts(res.data))
      .catch(() => {
        // Fallback default accounts
        setDemoAccounts({
          workplace: [
            {
              email: 'marcus@apexhvac.example.com',
              password: 'password123',
              name: 'Marcus Vance',
              user_type: 'WORKPLACE',
              workspace_name: 'Apex Mechanical & HVAC'
            },
            {
              email: 'elena@beaconplumbing.example.com',
              password: 'password123',
              name: 'Elena Rostova',
              user_type: 'WORKPLACE',
              workspace_name: 'Beacon Commercial Plumbing'
            }
          ],
          customer: [
            {
              email: 'arthur.p@metrohealth.example.com',
              password: 'password123',
              name: 'Dr. Arthur Pendelton',
              user_type: 'CUSTOMER',
              workspace_name: 'Apex Mechanical & HVAC'
            },
            {
              email: 'cbeaumont@grandplazaretail.example.com',
              password: 'password123',
              name: 'Claire Beaumont',
              user_type: 'CUSTOMER',
              workspace_name: 'Apex Mechanical & HVAC'
            }
          ]
        });
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await api.login({
        email: email.trim(),
        password,
        role
      });

      onLoginSuccess(response.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectQuickAccount = (acc: DemoAccount) => {
    setRole(acc.user_type);
    setEmail(acc.email);
    setPassword(acc.password);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-950 text-white border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-base font-bold tracking-tight">Client Request Desk</span>
          </div>
          <p className="text-xs text-slate-400">
            Sign in to access workspace dispatch or client request tracking.
          </p>
        </div>

        {/* Role Switcher */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setRole('WORKPLACE');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  role === 'WORKPLACE'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Workplace User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('CUSTOMER');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  role === 'CUSTOMER'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Customer</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'WORKPLACE' ? 'marcus@apexhvac.example.com' : 'arthur.p@metrohealth.example.com'}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing in...' : `Sign in as ${role === 'WORKPLACE' ? 'Workplace Member' : 'Customer'}`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Demo Accounts List with 1-click login */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Quick Login Accounts (Click to Fill)
            </span>

            <div className="space-y-2">
              {(role === 'WORKPLACE' ? demoAccounts.workplace : demoAccounts.customer).map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectQuickAccount(acc)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors flex items-center justify-between text-xs group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5">
                      <span>{acc.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({acc.user_type === 'WORKPLACE' ? 'Workplace User' : 'Customer'})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {acc.email}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-800">
                      pass: {acc.password}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
