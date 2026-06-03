import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'super-secret-mazed-key-change-in-prod'; // Keep this simple for now

// Placeholder Client ID for local dev if they don't have one
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || '1067207455823-placeholder-client-id.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Set up static serving for uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // Standard configuration for Gmail
  auth: {
    user: process.env.EMAIL_USER || 'hasanmazedbooks@gmail.com',
    pass: process.env.EMAIL_PASS || ''
  }
});

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

let db;

// Database Setup
async function setupDatabase() {
  const dbPath = path.join(__dirname, 'database.sqlite');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price TEXT NOT NULL,
      coverUrl TEXT NOT NULL,
      previewContent TEXT NOT NULL,
      downloadUrl TEXT NOT NULL,
      previewPage1Url TEXT,
      previewPage2Url TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      bookId TEXT NOT NULL,
      bkashReference TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER NOT NULL,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      bookId TEXT NOT NULL,
      orderId TEXT NOT NULL,
      UNIQUE(userId, bookId)
    );
  `);
  
  // Try to alter existing table safely if columns don't exist
  try {
    await db.exec('ALTER TABLE books ADD COLUMN previewPage1Url TEXT');
    await db.exec('ALTER TABLE books ADD COLUMN previewPage2Url TEXT');
  } catch (e) {
    // Columns might already exist, safe to ignore
  }
  
  console.log('Database initialized at', dbPath);
}

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  // Make mazedcu@gmail.com and mazedbooks@gmail.com admins automatically
  const isAdmin = ['mazedcu@gmail.com', 'mazedbooks@gmail.com'].includes(email.toLowerCase());
  const role = isAdmin ? 'admin' : 'user';

  try {
    const result = await db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, role]
    );
    const user = { id: result.lastID, email, name, role };
    const token = jwt.sign(user, JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
  
  if (user) {
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
  if (user) {
    res.json({ user });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/auth/setup-account', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'setup') return res.status(400).json({ error: 'Invalid token type' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.run('UPDATE users SET password = ? WHERE id = ?', [password, user.id]);

    const authToken = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
    res.json({ token: authToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired setup token' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    // Return success even if user not found to prevent email enumeration
    return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  }

  // Create a reset token that expires in 15 minutes
  const resetToken = jwt.sign({ id: user.id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' });
  
  const resetLink = `${process.env.FRONTEND_URL || 'https://hasanmazedbooks.xyz'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'mazed.insight@gmail.com',
    to: user.email,
    subject: 'Password Reset - Mazed Books',
    text: `Hello ${user.name},\n\nYou requested a password reset. Please click the link below to set a new password:\n\n${resetLink}\n\nThis link will expire in 15 minutes.\n\nThank you,\nMazed Educational Publications`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'reset') return res.status(400).json({ error: 'Invalid token type' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.run('UPDATE users SET password = ? WHERE id = ?', [password, user.id]);

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired reset token' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(400).json({ error: 'Invalid Google token' });
    
    const { email, name } = payload;
    
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      // Auto-register
      const isAdmin = ['mazedcu@gmail.com', 'mazedbooks@gmail.com'].includes(email.toLowerCase());
      const role = isAdmin ? 'admin' : 'user';
      // Use a random password since they login via Google
      const randomPassword = Math.random().toString(36).slice(-10);
      const result = await db.run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, randomPassword, role]
      );
      user = { id: result.lastID, email, name, role };
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// --- BOOKS ROUTES ---
app.get('/api/books', async (req, res) => {
  // Public route, but we hide downloadUrl
  const books = await db.all('SELECT id, title, description, price, coverUrl, previewContent, previewPage1Url, previewPage2Url FROM books');
  res.json(books);
});

app.post('/api/books/seed', authenticate, requireAdmin, async (req, res) => {
  const MAZED_BOOKS = req.body.books || [];
  try {
    for (const book of MAZED_BOOKS) {
      await db.run(
        'INSERT OR IGNORE INTO books (id, title, description, price, coverUrl, previewContent, downloadUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [book.id, book.title, book.description, book.price, book.coverUrl, book.previewContent, book.downloadUrl]
      );
    }
    res.json({ success: true, message: 'Books seeded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books', authenticate, requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'previewPage1', maxCount: 1 },
  { name: 'previewPage2', maxCount: 1 },
  { name: 'pdfFile', maxCount: 1 }
]), async (req, res) => {
  const { id, title, description, price, previewContent } = req.body;
  const files = req.files || {};
  
  let finalCoverUrl = req.body.coverUrl || '';
  if (files['coverImage'] && files['coverImage'].length > 0) {
    finalCoverUrl = '/uploads/' + files['coverImage'][0].filename;
  }
  
  let previewPage1Url = null;
  if (files['previewPage1'] && files['previewPage1'].length > 0) {
    previewPage1Url = '/uploads/' + files['previewPage1'][0].filename;
  }
  
  let previewPage2Url = null;
  if (files['previewPage2'] && files['previewPage2'].length > 0) {
    previewPage2Url = '/uploads/' + files['previewPage2'][0].filename;
  }
  
  let finalDownloadUrl = req.body.downloadUrl || '';
  if (files['pdfFile'] && files['pdfFile'].length > 0) {
    finalDownloadUrl = '/uploads/' + files['pdfFile'][0].filename;
  }

  try {
    await db.run(
      'INSERT INTO books (id, title, description, price, coverUrl, previewContent, downloadUrl, previewPage1Url, previewPage2Url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id || `book-${Date.now()}`, title, description, price, finalCoverUrl, previewContent || '', finalDownloadUrl, previewPage1Url, previewPage2Url]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
       res.status(400).json({ error: 'A book with this ID already exists.' });
    } else {
       res.status(500).json({ error: err.message });
    }
  }
});

app.put('/api/books/:id', authenticate, requireAdmin, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'previewPage1', maxCount: 1 },
  { name: 'previewPage2', maxCount: 1 },
  { name: 'pdfFile', maxCount: 1 }
]), async (req, res) => {
  const bookId = req.params.id;
  const { title, description, price, previewContent } = req.body;
  const files = req.files || {};
  
  try {
    const existingBook = await db.get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!existingBook) return res.status(404).json({ error: 'Book not found' });

    let finalCoverUrl = existingBook.coverUrl;
    if (files['coverImage'] && files['coverImage'].length > 0) {
      finalCoverUrl = '/uploads/' + files['coverImage'][0].filename;
      if (existingBook.coverUrl) {
         fs.unlink(path.join(__dirname, existingBook.coverUrl), (err) => { if (err) console.error("Error deleting old cover:", err); });
      }
    }
    
    let previewPage1Url = existingBook.previewPage1Url;
    if (files['previewPage1'] && files['previewPage1'].length > 0) {
      previewPage1Url = '/uploads/' + files['previewPage1'][0].filename;
      if (existingBook.previewPage1Url) {
         fs.unlink(path.join(__dirname, existingBook.previewPage1Url), (err) => { if (err) console.error("Error deleting old preview 1:", err); });
      }
    }
    
    let previewPage2Url = existingBook.previewPage2Url;
    if (files['previewPage2'] && files['previewPage2'].length > 0) {
      previewPage2Url = '/uploads/' + files['previewPage2'][0].filename;
      if (existingBook.previewPage2Url) {
         fs.unlink(path.join(__dirname, existingBook.previewPage2Url), (err) => { if (err) console.error("Error deleting old preview 2:", err); });
      }
    }
    
    let finalDownloadUrl = existingBook.downloadUrl;
    if (files['pdfFile'] && files['pdfFile'].length > 0) {
      finalDownloadUrl = '/uploads/' + files['pdfFile'][0].filename;
      if (existingBook.downloadUrl) {
         fs.unlink(path.join(__dirname, existingBook.downloadUrl), (err) => { if (err) console.error("Error deleting old pdf:", err); });
      }
    }

    await db.run(
      'UPDATE books SET title = ?, description = ?, price = ?, coverUrl = ?, previewContent = ?, downloadUrl = ?, previewPage1Url = ?, previewPage2Url = ? WHERE id = ?',
      [title, description, price, finalCoverUrl, previewContent || '', finalDownloadUrl, previewPage1Url, previewPage2Url, bookId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/books/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const existingBook = await db.get('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (!existingBook) return res.status(404).json({ error: 'Book not found' });
    
    // Delete files physically
    const filesToDelete = [existingBook.coverUrl, existingBook.previewPage1Url, existingBook.previewPage2Url, existingBook.downloadUrl];
    for (const fileUrl of filesToDelete) {
      if (fileUrl && fileUrl.startsWith('/uploads/')) {
        fs.unlink(path.join(__dirname, fileUrl), (err) => {
          if (err && err.code !== 'ENOENT') console.error("Error deleting file:", err);
        });
      }
    }

    await db.run('DELETE FROM books WHERE id = ?', [req.params.id]);
    // Optionally delete from purchases and orders related to this book, or leave them for history.
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORDERS ROUTES ---
app.post('/api/orders', async (req, res) => {
  const { id, bookId, bkashReference, customerName, customerEmail } = req.body;
  
  // Try to find if user exists to link immediately, otherwise link to 0 (guest)
  let user = await db.get('SELECT id FROM users WHERE email = ?', [customerEmail]);
  const userId = user ? user.id : 0; 
  
  // Check for duplicate pending orders
  const existingOrder = await db.get('SELECT id, status FROM orders WHERE customerEmail = ? AND bookId = ?', [customerEmail, bookId]);
  if (existingOrder) {
    if (existingOrder.status === 'pending') {
      return res.status(400).json({ error: 'You already have a pending order for this book. Please wait for approval.' });
    } else {
      return res.status(400).json({ error: 'You have already purchased this book. Please log in to access it.' });
    }
  }

  // Check if they already have it in purchases
  if (userId !== 0) {
    const existingPurchase = await db.get('SELECT * FROM purchases WHERE userId = ? AND bookId = ?', [userId, bookId]);
    if (existingPurchase) {
       return res.status(400).json({ error: 'You have already purchased this book. Please log in to access it.' });
    }
  }
  
  try {
    await db.run(
      'INSERT INTO orders (id, userId, bookId, bkashReference, status, createdAt, customerName, customerEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, bookId, bkashReference, 'pending', Date.now(), customerName, customerEmail]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', authenticate, requireAdmin, async (req, res) => {
  const orders = await db.all(`
    SELECT orders.*, books.title as bookTitle 
    FROM orders 
    LEFT JOIN books ON orders.bookId = books.id 
    WHERE orders.status = "pending"
  `);
  res.json(orders);
});

app.put('/api/orders/:id/approve', authenticate, requireAdmin, async (req, res) => {
  const orderId = req.params.id;
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Order already processed' });
  
  try {
    let userId = order.userId;
    let setupToken = null;
    let bookTitle = '';
    
    // Create account if guest
    if (userId === 0) {
      // Instead of password, insert empty string or placeholder. Password will be set via setup token.
      const result = await db.run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [order.customerName, order.customerEmail, 'PENDING_SETUP', 'user']
      );
      userId = result.lastID;
      
      // Generate setup token (expires in 7 days)
      setupToken = jwt.sign({ id: userId, email: order.customerEmail, purpose: 'setup' }, JWT_SECRET, { expiresIn: '7d' });
    } else {
       // If user already exists and we just want them to log in normally, we can return null for setupToken
       // or we could let them reset it, but normally they just log in.
    }
    
    // Update order
    await db.run('UPDATE orders SET status = "approved", userId = ? WHERE id = ?', [userId, orderId]);
    
    // Create purchase record
    await db.run('INSERT OR IGNORE INTO purchases (userId, bookId, orderId) VALUES (?, ?, ?)', [userId, order.bookId, orderId]);
    
    // Get book info
    const book = await db.get('SELECT title, downloadUrl FROM books WHERE id = ?', [order.bookId]);
    if (book) bookTitle = book.title;

    // Send the email
    const subject = `Your Book Purchase Approved - ${bookTitle || order.bookId}`;
    let bodyText = `Dear ${order.customerName},\n\n`;
    bodyText += `Congrats, you just purchased '${bookTitle || order.bookId}'.\n\n`;
    
    if (setupToken) {
      bodyText += `Click below to set your password and access your book:\n`;
      const frontendUrl = process.env.FRONTEND_URL || 'https://hasanmazedbooks.xyz';
      bodyText += `${frontendUrl}/setup-account?token=${setupToken}\n\n`;
    } else {
      bodyText += `Your payment for the bKash reference ${order.bkashReference} has been approved.\n`;
      bodyText += `You can access this book anytime by logging into your profile using your email: ${order.customerEmail}.\n\n`;
    }
    
    bodyText += `Best Regards,\nMohammad Hasan Mazed`;

    let emailSent = false;
    if (process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'hasanmazedbooks@gmail.com',
          to: order.customerEmail,
          subject: subject,
          text: bodyText
        });
        emailSent = true;
      } catch (err) {
        console.error("Failed to send email:", err);
      }
    } else {
      console.warn("EMAIL_PASS not set in environment. Email not sent automatically.");
      console.log("Email content that would have been sent:\n", bodyText);
    }
    
    res.json({
      success: true,
      emailSent,
      downloadUrl: book ? book.downloadUrl : '',
      setupToken,
      bookTitle,
      userId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LIBRARY ROUTE ---
app.get('/api/users/me/library', authenticate, async (req, res) => {
  const userId = req.user.id;
  const library = await db.all(`
    SELECT b.id, b.title, b.coverUrl, b.downloadUrl, p.orderId
    FROM purchases p
    JOIN books b ON p.bookId = b.id
    WHERE p.userId = ?
  `, [userId]);
  
  res.json(library);
});

// --- USER ORDERS ROUTE ---
app.get('/api/users/me/orders', authenticate, async (req, res) => {
  const userId = req.user.id;
  const orders = await db.all('SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC', [userId]);
  res.json(orders);
});

// Start Server
setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server", err);
});
