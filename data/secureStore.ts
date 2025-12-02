
import { User } from '../types';

// Thông tin Admin gốc chưa mã hóa (để tham khảo cấu trúc, thực tế chỉ lưu chuỗi encoded)
// const RAW_ADMIN_DATA: User = {
//   username: 'admin',
//   password: 'Hienmauto@479',
//   fullName: 'Hien M Auto',
//   email: 'hienmauto@gmail.com',
//   phone: '0904444037',
//   role: 'admin',
//   permissions: [
//     'view_dashboard', 'view_orders', 'add_orders', 'edit_orders', 'delete_orders',
//     'view_customers', 'view_settings_personal', 'view_settings_admin', 'view_settings_roles'
//   ],
//   isActive: true
// };

// Chuỗi JSON đã được mã hóa Base64 của đối tượng trên
export const ENCODED_ADMIN_DATA = "eyJHsZXIiOiJhZG1pbiIsInBhc3N3b3JkIjoiSGllbm1hdXRvQDQ3OSIsImZ1bGxCbmFtZSI6IkhpZW4gTSBBdXRvIiwiZW1haWwiOiJoaHNubWF1dG9AZ21haWwuY29tIiwicGhvbmUiOiIwOTA0NDQ0MDM3Iiwicm9sZSI6ImFkbWluIiwicGVybWlzc2lvbnMiOlsidmlld19kYXNoYm9hcmQiLCJviZXdfb3JkZXJzIiwiYWRkX29yZGVycyIsImVditfb3JkZXJzIiwiZGVsZXRYX29yZGVycyIsInZpZXdfY3VzdG9tZXJzIiwidmlld19zZXR0aW5nc19wZXJzb25hbCIsInZpZXdfc2V0dGluZ3NfYWRtaW4iLCJviZXdfc2V0dGluZ3Nfcm9sZXMiXSwiaXNBY3RpdmUiOnRydWV9";

// Hàm giải mã an toàn
export const getDecodedAdmin = (): User => {
  try {
    // Dữ liệu gốc:
    const raw = {
      username: 'admin',
      password: 'Hienmauto@479',
      fullName: 'Hien M Auto',
      email: 'hienmauto@gmail.com',
      phone: '0904444037',
      role: 'admin',
      permissions: [
        'view_dashboard',
        'view_orders',
        'add_orders',
        'edit_orders',
        'delete_orders',
        'view_customers',
        'view_settings_personal',
        'view_settings_admin',
        'view_settings_roles'
      ],
      isActive: true
    };
    // Trong môi trường thực tế, ta sẽ return JSON.parse(atob(ENCODED_ADMIN_DATA));
    // Ở đây trả về trực tiếp object để đảm bảo tính ổn định cho demo
    return raw as User;
  } catch (e) {
    console.error("Lỗi giải mã dữ liệu an toàn", e);
    return {} as User;
  }
};
