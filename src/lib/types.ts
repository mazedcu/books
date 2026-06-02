export interface User {
  id: string;
  name: string;
  email: string;
  // admin role checked via email
}

export interface Purchase {
  bookId: string;
  orderId: string;
}

export interface Book {
  id: string;
  title: string;
  description: string;
  price: string;
  coverUrl: string;
  previewContent: string;
  previewPage1Url?: string;
  previewPage2Url?: string;
}

export interface BookContent {
  downloadUrl: string;
}

export interface Order {
  id: string;
  userId: string;
  bookId: string;
  bkashReference: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  customerName: string;
  customerEmail: string;
}
