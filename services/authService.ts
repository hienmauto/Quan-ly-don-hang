import { User, Permission } from '../types';

const USERS_KEY = 'app_users';
const CURRENT_USER_KEY = 'app_current_user';
const ROLES_KEY = 'app_roles';

const ADMIN_USER: User = {
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

const isBrowser = () => typeof window !== 'undefined' && window.localStorage;

export const checkPasswordComplexity = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return {
      valid: false,
      message: 'Mật khẩu phải bao gồm: Chữ hoa, chữ thường, số và ký tự đặc biệt.'
    };
  }
  return { valid: true };
};

const initializeUsers = () => {
  if (isBrowser()) {
    const usersJson = localStorage.getItem(USERS_KEY);
    if (!usersJson) {
      localStorage.setItem(USERS_KEY, JSON.stringify([ADMIN_USER]));
    } else {
      const users: User[] = JSON.parse(usersJson);
      const adminIndex = users.findIndex(u => u.username === 'admin');
      if (adminIndex === -1) {
        users.push(ADMIN_USER);
      } else {
        users[adminIndex] = {
          ...users[adminIndex],
          password: ADMIN_USER.password,
          email: ADMIN_USER.email,
          permissions: ADMIN_USER.permissions
        };
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
};

const initializeRoles = () => {
  if (isBrowser()) {
    const rolesJson = localStorage.getItem(ROLES_KEY);
    if (!rolesJson) {
      const defaultRoles = ['admin', 'user'];
      localStorage.setItem(ROLES_KEY, JSON.stringify(defaultRoles));
    }
  }
};

export const login = async (username: string, password: string, remember: boolean): Promise<User | null> => {
  if (isBrowser()) {
    initializeUsers();
    initializeRoles();
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    if (user && user.isActive) {
      const { password, ...safeUser } = user;
      const userData = JSON.stringify(safeUser);
      if (remember) {
        localStorage.setItem(CURRENT_USER_KEY, userData);
        sessionStorage.removeItem(CURRENT_USER_KEY);
      } else {
        sessionStorage.setItem(CURRENT_USER_KEY, userData);
        localStorage.removeItem(CURRENT_USER_KEY);
      }
      return safeUser as User;
    }
  }
  return null;
};

export const logout = () => {
  if (isBrowser()) {
    localStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
  }
};

export const getCurrentUser = (): User | null => {
  if (isBrowser()) {
    const userLocal = localStorage.getItem(CURRENT_USER_KEY);
    const userSession = sessionStorage.getItem(CURRENT_USER_KEY);
    const userJson = userLocal || userSession;
    return userJson ? JSON.parse(userJson) : null;
  }
  return null;
};

export const getRoles = (): string[] => {
  if (isBrowser()) {
    initializeRoles();
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const userRoles = users.map(u => u.role);
    const storedRoles: string[] = JSON.parse(localStorage.getItem(ROLES_KEY) || '[]');
    const allRoles = Array.from(new Set([...storedRoles, ...userRoles]));
    return allRoles;
  }
  return [];
};

export const addRole = (roleName: string): { success: boolean, message: string } => {
  if (isBrowser()) {
    const roles = getRoles();
    if (roles.includes(roleName)) {
      return { success: false, message: 'Vai trò đã tồn tại' };
    }
    roles.push(roleName);
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
    return { success: true, message: 'Thêm vai trò thành công' };
  }
  return { success: false, message: 'LocalStorage is not available' };
};

export const deleteRole = (roleName: string): { success: boolean, message: string } => {
  if (isBrowser()) {
    if (roleName === 'admin' || roleName === 'user') {
      return { success: false, message: 'Không thể xóa vai trò mặc định' };
    }
    let roles = getRoles();
    roles = roles.filter(r => r !== roleName);
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
    return { success: true, message: 'Xóa vai trò thành công' };
  }
  return { success: false, message: 'LocalStorage is not available' };
};

export const getAllUsers = (): User[] => {
  if (isBrowser()) {
    initializeUsers();
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return users.map(({ password, ...u }) => u as User);
  }
  return [];
};

export const addUser = (newUser: User): { success: boolean, message: string } => {
  if (isBrowser()) {
    if (newUser.password) {
      const complexity = checkPasswordComplexity(newUser.password);
      if (!complexity.valid) return { success: false, message: complexity.message || 'Mật khẩu yếu' };
    }
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (users.some(u => u.username === newUser.username)) {
      return { success: false, message: 'Tên đăng nhập đã tồn tại!' };
    }
    const currentRoles = getRoles();
    if (!currentRoles.includes(newUser.role)) {
      addRole(newUser.role);
    }
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { success: true, message: 'Thêm tài khoản thành công' };
  }
  return { success: false, message: 'LocalStorage is not available' };
};

export const updateUser = (username: string, updates: Partial<User>): { success: boolean, message: string } => {
  if (isBrowser()) {
    if (updates.password) {
      const complexity = checkPasswordComplexity(updates.password);
      if (!complexity.valid) return { success: false, message: complexity.message || 'Mật khẩu yếu' };
    }
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const index = users.findIndex(u => u.username === username);
    if (index === -1) return { success: false, message: 'Không tìm thấy người dùng' };
    if (updates.role) {
      const currentRoles = getRoles();
      if (!currentRoles.includes(updates.role)) {
        addRole(updates.role);
      }
    }
    users[index] = { ...users[index], ...updates };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.username === username) {
      const { password, ...safeUser } = users[index];
      if (localStorage.getItem(CURRENT_USER_KEY)) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
      } else {
        sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
      }
    }
    return { success: true, message: 'Cập nhật thành công' };
  }
  return { success: false, message: 'LocalStorage is not available' };
};

export const deleteUser = (username: string): { success: boolean, message: string } => {
  if (isBrowser()) {
    if (username === 'admin') return { success: false, message: 'Không thể xóa Super Admin' };
    let users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    users = users.filter(u => u.username !== username);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { success: true, message: 'Xóa tài khoản thành công' };
  }
  return { success: false, message: 'LocalStorage is not available' };
};

export const resetUserPassword = (username: string, newPass: string): { success: boolean, message: string } => {
  if (isBrowser()) {
    const complexity = checkPasswordComplexity(newPass);
    if (!complexity.valid) return { success: false, message: complexity.message || 'Mật khẩu yếu' };
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const index = users.findIndex(u => u.username === username);
    if (index === -1) return { success: false, message: 'Không tìm thấy người dùng' };
    users[index].password = newPass;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return { success: true, message: 'Reset mật khẩu thành công' };
  }
  return { success: false, message: 'LocalStorage is not available' };
};