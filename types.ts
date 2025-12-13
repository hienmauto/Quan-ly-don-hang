

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

export type ViewState = 'dashboard' | 'orders' | 'customers' | 'tasco' | 'summary' | 'settings';

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  avgOrderValue: number;
}

// --- SUMMARY TYPES ---
// Updated: Platform is now just a string to allow custom platforms
export type Platform = string;

export interface PlatformMetrics {
  totalRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  cancelledAmount: number;
  returnedAmount: number;
  adSpend: number;
}

export interface SummaryRecord extends PlatformMetrics {
  monthKey: string; // Format: YYYY-MM
  platform: Platform;
  rowIndex?: number;
}

// --- AUTH TYPES ---

export type Role = 'admin' | 'user' | string;

export type Permission = 
  | 'view_dashboard'  // Mới: Xem dashboard
  | 'view_orders'     // Mới: Xem danh sách đơn hàng
  | 'add_orders'      // Mới: Thêm đơn
  | 'edit_orders'     // Mới: Sửa đơn/trạng thái
  | 'view_customers'
  | 'view_tasco'      // Mới: Xem trang Tasco
  | 'add_tasco'       // Mới: Thêm Tasco
  | 'edit_tasco'      // Mới: Sửa Tasco
  | 'delete_tasco'    // Mới: Xóa Tasco
  | 'view_summary'    // Mới: Xem trang tổng kết
  | 'edit_summary'    // Mới: Sửa trang tổng kết
  | 'view_settings_personal' // Mới: Cài đặt cá nhân
  | 'view_settings_admin'    // Mới: Cài đặt hệ thống (Admin)
  | 'view_settings_roles';   // Mới: Quản lý tên vai trò

// Danh sách tất cả các quyền (Dùng để gán full quyền cho Admin)
export const ALL_PERMISSIONS: Permission[] = [
  'view_dashboard',
  'view_orders',
  'add_orders',
  'edit_orders',
  'view_customers',
  'view_tasco',
  'add_tasco',
  'edit_tasco',
  'delete_tasco',
  'view_summary',
  'edit_summary',
  'view_settings_personal',
  'view_settings_admin',
  'view_settings_roles'
];

export interface User {
  username: string;
  password?: string; // Trong thực tế nên hash, ở đây lưu localstorage demo
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  rowIndex?: number; // Số dòng trong Google Sheet để định danh khi sửa/xóa
}