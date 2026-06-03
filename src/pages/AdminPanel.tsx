import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Order } from '../lib/types';
import { MAZED_BOOKS } from '../lib/seedData';

export default function AdminPanel() {
  const { isAdmin, currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newBook, setNewBook] = useState({ id: '', title: '', description: '', price: '' });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewPage1, setPreviewPage1] = useState<File | null>(null);
  const [previewPage2, setPreviewPage2] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [addingBook, setAddingBook] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    async function fetchOrders() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch orders");
        const fetchedOrders = await res.json();
        setOrders(fetchedOrders);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [isAdmin]);

  const handleApprove = async (order: Order) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${order.id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to approve');

      setOrders(orders.filter(o => o.id !== order.id));
      
      if (data.emailSent) {
        alert("Order approved and email sent successfully!");
      } else {
        alert("Order approved, but automated email failed. You may need to configure EMAIL_PASS in the backend.");
      }
      
    } catch (e: any) {
      alert("Error approving order: " + e.message);
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBook(true);
    try {
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('id', newBook.id);
      formData.append('title', newBook.title);
      formData.append('description', newBook.description);
      formData.append('price', newBook.price);
      if (pdfFile) formData.append('pdfFile', pdfFile);
      if (coverImage) formData.append('coverImage', coverImage);
      if (previewPage1) formData.append('previewPage1', previewPage1);
      if (previewPage2) formData.append('previewPage2', previewPage2);

      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add book');
      
      alert('Book added successfully!');
      setNewBook({ id: '', title: '', description: '', price: '' });
      setCoverImage(null);
      setPreviewPage1(null);
      setPreviewPage2(null);
      setPdfFile(null);
      (document.getElementById('addBookForm') as HTMLFormElement).reset();
    } catch (err: any) {
      alert("Error adding book: " + err.message);
    } finally {
      setAddingBook(false);
    }
  };

  if (!isAdmin) return <div className="p-10 font-serif italic text-xl">Access Denied. You are logged in as {currentUser?.email}, but this is not the admin email.</div>;

  return (
    <div className="p-4 sm:p-10 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
           <h1 className="text-3xl font-serif italic">Admin Dashboard</h1>
           <button 
             onClick={async () => {
               const token = localStorage.getItem('token');
               const res = await fetch('/api/books/seed', {
                 method: 'POST',
                 headers: { 
                   'Authorization': `Bearer ${token}`,
                   'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({ books: MAZED_BOOKS })
               });
               if (res.ok) {
                 alert("Books seeded successfully! Please refresh.");
               } else {
                 alert("Failed to seed books");
               }
             }}
             className="text-[10px] border border-[#1A1A1A] px-3 py-1 hover:bg-[#1A1A1A] hover:text-white transition-all uppercase tracking-widest font-bold"
           >
             Seed Mohammad Hasan Mazed's Books
           </button>
        </div>

        <div className="mb-16 border border-[#E5E1DA] p-6 bg-[#FAF7F2]">
          <h2 className="text-xl font-serif italic mb-4">Add New Book</h2>
          <form id="addBookForm" onSubmit={handleAddBook} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Unique ID (e.g. math-101)" required value={newBook.id} onChange={e => setNewBook({...newBook, id: e.target.value})} className="border border-[#E5E1DA] p-2 text-sm focus:outline-none focus:border-[#1A1A1A]"/>
            <input type="text" placeholder="Title" required value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} className="border border-[#E5E1DA] p-2 text-sm focus:outline-none focus:border-[#1A1A1A]"/>
            <input type="text" placeholder="Price (e.g. 5.00)" required value={newBook.price} onChange={e => setNewBook({...newBook, price: e.target.value})} className="border border-[#E5E1DA] p-2 text-sm focus:outline-none focus:border-[#1A1A1A] md:col-span-2"/>
            <textarea placeholder="Description" required value={newBook.description} onChange={e => setNewBook({...newBook, description: e.target.value})} className="border border-[#E5E1DA] p-2 text-sm focus:outline-none focus:border-[#1A1A1A] md:col-span-2" rows={3}></textarea>
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-1">Upload Full PDF Book</label>
              <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} className="w-full text-xs text-[#8C857D] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-[#E5E1DA] file:text-[#1A1A1A] hover:file:bg-[#1A1A1A] hover:file:text-white transition-colors cursor-pointer"/>
            </div>
            
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#E5E1DA]">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold mb-1">Cover Image</label>
                <input type="file" accept="image/*" onChange={e => setCoverImage(e.target.files?.[0] || null)} className="w-full text-xs text-[#8C857D] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-[#E5E1DA] file:text-[#1A1A1A] hover:file:bg-[#1A1A1A] hover:file:text-white transition-colors cursor-pointer"/>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold mb-1">Preview Page 1</label>
                <input type="file" accept="image/*" onChange={e => setPreviewPage1(e.target.files?.[0] || null)} className="w-full text-xs text-[#8C857D] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-[#E5E1DA] file:text-[#1A1A1A] hover:file:bg-[#1A1A1A] hover:file:text-white transition-colors cursor-pointer"/>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold mb-1">Preview Page 2</label>
                <input type="file" accept="image/*" onChange={e => setPreviewPage2(e.target.files?.[0] || null)} className="w-full text-xs text-[#8C857D] file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-[#E5E1DA] file:text-[#1A1A1A] hover:file:bg-[#1A1A1A] hover:file:text-white transition-colors cursor-pointer"/>
              </div>
            </div>

            <button type="submit" disabled={addingBook} className="md:col-span-2 bg-[#1A1A1A] hover:bg-black text-white py-3 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 mt-4">
              {addingBook ? 'Adding...' : 'Add Book'}
            </button>
          </form>
        </div>

       <div className="mb-16">
          <h2 className="text-xl font-serif italic mb-4">Pending Orders</h2>
          {loading && <p className="text-[#8C857D] italic">Loading orders...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && orders.length === 0 && (
             <p className="text-[#8C857D] italic border border-[#E5E1DA] p-6 bg-[#FDFCFB]">No pending orders at this time.</p>
          )}
          
          <div className="grid gap-4">
            {orders.map(order => (
               <div key={order.id} className="border border-[#E5E1DA] p-6 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                 <div>
                   <p className="text-[10px] uppercase tracking-widest font-bold text-[#8C857D] mb-1">Order #{order.id.slice(-8)}</p>
                   <p className="font-serif text-xl italic mb-1">{order.customerName}</p>
                   <p className="text-sm font-semibold text-[#0B1426] mb-1">Book: {order.bookTitle || order.bookId}</p>
                   <p className="text-sm text-[#4A4540]">{order.customerEmail}</p>
                   <p className="text-sm mt-2"><strong className="text-[#1A1A1A]">bKash Ref:</strong> <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{order.bkashReference}</span></p>
                 </div>
                 <button 
                   onClick={() => handleApprove(order)}
                   className="shrink-0 bg-[#1A1A1A] hover:bg-black text-white px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors"
                 >
                   Approve & Email
                 </button>
               </div>
            ))}
          </div>
       </div>
    </div>
  );
}
