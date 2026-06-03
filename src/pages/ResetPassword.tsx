import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="p-16 text-center">
      <p className="text-lg font-semibold text-[#0F172A] mb-1">Invalid Reset Link</p>
      <p className="text-sm text-[#94A3B8]">This link is invalid or has expired.</p>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="bg-white w-full max-w-md p-8 rounded-xl border border-[#E8ECF1] shadow-sm animate-fade-in circuit-corner">
        {success ? (
          <div className="text-center py-6">
             <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold"
                 style={{ background: '#00D4AA' }}>✓</div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Password Reset</h2>
            <p className="text-sm text-[#94A3B8] mb-6">Your password has been successfully updated.</p>
            <button onClick={() => navigate('/')} className="text-sm font-semibold text-[#00D4AA] hover:text-[#0B1426] transition-colors">
              Return to Home
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-[2px]" style={{ background: '#00D4AA' }} />
                <h2 className="text-2xl font-bold text-[#0F172A]">Reset Password</h2>
              </div>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                Please enter a new password for your account below.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#64748B]">New Password</label>
                <input type="password" required value={password}
                       onChange={e => setPassword(e.target.value)}
                       className="input-field" placeholder="Choose a secure password" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#64748B]">Confirm Password</label>
                <input type="password" required value={confirmPassword}
                       onChange={e => setConfirmPassword(e.target.value)}
                       className="input-field" placeholder="Repeat your password" />
              </div>
              <p className="text-xs text-[#94A3B8]">Minimum 6 characters.</p>
              <button type="submit" disabled={loading}
                      className="w-full py-3 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)' }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
