import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../lib/types';

interface AuthContextType {
  currentUser: { uid: string; email: string; displayName: string } | null;
  userData: User | null;
  loading: boolean;
  signInWithGoogleToken: (credential: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  mockLogin: (asAdmin: boolean) => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string; displayName: string } | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          const u = { uid: String(data.user.id), email: data.user.email, displayName: data.user.name };
          setCurrentUser(u);
          setUserData({ id: u.uid, name: u.displayName, email: u.email });
        } else {
          localStorage.removeItem('token');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signInWithGoogleToken = async (credential: string) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        const u = { uid: String(data.user.id), email: data.user.email, displayName: data.user.name };
        setCurrentUser(u);
        setUserData({ id: u.uid, name: u.displayName, email: u.email });
      } else {
        alert(data.error || 'Google Sign-In failed');
      }
    } catch (error: any) {
      alert('Google Sign-In failed: ' + error.message);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        const u = { uid: String(data.user.id), email: data.user.email, displayName: data.user.name };
        setCurrentUser(u);
        setUserData({ id: u.uid, name: u.displayName, email: u.email });
      } else {
        alert(data.error || 'Sign in failed');
      }
    } catch (error: any) {
      alert('Sign in failed: ' + error.message);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, name })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        const u = { uid: String(data.user.id), email: data.user.email, displayName: data.user.name };
        setCurrentUser(u);
        setUserData({ id: u.uid, name: u.displayName, email: u.email });
      } else {
        alert(data.error || 'Sign up failed');
      }
    } catch (error: any) {
      alert('Sign up failed: ' + error.message);
    }
  };

  const mockLogin = (asAdmin: boolean) => {
    alert("Mock login is deprecated. Please create an account.");
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setUserData(null);
  };

  const isAdmin = !!(userData && (userData.email.toLowerCase() === 'mazedcu@gmail.com' || userData.email.toLowerCase() === 'mazedbooks@gmail.com'));

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, signInWithGoogleToken, signInWithEmail, signUpWithEmail, mockLogin, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
