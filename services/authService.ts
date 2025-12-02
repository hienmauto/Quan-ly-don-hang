
import { User, Permission } from '../types';
import { DEFAULT_ADMIN } from '../data/userRepository';

// --- N8N WEBHOOK CONFIGURATION ---
const N8N_URLS = {
  GET_USERS: 'https://n8n.hienmauto.com/webhook/user-info',
  ADD_USER: 'https://n8n.hienmauto.com/webhook/add-user',
  UPDATE_USER: 'https://n8n.hienmauto.com/webhook/update-user',
  DELETE_USER: 'https://n8n.hienmauto.com/webhook/delete-user'
};

const CURRENT_USER_KEY = 'app_current_user';

// Hàm kiểm tra độ mạnh mật khẩu
export const checkPasswordComplexity = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 6) return { valid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  return { valid: true };
};

// --- API CALLS TO N8N ---

// Helper function to robustly parse permissions
const parsePermissions = (raw: any): Permission[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^\[|\]$/g, '');
    if (!cleaned) return [];
    return cleaned.split(',').map(item => {
      return item.trim().replace(/^['"]|['"]$/g, ''); 
    }).filter(Boolean) as Permission[];
  }

  return [];
};

// Helper để map dữ liệu từ Sheet (thường viết Hoa) sang Code (viết thường)
const mapSheetUserToAppUser = (data: any): User => {
  const rawPermissions = data.Permissions || data.permissions;

  return {
    username: data.Username || data.username,
    password: data.Password || data.password,
    fullName: data.FullName || data.fullName || data.fullname,
    email: data.Email || data.email,
    phone: data.Phone || data.phone,
    role: (data.Role || data.role || 'user').toLowerCase(),
    permissions: parsePermissions(rawPermissions),
    isActive: data.IsActive === true || data.IsActive === 'TRUE' || data.isActive === true
  };
};

export const getAllUsers = async (): Promise<User[]> => {
  let sheetUsers: User[] = [];
  try {
    const response = await fetch(N8N_URLS.GET_USERS);
    if (response.ok) {
      const json = await response.json();
      const rawData = Array.isArray(json) ? json : (json.data || []);
      sheetUsers = rawData.map(mapSheetUserToAppUser);
    } else {
      console.error('Không thể tải danh sách người dùng từ N8N');
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách user từ n8n:', error);
  }

  // Lọc bỏ nếu file Sheet lỡ có dòng trùng tên với Admin gốc
  const filteredSheetUsers = sheetUsers.filter(u => u.username !== DEFAULT_ADMIN.username);

  // Luôn trả về Admin gốc + Users từ Sheet
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
  if (typeof window === 'undefined') return null;
  const userLocal = localStorage.getItem(CURRENT_USER_KEY);
  const userSession = sessionStorage.getItem(CURRENT_USER_KEY);
  const userJson = userLocal || userSession;
  return userJson ? JSON.parse(userJson) : null;
};

// --- ROLE MANAGEMENT ---
const ROLES_KEY = 'app_roles';
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

// --- CRUD OPERATIONS VIA N8N ---

export const addUser = async (newUser: User): Promise<{ success: boolean, message: string }> => {
  try {
    // Không cho phép tạo thêm user trùng tên admin gốc
    if (newUser.username === DEFAULT_ADMIN.username) {
        return { success: false, message: 'Tên đăng nhập này đã được sử dụng bởi hệ thống.' };
    }

    const users = await getAllUsers();
    if (users.some(u => u.username === newUser.username)) {
      return { success: false, message: 'Tên đăng nhập đã tồn tại!' };
    }

    // Format permissions manually to match the requested format "['perm1', 'perm2']"
    let formattedPermissions = "[]";
    if (newUser.permissions && newUser.permissions.length > 0) {
       formattedPermissions = "[" + newUser.permissions.map(p => `'${p}'`).join(", ") + "]";
    }

    const payload = {
      Username: newUser.username,
      Password: newUser.password,
      FullName: newUser.fullName,
      Email: newUser.email,
      Phone: Number(newUser.phone) || 0, // Ensure phone is a number
      Role: newUser.role,
      Permissions: formattedPermissions,
      IsActive: true
    };

    // Send array of objects
    const response = await fetch(N8N_URLS.ADD_USER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]) 
    });

    if (response.ok) {
      return { success: true, message: 'Thêm tài khoản thành công' };
    } else {
      return { success: false, message: 'Lỗi server n8n' };
    }
  } catch (error) {
    return { success: false, message: 'Lỗi kết nối: ' + error };
  }
};

export const updateUser = async (username: string, updates: Partial<User>): Promise<{ success: boolean, message: string }> => {
  // BẢO VỆ ADMIN: Không cho phép sửa admin gốc qua API N8N
  if (username === DEFAULT_ADMIN.username) {
    return { success: false, message: 'Tài khoản Admin gốc được quản lý trong mã nguồn, không thể chỉnh sửa tại đây.' };
  }

  try {
    // 1. Fetch current user data to ensure we have a complete object
    const allUsers = await getAllUsers();
    const currentUser = allUsers.find(u => u.username === username);
    
    if (!currentUser) {
       return { success: false, message: 'Người dùng không tồn tại' };
    }

    // 2. Merge updates into current user
    const mergedUser = { ...currentUser, ...updates };

    // 3. Format permissions as stringified array
    let formattedPermissions = "[]";
    if (mergedUser.permissions && mergedUser.permissions.length > 0) {
       formattedPermissions = "[" + mergedUser.permissions.map(p => `'${p}'`).join(", ") + "]";
    }

    // 4. Construct payload with strictly defined keys
    const payload: any = {
      Username: mergedUser.username,
      FullName: mergedUser.fullName,
      Email: mergedUser.email,
      Phone: mergedUser.phone,
      Role: mergedUser.role,
      Permissions: formattedPermissions
    };

    // If password is updated, include it. N8N might not need it for all updates, but it's part of the object.
    if (updates.password) {
        payload.Password = updates.password;
    }
    
    // N8N often expects an array of objects
    const bodyPayload = [payload];

    console.log('Sending update payload to N8N:', bodyPayload);

    const response = await fetch(N8N_URLS.UPDATE_USER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    if (response.ok) {
      // Update local storage if updating the currently logged-in user
      const loggedInUser = getCurrentUser();
      if (loggedInUser && loggedInUser.username === username) {
         const { password, ...safeData } = { ...loggedInUser, ...updates };
         localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeData));
      }
      return { success: true, message: 'Cập nhật thành công' };
    } else {
      return { success: false, message: 'Lỗi server n8n' };
    }
  } catch (error) {
    return { success: false, message: 'Lỗi kết nối: ' + error };
  }
};

export const deleteUser = async (user: User): Promise<{ success: boolean, message: string }> => {
  // BẢO VỆ ADMIN: Không cho phép xóa admin gốc
  if (user.username === DEFAULT_ADMIN.username) {
    return { success: false, message: 'Không thể xóa tài khoản Admin gốc của hệ thống.' };
  }

  try {
    // Format permissions exactly like in add/update
    let formattedPermissions = "[]";
    if (user.permissions && user.permissions.length > 0) {
       formattedPermissions = "[" + user.permissions.map(p => `'${p}'`).join(", ") + "]";
    }

    // Construct full payload as requested
    const payload = {
      Username: user.username,
      FullName: user.fullName,
      Email: user.email,
      Phone: Number(user.phone) || 0,
      Role: user.role,
      Permissions: formattedPermissions,
      IsActive: user.isActive
    };

    const response = await fetch(N8N_URLS.DELETE_USER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]) // Wrap in array
    });

    if (response.ok) {
      return { success: true, message: 'Xóa tài khoản thành công' };
    }
    return { success: false, message: 'Lỗi server n8n' };
  } catch (error) {
    return { success: false, message: 'Lỗi kết nối: ' + error };
  }
};
