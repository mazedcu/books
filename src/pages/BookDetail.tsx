import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Book } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutForm, setCheckoutForm] = useState({ name: userData?.name || '', email: userData?.email || '', bkashReference: '' });
  const [submitting, setSubmitting] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  useEffect(() => {
    if (userData) {
      setCheckoutForm(prev => ({ ...prev, name: prev.name || userData.name, email: prev.email || userData.email }));
    }
  }, [userData]);

  useEffect(() => {
    async function fetchBook() {
      if (!id) return;
      try {
        const res = await fetch('/api/books');
        const books = await res.json();
        const found = books.find((b: Book) => b.id === id);
        if (found) setBook(found);
        else navigate('/');
      } catch (error) {
        console.error("Failed to fetch book", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBook();
  }, [id, navigate]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    if (!checkoutForm.name || !checkoutForm.email || !checkoutForm.bkashReference) {
      alert("Please fill all fields.");
      return;
    }
    setSubmitting(true);
    setCheckoutMessage('');
    try {
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, bookId: book.id, bkashReference: checkoutForm.bkashReference, customerName: checkoutForm.name, customerEmail: checkoutForm.email })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Order submission failed');
      }
      setCheckoutMessage('success');
      setCheckoutForm({ ...checkoutForm, bkashReference: '' });
    } catch (err: any) {
      alert(err.message || "Error submitting order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="p-8 sm:p-12 max-w-4xl">
      <div className="skeleton h-4 w-24 rounded mb-8" />
      <div className="flex flex-col md:flex-row gap-10">
        <div className="skeleton w-full md:w-56 aspect-[3/4] rounded-xl" />
        <div className="flex-1 space-y-4">
          <div className="skeleton h-8 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
  if (!book) return null;

  return (
    <div className="p-8 sm:p-12 max-w-4xl">
      <button onClick={() => navigate('/')}
              className="text-[13px] font-medium text-[#94A3B8] hover:text-[#00D4AA] transition-colors mb-8 inline-block">
        ← Back to collection
      </button>

      <div className="flex flex-col md:flex-row gap-10 mb-12">
        {/* Cover */}
        <div className="w-full md:w-56 shrink-0">
          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#F1F5F9] shadow-lg">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #0B1426, #1C2D4F)' }}>
                <span className="text-5xl font-bold" style={{ color: 'rgba(0,212,170,0.3)' }}>{book.title[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-[2px]" style={{ background: '#00D4AA' }} />
            <span className="tag-science">Educational E-Book</span>
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A] mb-2 leading-tight">
            {book.title}
          </h1>
          <p className="text-sm text-[#94A3B8] mb-5">By Mohammad Hasan Mazed</p>

          <div className="bg-white rounded-xl border border-[#E8ECF1] p-5 mb-5">
            <p className="text-sm leading-[1.8] text-[#64748B]">{book.description}</p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-[#0F172A]">{book.price} BDT</span>
            <span className="text-[11px] font-medium text-[#94A3B8] px-3 py-1 rounded bg-white border border-[#E8ECF1]">
              Digital Download
            </span>
          </div>
        </div>
      </div>

      {/* Preview */}
      {(book.previewPage1Url || book.previewPage2Url || book.previewContent) && (
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-[2px]" style={{ background: '#00D4AA' }} />
            <h2 className="text-lg font-bold text-[#0F172A]">Preview</h2>
          </div>
          {(book.previewPage1Url || book.previewPage2Url) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {book.previewPage1Url && (
                <div className="rounded-xl overflow-hidden bg-white border border-[#E8ECF1]">
                  <div className="px-4 py-2 border-b border-[#E8ECF1]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Page 1</p>
                  </div>
                  <img src={book.previewPage1Url} alt="Preview Page 1" className="w-full h-auto" />
                </div>
              )}
              {book.previewPage2Url && (
                <div className="rounded-xl overflow-hidden bg-white border border-[#E8ECF1]">
                  <div className="px-4 py-2 border-b border-[#E8ECF1]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Page 2</p>
                  </div>
                  <img src={book.previewPage2Url} alt="Preview Page 2" className="w-full h-auto" />
                </div>
              )}
            </div>
          ) : book.previewContent && (
            <div className="preview-page">
              <p className="text-sm leading-[1.8] text-[#64748B] italic">{book.previewContent}</p>
            </div>
          )}
        </div>
      )}

      {/* Checkout */}
      <div className="bg-white rounded-xl border border-[#E8ECF1] p-8 relative circuit-corner">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-6 h-[2px]" style={{ background: '#00D4AA' }} />
          <h2 className="text-lg font-bold text-[#0F172A]">Purchase This Book</h2>
        </div>
        <p className="text-xs text-[#94A3B8] mb-6 ml-9">Pay via bKash and get instant access after approval.</p>

        {checkoutMessage === 'success' ? (
          <div className="text-center py-10 animate-fade-in">
            <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold"
                 style={{ background: '#00D4AA' }}>✓</div>
            <h3 className="text-xl font-bold text-[#0F172A] mb-2">Payment Submitted</h3>
            <p className="text-sm text-[#94A3B8] max-w-sm mx-auto">
              You will receive an email once the admin approves your order and creates your account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#64748B]">Full Name</label>
                <input type="text" required value={checkoutForm.name} placeholder="Your full name"
                       onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#64748B]">Email</label>
                <input type="email" required value={checkoutForm.email} placeholder="you@example.com"
                       onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1 text-[#64748B]">bKash Transaction ID</label>
                <input type="text" required value={checkoutForm.bkashReference} placeholder="e.g. TXN123456789"
                       onChange={e => setCheckoutForm({...checkoutForm, bkashReference: e.target.value})} className="input-field font-mono" />
              </div>
            </div>

            <div className="rounded-xl p-5 border border-[#E8ECF1] flex flex-col justify-between" style={{ background: '#F7F8FA' }}>
              <div>
                <p className="text-sm font-bold text-[#0F172A] mb-3">Payment Instructions</p>
                <ol className="space-y-2 text-sm text-[#64748B]">
                  <li><span className="font-semibold text-[#0F172A]">1.</span> Open bKash App or dial *247#</li>
                  <li><span className="font-semibold text-[#0F172A]">2.</span> Send to: <span className="font-mono font-bold text-[#E2136E]">01676885195</span></li>
                  <li><span className="font-semibold text-[#0F172A]">3.</span> Amount: <span className="font-bold">{book.price} BDT</span></li>
                  <li><span className="font-semibold text-[#0F172A]">4.</span> Enter the Transaction ID above</li>
                </ol>
              </div>
              <button type="submit" disabled={submitting}
                      className="bkash-button w-full py-3 text-sm font-bold text-white mt-5 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
