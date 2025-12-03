
import { User, Permission } from '../types';
import { DEFAULT_ADMIN } from '../data/userRepository';
import { parseRow } from './sheetService';

// --- GOOGLE SHEET CONFIGURATION ---
const USERS_SHEET_ID = '1cXOlmZwO-6pXU9Wx0Y7hIU7ehEEl9-c4UtZe35Mpy3o';
// CẬP NHẬT: Tên sheet là "Users" dựa trên screenshot
const USERS_SHEET_NAME = 'Users'; 
const USERS_CSV_URL = `https://docs.google.com/spreadsheets/d/${USERS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(USERS_SHEET_NAME)}`;

// URL Script dành riêng cho quản lý tài khoản (Google Sheet User)
// CẬP NHẬT: URL Script mới nhất
const USER_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhBmdbpFxMiiZWEti9rbiyxRDqRDaLj2h6h-Aaly53WIcWngzbvBApo1UCbIw_rmKHyA/exec';

const CURRENT_USER_KEY = 'app_current_user';
const ROLES_KEY = 'app_roles';

// Hàm kiểm tra độ mạnh mật khẩu
export const checkPasswordComplexity = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  return { valid: true };
};

// Helper function to robustly parse permissions
const parsePermissions = (raw: any): Permission[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    let cleaned = raw.trim();
    // Handle both [] format and just comma separated
    cleaned = cleaned.replace(/^\[|\]$/g, '');
    if (!cleaned) return [];
    
    // Split by comma, then remove quotes
    return cleaned.split(',').map(item => {
      // Remove ' or " and whitespace
      return item.trim().replace(/^['"]|['"]$/g, ''); 
    }).filter(Boolean) as Permission[];
  }

  return [];
};

// Parsing CSV data to User objects
const parseUserCSV = (text: string): User[] => {
  const rows = text.split('\n');
  if (rows.length < 2) return [];

  const users: User[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowStr = rows[i].trim();
    if (!rowStr) continue;
    
    const row = parseRow(rowStr);
    
    // Column Mapping:
    // A: Username, B: Password, C: FullName, D: Email, E: Phone, F: Role, G: Permissions, H: IsActive
    
    const username = row[0];
    const password = row[1];
    const fullName = row[2];
    const email = row[3];
    const phone = row[4];
    const role = row[5];
    const permissionsRaw = row[6];
    const isActiveRaw = row[7];

    if (!username) continue; // Skip empty rows

    users.push({
      username: username,
      password: password,
      fullName: fullName,
      email: email,
      phone: phone,
      role: role || 'user',
      permissions: parsePermissions(permissionsRaw),
      isActive: isActiveRaw === 'TRUE' || isActiveRaw === 'true',
      rowIndex: i + 1 // Google Sheets 1-based index (Header is 1, Data starts 2)
    });
  }
  return users;
};

const mapUserToSheetRow = (user: User) => {
  // Serialize permissions array to string format: ['perm1', 'perm2']
  const permString = user.permissions.length > 0 
    ? `['${user.permissions.join("', '")}']` 
    : '[]';

  return [
    user.username,
    user.password || '',
    user.fullName,
    user.email,
    user.phone,
    user.role,
    permString,
    user.isActive ? 'TRUE' : 'FALSE'
  ];
};

export const getAllUsers = async (): Promise<User[]> => {
  let sheetUsers: User[] = [];
  try {
    const response = await fetch(USERS_CSV_URL);
    if (response.ok) {
      const text = await response.text();
      sheetUsers = parseUserCSV(text);
    } else {
      console.error('Không thể tải danh sách người dùng từ Google Sheet');
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách user:', error);
  }

  // Filter out admin from sheet to avoid duplication if it exists in sheet
  const filteredSheetUsers = sheetUsers.filter(u => u.username !== DEFAULT_ADMIN.username);

  // Return Default Admin + Sheet Users
  return [DEFAULT_ADMIN, ...filteredSheetUsers];
};

export const login = async (username: string, password: string, remember: boolean): Promise<User | null> => {
  try {
    const users = await getAllUsers();
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
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  sessionStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userLocal = localStorage.getItem(CURRENT_USER_KEY);
    const userSession = sessionStorage.getItem(CURRENT_USER_KEY);
    const userJson = userLocal || userSession;
    return userJson ? JSON.parse(userJson) : null;
  }
  return null;
};

// --- ROLE MANAGEMENT ---
export const getRoles = (): string[] => {
  const defaultRoles = ['admin', 'user'];
  if (typeof window === 'undefined') return defaultRoles;
  
  const storedRoles: string[] = JSON.parse(localStorage.getItem(ROLES_KEY) || '[]');
  return Array.from(new Set([...defaultRoles, ...storedRoles]));
};

export const addRole = (roleName: string): { success: boolean, message: string } => {
  const roles = getRoles();
  if (roles.includes(roleName)) return { success: false, message: 'Vai trò đã tồn tại' };
  
  roles.push(roleName);
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  return { success: true, message: 'Thêm vai trò thành công' };
};

export const deleteRole = (roleName: string): { success: boolean, message: string } => {
  if (roleName === 'admin' || roleName === 'user') return { success: false, message: 'Không thể xóa vai trò mặc định' };
  
  let roles = getRoles();
  roles = roles.filter(r => r !== roleName);
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  return { success: true, message: 'Xóa vai trò thành công' };
};

// --- CRUD OPERATIONS VIA GOOGLE APPS SCRIPT ---

export const addUser = async (newUser: User): Promise<{ success: boolean, message: string }> => {
  try {
    if (newUser.username === DEFAULT_ADMIN.username) {
        return { success: false, message: 'Tên đăng nhập này đã được sử dụng bởi hệ thống.' };
    }

    const users = await getAllUsers();
    if (users.some(u => u.username === newUser.username)) {
      return { success: false, message: 'Tên đăng nhập đã tồn tại!' };
    }

    const rowData = mapUserToSheetRow(newUser);
    
    const payload = {
      action: 'add',
      data: [rowData],
      spreadsheetId: USERS_SHEET_ID,
      sheetName: USERS_SHEET_NAME
    };

    console.log("Sending payload to GAS:", payload);

    await fetch(USER_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload) 
    });

    return { success: true, message: 'Thêm tài khoản thành công (Dữ liệu sẽ cập nhật sau vài giây)' };
  } catch (error) {
    return { success: false, message: 'Lỗi kết nối: ' + error };
  }
};

export const updateUser = async (username: string, updates: Partial<User>): Promise<{ success: boolean, message: string }> => {
  if (username === DEFAULT_ADMIN.username) {
    return { success: false, message: 'Tài khoản Admin gốc được quản lý trong mã nguồn, không thể chỉnh sửa tại đây.' };
  }

  try {
    // 1. Fetch current data to find rowIndex and merge data
    const allUsers = await getAllUsers();
    const currentUser = allUsers.find(u => u.username === username);
    
    if (!currentUser) {
       return { success: false, message: 'Người dùng không tồn tại' };
    }
    
    if (!currentUser.rowIndex) {
      return { success: false, message: 'Không tìm thấy chỉ mục dòng của người dùng' };
    }

    // 2. Merge updates
    const mergedUser = { ...currentUser, ...updates };

    // 3. Map to row format
    const rowData = mapUserToSheetRow(mergedUser);

    // 4. Send updateBatch action
    const payload = {
      action: 'updateBatch',
      data: [{ id: currentUser.rowIndex, data: rowData }],
      spreadsheetId: USERS_SHEET_ID,
      sheetName: USERS_SHEET_NAME
    };

    await fetch(USER_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    // Update local storage if current user
    const loggedInUser = getCurrentUser();
    if (loggedInUser && loggedInUser.username === username) {
        const { password, ...safeData } = { ...loggedInUser, ...updates };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeData));
    }

    return { success: true, message: 'Cập nhật thành công' };
  } catch (error) {
    return { success: false, message: 'Lỗi kết nối: ' + error };
  }
};

export const deleteUser = async (user: User): Promise<{ success: boolean, message: string }> => {
  if (user.username === DEFAULT_ADMIN.username) {
    return { success: false, message: 'Không thể xóa tài khoản Admin gốc của hệ thống.' };
  }

  try {
    let rowIndex = user.rowIndex;
    if (!rowIndex) {
       const allUsers = await getAllUsers();
       const freshUser = allUsers.find(u => u.username === user.username);
       if (freshUser) rowIndex = freshUser.rowIndex;
    }

    if (!rowIndex) {
       return { success: false, message: 'Không tìm thấy dòng dữ liệu để xóa.' };
    }

    const payload = {
      action: 'delete',
      id: rowIndex,
      spreadsheetId: USERS_SHEET_ID,
      sheetName: USERS_SHEET_NAME
    };

    await fetch(USER_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    return { success: true, message: 'Xóa tài khoản thành công' };
  } catch (error) {
    return { success: false, message: 'Lỗi kết nối: ' + error };
  }
};
