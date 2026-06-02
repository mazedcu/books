import { useEffect, useState } from 'react';
import { Book } from '../lib/types';
import { Link } from 'react-router-dom';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const res = await fetch('/api/books');
        const data = await res.json();
        setBooks(data);
      } catch (error) {
        console.error("Failed to fetch books", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooks();
  }, []);

  if (loading) {
    return (
      <div className="p-8 sm:p-12 max-w-5xl">
        <div className="mb-10">
          <div className="skeleton h-6 w-40 rounded mb-2" />
          <div className="skeleton h-4 w-64 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="skeleton aspect-[3/4] rounded-lg mb-4" />
              <div className="skeleton h-5 rounded w-3/4 mb-2" />
              <div className="skeleton h-4 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 sm:p-12 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-[2px]" style={{ background: 'linear-gradient(90deg, #00D4AA, transparent)' }} />
          <span className="tag-science">Science & Technology</span>
        </div>
        <h1 className="text-3xl font-bold text-[#0F172A] mb-2">
          The Collection
        </h1>
        <p className="text-sm text-[#94A3B8]">
          Educational e-books designed to make complex science accessible for young readers.
        </p>
      </div>

      {books.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8ECF1] p-16 text-center relative circuit-corner">
          <p className="text-lg font-semibold text-[#0F172A] mb-1">No books available yet</p>
          <p className="text-sm text-[#94A3B8]">New titles are coming soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {books.map((book, i) => (
            <Link to={`/book/${book.id}`} key={book.id}
                  className="book-card group flex flex-col animate-fade-in"
                  style={{ animationDelay: `${i * 0.08}s` }}>
              {/* Cover */}
              <div className="aspect-[3/4] overflow-hidden bg-[#F1F5F9] relative">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title}
                       className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                       style={{ background: 'linear-gradient(135deg, #0B1426 0%, #1C2D4F 100%)' }}>
                    <span className="text-4xl font-bold" style={{ color: 'rgba(0,212,170,0.3)' }}>{book.title[0]}</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-[#0B1426]/0 group-hover:bg-[#0B1426]/20 transition-colors duration-400" />
                {/* Price */}
                <div className="absolute top-3 right-3">
                  <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded"
                        style={{ background: 'rgba(11,20,38,0.75)', backdropFilter: 'blur(8px)' }}>
                    {book.price} BDT
                  </span>
                </div>
              </div>
              {/* Info */}
              <div className="p-5 flex-grow flex flex-col">
                <h3 className="text-[15px] font-bold text-[#0F172A] mb-1.5 leading-tight group-hover:text-[#1C2D4F] transition-colors">
                  {book.title}
                </h3>
                <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed mb-4 flex-grow">
                  {book.description}
                </p>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <span className="text-[11px] font-medium text-[#94A3B8]">By Hasan Mazed</span>
                  <span className="text-[11px] font-semibold group-hover:text-[#00D4AA] text-[#94A3B8] transition-colors">
                    View →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
