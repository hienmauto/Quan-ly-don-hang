import { User, Permission } from '../types';

const USERS_KEY = 'app_users';
const CURRENT_USER_KEY = 'app_current_user';
const ROLES_KEY = 'app_roles'; // Key mới để lưu danh sách vai trò

const ADMIN_USER: User = {
  username: 'admin',
  password: 'Hienmauto@479', 
  fullName: 'Super Admin',
  email: 'hienmauto@gmail.com',
  phone: '0900000000',
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

// Hàm kiểm tra độ mạnh mật khẩu
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

// Khởi tạo dữ liệu người dùng
const initializeUsers = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const usersJson = localStorage.getItem(USERS_KEY);
        if (!usersJson) {
            localStorage.setItem(USERS_KEY, JSON.stringify([ADMIN_USER]));
        } else {
            const users: User[] = JSON.parse(usersJson);
            const adminIndex = users.findIndex(u => u.username === 'admin');
            if (adminIndex === -1) {
                users.push(ADMIN_USER);
            } else {
                // Đảm bảo admin luôn có đủ quyền mới nhất
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

// Khởi tạo danh sách vai trò
const initializeRoles = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const rolesJson = localStorage.getItem(ROLES_KEY);
        if (!rolesJson) {
            const defaultRoles = ['admin', 'user'];
            localStorage.setItem(ROLES_KEY, JSON.stringify(defaultRoles));
        }
    }
};

export const login = async (username: string, password: string, remember: boolean): Promise<User | null> => {
  initializeUsers();
  initializeRoles();
  if (typeof window !== 'undefined' && window.localStorage) {
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user && user.isActive) {
      const { password, ...safeUser } = user;
      const userData = JSON.stringify(safeUser);
      
      // Logic Remember Me:
      // - Nếu remember = true: Lưu vào localStorage (tồn tại lâu dài)
      // - Nếu remember = false: Lưu vào sessionStorage (mất khi đóng tab/browser)
      if (remember) {
        localStorage.setItem(CURRENT_USER_KEY, userData);
        sessionStorage.removeItem(CURRENT_USER_KEY); // Clear session to avoid dupes
      } else {
        sessionStorage.setItem(CURRENT_USER_KEY, userData);
        localStorage.removeItem(CURRENT_USER_KEY); // Clear local to avoid auto login next time
      }
      
      return safeUser as User;
    }
  }
  return null;
};

export const logout = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(CURRENT_USER_KEY);
        sessionStorage.removeItem(CURRENT_USER_KEY);
    }
};

export const getCurrentUser = (): User | null => {
  // Ưu tiên check localStorage trước, sau đó đến sessionStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const userLocal = localStorage.getItem(CURRENT_USER_KEY);
    const userSession = sessionStorage.getItem(CURRENT_USER_KEY);
    
    const userJson = userLocal || userSession;
    return userJson ? JSON.parse(userJson) : null;
  }
  return null;
};

// --- ROLES MANAGEMENT ---

export const getRoles = (): string[] => {
  initializeRoles();
  if (typeof window !== 'undefined' && window.localStorage) {
    // Lấy thêm role từ user hiện tại để đảm bảo tính đồng bộ nếu có user đang dùng role cũ
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const userRoles = users.map(u => u.role);
    
    const storedRoles: string[] = JSON.parse(localStorage.getItem(ROLES_KEY) || '[]');
    
    // Merge unique roles
    const allRoles = Array.from(new Set([...storedRoles, ...userRoles]));
    return allRoles;
  }
  return [];
};

export const addRole = (roleName: string): { success: boolean, message: string } => {
    if (typeof window !== 'undefined' && window.localStorage) {
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
    if (typeof window !== 'undefined' && window.localStorage) {
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

// --- USER MANAGEMENT (Admin Only) ---

export const getAllUsers = (): User[] => {
  initializeUsers();
  if (typeof window !== 'undefined' && window.localStorage) {
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return users.map(({ password, ...u }) => u as User); // Ẩn password
  }
  return [];
};

export const addUser = (newUser: User): { success: boolean, message: string } => {
    if (typeof window !== 'undefined' && window.localStorage) {
        if (newUser.password) {
            const complexity = checkPasswordComplexity(newUser.password);
            if (!complexity.valid) return { success: false, message: complexity.message || 'Mật khẩu yếu' };
        }

        const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        
        if (users.some(u => u.username === newUser.username)) {
            return { success: false, message: 'Tên đăng nhập đã tồn tại!' };
        }

        // Nếu role chưa có trong danh sách roles, tự động thêm vào
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
    if (typeof window !== 'undefined' && window.localStorage) {
        if (updates.password) {
            const complexity = checkPasswordComplexity(updates.password);
            if (!complexity.valid) return { success: false, message: complexity.message || 'Mật khẩu yếu' };
        }

        const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        const index = users.findIndex(u => u.username === username);
        
        if (index === -1) return { success: false, message: 'Không tìm thấy người dùng' };

        // Nếu role mới chưa có trong danh sách, thêm vào
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
            // Cập nhật session storage hoặc local storage tùy theo cái nào đang active
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
    if (typeof window !== 'undefined' && window.localStorage) {
        if (username === 'admin') return { success: false, message: 'Không thể xóa Super Admin' };
        
        let users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]' );
        users = users.filter(u => u.username !== username);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        return { success: true, message: 'Xóa tài khoản thành công' };
    }
    return { success: false, message: 'LocalStorage is not available' };
};

export const resetUserPassword = (username: string, newPass: string): { success: boolean, message: string } => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const complexity = checkPasswordComplexity(newPass);
        if (!complexity.valid) return { success: false, message: complexity.message || 'Mật khẩu yếu' };

        const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]' );
        const index = users.findIndex(u => u.username === username);
        
        if (index === -1) return { success: false, message: 'Không tìm thấy người dùng' };

        users[index].password = newPass;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        return { success: true, message: 'Reset mật khẩu thành công' };
    }
    return { success: false, message: 'LocalStorage is not available' };
};