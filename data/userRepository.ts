
import { User, ALL_PERMISSIONS } from '../types';

const USERS_KEY = 'app_users';

// Admin mặc định (Lưu trữ tập trung tại đây)
export const DEFAULT_ADMIN: User = {
  username: 'admin',
  password: 'Hienmauto@479',
  fullName: 'Hien M Auto',
  email: 'hienmauto@gmail.com',
  phone: '0904444037',
  role: 'admin',
  permissions: ALL_PERMISSIONS, // Luôn luôn là full quyền
  isActive: true
};

const isBrowser = () => typeof window !== 'undefined' && window.localStorage;

// Đảm bảo dữ liệu người dùng được khởi tạo và đồng bộ
const ensureInitialized = () => {
  if (!isBrowser()) return;
  
  const usersJson = localStorage.getItem(USERS_KEY);
  if (!usersJson) {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
  } else {
    // Đồng bộ quyền hạn cho Admin nếu code có thay đổi
    let users: User[] = JSON.parse(usersJson);
    const adminIndex = users.findIndex(u => u.username === DEFAULT_ADMIN.username);
    
    if (adminIndex === -1) {
      users.unshift(DEFAULT_ADMIN);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else {
      const currentAdmin = users[adminIndex];
      // Luôn cập nhật permissions của Admin trong localStorage theo ALL_PERMISSIONS mới nhất trong code
      // Bất kể quyền cũ là gì, Admin luôn phải có quyền mới nhất
      currentAdmin.permissions = ALL_PERMISSIONS; 
      
      users[adminIndex] = currentAdmin;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
};

export const getStoredUsers = (): User[] => {
  if (!isBrowser()) return [DEFAULT_ADMIN];
  ensureInitialized();
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return users;
  } catch (e) {
    console.error("Error parsing users from storage", e);
    return [DEFAULT_ADMIN];
  }
};

export const saveStoredUsers = (users: User[]) => {
  if (!isBrowser()) return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};