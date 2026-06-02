import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function SetupAccount() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to setup account');
      localStorage.setItem('token', data.token);
      window.location.href = '/profile';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="p-16 text-center">
      <p className="text-lg font-semibold text-[#0F1A2E] mb-1">Invalid Setup Link</p>
      <p className="text-sm text-[#9CA3AF]">This link is invalid or has expired. Please contact support.</p>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="bg-white w-full max-w-md p-8 rounded-xl border border-[#ECEAE6] shadow-sm animate-fade-in">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0F1A2E] mb-2" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
            Set Your Password
          </h2>
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            Your purchase has been approved. Choose a password to access your account and start reading.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#6B7280]">New Password</label>
            <input type="password" required value={password}
                   onChange={e => setPassword(e.target.value)}
                   className="input-field" placeholder="Choose a secure password" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#6B7280]">Confirm Password</label>
            <input type="password" required value={confirmPassword}
                   onChange={e => setConfirmPassword(e.target.value)}
                   className="input-field" placeholder="Repeat your password" />
          </div>
          <p className="text-xs text-[#9CA3AF]">Minimum 6 characters.</p>
          <button type="submit" disabled={loading}
                  className="w-full py-3 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                  style={{ background: '#0F1A2E' }}>
            {loading ? 'Setting up...' : 'Save & Access My Library'}
          </button>
        </form>

        <p className="text-xs text-center text-[#B0ADA8] mt-6">
          This link is valid for 7 days.
        </p>
      </div>
    </div>
  );
}
