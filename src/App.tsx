import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import BookDetail from './pages/BookDetail';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import SetupAccount from './pages/SetupAccount';


// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar() {
  return (
    <aside className="w-full md:w-80 flex flex-col shrink-0 md:overflow-y-auto relative hex-pattern"
           style={{ background: '#0B1426' }}>
      <div className="sidebar-glow" style={{ background: 'rgba(0,212,170,0.08)', top: '-40px', right: '-60px' }} />
      <div className="sidebar-glow" style={{ background: 'rgba(59,130,246,0.06)', bottom: '60px', left: '-80px' }} />

      <div className="relative p-8 flex flex-col h-full z-10">
        <div className="mb-8">
          <div className="w-24 h-24 rounded-xl mb-5 flex items-center justify-center text-white text-3xl font-bold relative"
               style={{ background: 'linear-gradient(135deg, #131E36, #1C2D4F)', border: '1.5px solid rgba(0,212,170,0.2)', boxShadow: '0 0 30px rgba(0,212,170,0.08)' }}>
            M
            <div className="absolute w-2 h-2 rounded-full" style={{ background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.6)', top: '6px', right: '6px' }} />
          </div>
          <h1 className="text-[22px] font-bold leading-tight text-white tracking-tight">
            Mohammad Hasan Mazed
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] mt-2 font-semibold" style={{ color: '#00D4AA' }}>
            Author · Science Educator
          </p>
        </div>

        <div className="glow-line" />

        <div className="my-6 space-y-3">
          <p className="text-[13px] leading-[1.75]" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Dedicated to making science and technology accessible for young minds. Specializes in translating complex subjects — from molecular biology to phonics — into engaging, age-appropriate learning materials.
          </p>
          <p className="text-[13px] leading-[1.75]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            His work bridges the gap between academic rigor and childhood curiosity, building foundations for the next generation of innovators.
          </p>
        </div>

        <div className="glow-line" />

        <div className="my-6">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-3" style={{ color: '#4A6FA5' }}>Focus Areas</p>
          <div className="space-y-2.5">
            {['Science for Children', 'Molecular Biology', 'Phonics & Literacy', 'STEM Education'].map(s => (
              <div key={s} className="flex items-center gap-2.5">
                <div className="mol-dot" style={{ width: '5px', height: '5px' }} />
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-grow" />
        <div className="glow-line" />

        <div className="mt-6 space-y-2.5">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#4A6FA5' }}>Contact</p>
          <a href="mailto:mazedbooks@gmail.com"
             className="block text-[13px] transition-colors hover:text-[#00D4AA]"
             style={{ color: 'rgba(255,255,255,0.5)' }}>
            mazedbooks@gmail.com
          </a>
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>+880 17XX-XXXXXX</p>
        </div>

        <div className="flex gap-2 mt-4">
          {['Facebook', 'LinkedIn'].map(s => (
            <a key={s} href="#"
               className="text-[11px] font-medium px-3 py-1.5 rounded transition-all hover:border-[#00D4AA] hover:text-[#00D4AA]"
               style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {s.substring(0, 2).toUpperCase()}
            </a>
          ))}
        </div>

        <p className="text-[10px] mt-5" style={{ color: 'rgba(255,255,255,0.15)' }}>
          © {new Date().getFullYear()} Mazed Educational Publications
        </p>
      </div>
    </aside>
  );
}

// ── Navigation ─────────────────────────────────────────────────────────────
function Navigation() {
  const { userData, signInWithGoogleToken, signInWithEmail, signUpWithEmail, logout, isAdmin, mockLogin } = useAuth();
  const location = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginForm, setLoginForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  (window as any).mockLogin = mockLogin;

  const navLinks = [
    { to: '/', label: 'Available Books' },
    ...(userData ? [{ to: '/profile', label: 'My Library' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(loginForm.email, loginForm.password, loginForm.name || 'Reader');
      } else {
        await signInWithEmail(loginForm.email, loginForm.password);
      }
      setShowLoginModal(false);
      setLoginForm({ name: '', email: '', password: '' });
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <>
      <nav className="h-14 flex items-center justify-between px-8 shrink-0 z-50"
           style={{ background: 'white', borderBottom: '1px solid #E8ECF1' }}>
        <div className="flex gap-6 h-full items-center">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to}
                  className={`text-[13px] font-semibold h-full flex items-center transition-colors relative ${
                    location.pathname === link.to ? 'text-[#0F1A2E]' : 'text-[#9CA3AF] hover:text-[#0F1A2E]'
                  }`}>
              {link.label}
              {location.pathname === link.to && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: '#00D4AA' }} />
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {userData ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-[12px] font-semibold text-[#0F1A2E] leading-tight">{userData.name || 'Reader'}</p>
                <p className="text-[10px] text-[#9CA3AF]">{userData.email}</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                   style={{ background: '#0F1A2E' }}>
                {(userData.name || userData.email || 'U')[0].toUpperCase()}
              </div>
              <button onClick={logout} className="text-[12px] font-medium text-[#9CA3AF] hover:text-[#0F1A2E] transition-colors">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">

              <button onClick={() => { setShowLoginModal(true); setIsSignUp(false); }}
                      className="text-[12px] font-semibold text-white px-5 py-2 rounded-lg transition-all hover:shadow-md"
                      style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)' }}>
                Sign In
              </button>
            </div>
          )}
        </div>
      </nav>

      {showLoginModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
             style={{ background: 'rgba(15,26,46,0.6)', backdropFilter: 'blur(6px)' }}
             onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }}>
          <div className="bg-white w-full max-w-[400px] p-8 animate-fade-in"
               style={{ borderRadius: '16px', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-[#0F1A2E]" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {isSignUp ? 'Set up your reader account' : 'Sign in to access your books'}
                </p>
              </div>
              <button onClick={() => setShowLoginModal(false)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-[#9CA3AF] hover:text-[#0F1A2E] hover:bg-gray-100 transition-all">✕</button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-red-100">{authError}</div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-3 mb-4">
              {isSignUp && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#6B7280]">Name</label>
                  <input type="text" required value={loginForm.name}
                         onChange={e => setLoginForm({...loginForm, name: e.target.value})}
                         className="input-field" placeholder="Your name" />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#6B7280]">Email</label>
                <input type="email" required value={loginForm.email}
                       onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                       className="input-field" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#6B7280]">Password</label>
                <input type="password" required value={loginForm.password}
                       onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                       className="input-field" placeholder="Enter password" />
              </div>
              <button type="submit" disabled={authLoading}
                      className="w-full py-3 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50"
                      style={{ background: '#0F1A2E' }}>
                {authLoading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                    className="w-full text-xs font-medium text-[#9CA3AF] hover:text-[#0F1A2E] transition-colors text-center py-2">
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Create one'}
            </button>


          </div>
        </div>
      )}
    </>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="shrink-0 h-10 flex items-center justify-center" style={{ borderTop: '1px solid #ECEAE6' }}>
      <p className="text-[11px] text-[#B0ADA8]">© {new Date().getFullYear()} Mazed Educational Publications</p>
    </footer>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col md:flex-row w-full h-screen md:overflow-hidden" style={{ background: '#F9F8F6' }}>
          <Sidebar />
          <main className="flex-1 flex flex-col h-full md:overflow-hidden">
            <Navigation />
            <div className="flex-1 overflow-y-auto w-full" style={{ background: '#F9F8F6' }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/book/:id" element={<BookDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/setup-account" element={<SetupAccount />} />
              </Routes>
            </div>
            <Footer />
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
