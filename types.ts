
export enum OrderStatus {
  PENDING = 'Chờ xử lý',
  PLACED = 'Đã lên đơn',
  PROCESSING = 'Đang xử lý',
  PRINTED = 'Đã in bill',
  PACKED = 'Đã đóng hàng',
  SENT = 'Đã gửi',
  DELIVERED = 'Đã giao thành công',
  CANCELLED = 'Đã hủy',
  RETURNED = 'Trả hàng',
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string; // Mã đơn hàng (Cột A)
  rowIndex?: number; // Số thứ tự dòng trong Google Sheet (Dùng để định danh khi sửa/xóa)
  trackingCode?: string; // Mã vận chuyển
  carrier?: string; // Đơn vị vận chuyển
  
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  address?: string; // Địa chỉ
  
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  paymentMethod: 'COD' | 'Banking' | 'Credit Card';
  
  platform?: 'Shopee' | 'Lazada' | 'TikTok' | 'Zalo' | 'Facebook';
  note?: string; // Ghi chú (Đơn thường, Đơn hỏa tốc)
  deliveryDeadline?: string; // Thời gian giao hàng (Ví dụ: Trước 23h59p)
  templateStatus?: string; // Mẫu (Ví dụ: Có mẫu)
}

export type ViewState = 'dashboard' | 'orders' | 'customers' | 'settings';

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  avgOrderValue: number;
}

// --- AUTH TYPES ---

export type Role = 'admin' | 'user' | string;

export type Permission = 
  | 'view_dashboard'
  | 'view_orders'
  | 'add_orders'      // Mới: Thêm đơn
  | 'edit_orders'     // Mới: Sửa đơn/trạng thái
  | 'delete_orders'   // Mới: Xóa đơn
  | 'view_customers'
  | 'view_settings_personal' // Mới: Cài đặt cá nhân
  | 'view_settings_admin'    // Mới: Cài đặt hệ thống (Admin)
  | 'view_settings_roles';   // Mới: Quản lý tên vai trò

export interface User {
  username: string;
  password?: string; // Trong thực tế nên hash, ở đây lưu localstorage demo
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
}
