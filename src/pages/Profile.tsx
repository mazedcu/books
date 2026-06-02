import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Book, Order } from '../lib/types';
import { Link } from 'react-router-dom';

interface PurchasedBook extends Book {
  downloadUrl?: string;
  orderId?: string;
}

export default function Profile() {
  const { userData } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [library, setLibrary] = useState<PurchasedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;
    async function fetchUserData() {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const [libraryRes, ordersRes] = await Promise.all([
          fetch('/api/users/me/library', { headers }),
          fetch('/api/users/me/orders', { headers })
        ]);
        if (libraryRes.ok) setLibrary(await libraryRes.json());
        if (ordersRes.ok) setOrders(await ordersRes.json());
      } catch (error) {
        console.error("Failed to fetch profile data", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, [userData]);

  if (!userData) return (
    <div className="p-16 text-center">
      <p className="text-lg font-semibold text-[#0F172A] mb-1">Please sign in</p>
      <p className="text-sm text-[#94A3B8]">Sign in to access your personal library.</p>
    </div>
  );

  if (loading) return (
    <div className="p-8 sm:p-12 space-y-4">
      <div className="skeleton h-6 w-40 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="skeleton h-56 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-8 sm:p-12 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
             style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)', border: '1px solid rgba(0,212,170,0.2)' }}>
          {(userData.name || userData.email || 'U')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{userData.name || 'My Account'}</h1>
          <p className="text-sm text-[#94A3B8]">{userData.email}</p>
        </div>
      </div>

      {/* Library */}
      <div className="mb-12">
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-[2px]" style={{ background: '#00D4AA' }} />
            <h2 className="text-lg font-bold text-[#0F172A]">My Library</h2>
          </div>
          <span className="text-xs text-[#94A3B8] font-medium">{library.length} book{library.length !== 1 ? 's' : ''}</span>
        </div>

        {library.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8ECF1] p-14 text-center relative circuit-corner">
            <p className="text-lg font-semibold text-[#0F172A] mb-1">Your library is empty</p>
            <p className="text-sm text-[#94A3B8] mb-6">Purchased books will appear here once approved.</p>
            <Link to="/" className="text-sm font-semibold text-white px-6 py-2.5 rounded-lg inline-block"
                  style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)' }}>
              Browse Books
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {library.map((book, i) => (
              <div key={book.id} className="book-card group flex flex-col animate-fade-in"
                   style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="aspect-[4/3] overflow-hidden bg-[#F1F5F9] relative">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)' }}>
                      <span className="text-3xl font-bold" style={{ color: 'rgba(0,212,170,0.3)' }}>{book.title[0]}</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded"
                          style={{ background: '#00D4AA' }}>Owned</span>
                  </div>
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <h4 className="text-[15px] font-bold text-[#0F172A] mb-1 leading-tight">{book.title}</h4>
                  <p className="text-xs text-[#94A3B8] mb-4 flex-grow">By Hasan Mazed</p>
                  {book.downloadUrl ? (
                    <a href={book.downloadUrl} download target="_blank" rel="noreferrer"
                       className="block text-center text-sm font-semibold text-white py-2.5 rounded-lg transition-all hover:shadow-md"
                       style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)' }}>
                      Download Now
                    </a>
                  ) : (
                    <div className="text-center text-xs text-[#94A3B8] py-2.5 rounded-lg bg-[#F7F8FA] border border-[#E8ECF1]">
                      PDF not available yet
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-6 h-[2px]" style={{ background: '#00D4AA' }} />
          <h2 className="text-lg font-bold text-[#0F172A]">Payment History</h2>
        </div>
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8ECF1] p-8 text-center">
            <p className="text-sm text-[#94A3B8]">No orders found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E8ECF1] overflow-hidden">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8ECF1' }}>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-[#F7F8FA]">Date</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-[#F7F8FA]">Book</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-[#F7F8FA]">bKash Ref</th>
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] bg-[#F7F8FA] text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-t border-[#F1F5F9] hover:bg-[#F7F8FA] transition-colors">
                    <td className="px-6 py-4 text-[#64748B]">
                      {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate">
                      <Link to={`/book/${order.bookId}`} className="font-medium text-[#1C2D4F] hover:text-[#00D4AA] transition-colors">
                        {order.bookId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[#64748B]">{order.bkashReference}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        order.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                        order.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
