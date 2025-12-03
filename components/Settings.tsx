

import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, Shield, Save, Plus, Trash2, Edit2, 
  X, Check, Lock, LogOut, Tag, Eye, EyeOff, Loader2
} from 'lucide-react';
import { User, Permission, Role } from '../types';
import { updateUser, getAllUsers, addUser, deleteUser, checkPasswordComplexity, getRoles, addRole, deleteRole, logout } from '../services/authService';

interface SettingsProps {
  currentUser: User;
  onUpdateCurrentUser: (user: User) => void;
}

const PERMISSION_GROUPS = [
  {
    title: 'Dashboard',
    items: [
      { id: 'view_dashboard', label: 'Xem Dashboard (Tổng quan)' },
    ]
  },
  {
    title: 'Đơn Hàng',
    items: [
      { id: 'view_orders', label: 'Xem danh sách đơn hàng' },
      { id: 'add_orders', label: 'Thêm đơn hàng mới' },
      { id: 'edit_orders', label: 'Sửa & Cập nhật đơn hàng' },
    ]
  },
  {
    title: 'Khách Hàng',
    items: [
      { id: 'view_customers', label: 'Xem danh sách khách hàng' },
    ]
  },
  {
    title: 'Quản Lý Tasco',
    items: [
      { id: 'view_tasco', label: 'Xem danh sách Tasco' },
      { id: 'add_tasco', label: 'Thêm mới Tasco' },
      { id: 'edit_tasco', label: 'Chỉnh sửa Tasco' },
      { id: 'delete_tasco', label: 'Xóa Tasco' },
    ]
  },
  {
    title: 'Cài Đặt',
    items: [
      { id: 'view_settings_personal', label: 'Cài đặt thông tin cá nhân' },
      { id: 'view_settings_admin', label: 'Quản lý tài khoản (Admin)' },
      { id: 'view_settings_roles', label: 'Quản lý tên vai trò' },
    ]
  }
];

const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateCurrentUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'roles'>('profile');
  const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  
  // Loading states
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Profile State ---
  const [profileForm, setProfileForm] = useState({
    fullName: currentUser.fullName,
    email: currentUser.email,
    phone: currentUser.phone,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- Users Management State (Admin) ---
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  
  // State for Delete User Confirmation
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Custom Role State
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [rolesList, setRolesList] = useState<string[]>([]);
  const [roleTabInput, setRoleTabInput] = useState('');

  // User Modal Form State
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'user' as Role,
    permissions: [] as Permission[]
  });
  const [showUserModalPassword, setShowUserModalPassword] = useState(false);

  // Fetch Users function
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    const users = await getAllUsers();
    setUsersList(users);
    setIsLoadingUsers(false);
  };

  useEffect(() => {
    const roles = getRoles();
    setAvailableRoles(roles);
    setRolesList(roles);

    if (activeTab === 'users' && (currentUser.role === 'admin' || currentUser.permissions.includes('view_settings_admin'))) {
      fetchUsers();
    }
  }, [activeTab, currentUser.role, currentUser.permissions]);

  const showNotify = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  // --- Profile Handlers ---
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profileForm.newPassword) {
        if (profileForm.newPassword !== profileForm.confirmPassword) {
            showNotify('Mật khẩu mới không khớp!', 'error');
            return;
        }
        const complexity = checkPasswordComplexity(profileForm.newPassword);
        if (!complexity.valid) {
            showNotify(complexity.message || 'Mật khẩu yếu', 'error');
            return;
        }

        setIsSubmitting(true);
        const updates: Partial<User> = {
          password: profileForm.newPassword
        };

        const result = await updateUser(currentUser.username, updates);
        setIsSubmitting(false);

        if (result.success) {
          showNotify('Đổi mật khẩu thành công!', 'success');
          onUpdateCurrentUser({ ...currentUser, ...updates });
          setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } else {
          showNotify(result.message, 'error');
        }
    } else {
      showNotify('Thông tin cá nhân không được phép chỉnh sửa.', 'error');
    }
  };

  // --- Roles Tab Handlers ---
  const handleAddRoleTab = () => {
    if (!roleTabInput.trim()) return;
    const res = addRole(roleTabInput.trim());
    if (res.success) {
       showNotify(res.message, 'success');
       setRolesList(getRoles());
       setRoleTabInput('');
    } else {
       showNotify(res.message, 'error');
    }
  };

  const handleDeleteRoleTab = (role: string) => {
    if (confirm(`Bạn có chắc muốn xóa vai trò "${role}"?`)) {
       const res = deleteRole(role);
       if (res.success) {
         showNotify(res.message, 'success');
         setRolesList(getRoles());
       } else {
         showNotify(res.message, 'error');
       }
    }
  };

  // --- Admin User Management Handlers ---
  const handleOpenUserModal = (user?: User) => {
    setIsAddingRole(false);
    setNewRoleName('');
    setShowUserModalPassword(false);
    setAvailableRoles(getRoles());
    
    if (user) {
      setEditingUser(user);
      setUserForm({
        username: user.username,
        password: '',
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions
      });
    } else {
      setEditingUser(null);
      setUserForm({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phone: '',
        role: 'user',
        permissions: ['view_orders', 'add_orders', 'edit_orders', 'view_customers', 'view_settings_personal']
      });
    }
    setIsUserModalOpen(true);
  };

  const togglePermission = (perm: Permission) => {
    setUserForm(prev => {
      const perms = prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: perms };
    });
  };

  const handleAddCustomRoleInline = () => {
    if (newRoleName.trim()) {
      const formattedRole = newRoleName.trim();
      const res = addRole(formattedRole);
      
      if (res.success) {
         setAvailableRoles(getRoles());
         setUserForm(prev => ({ ...prev, role: formattedRole }));
         setIsAddingRole(false);
         setNewRoleName('');
      } else {
         showNotify(res.message, 'error');
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if ((!editingUser && userForm.password) || (editingUser && userForm.password)) {
        const complexity = checkPasswordComplexity(userForm.password);
        if (!complexity.valid) {
            setIsSubmitting(false);
            showNotify(complexity.message || 'Mật khẩu yếu', 'error');
            return;
        }
    }

    if (editingUser) {
      const updates: Partial<User> = {
        fullName: userForm.fullName,
        email: userForm.email,
        phone: userForm.phone,
        role: userForm.role,
        permissions: userForm.permissions
      };
      if (userForm.password) updates.password = userForm.password;

      const res = await updateUser(editingUser.username!, updates);
      if (res.success) {
        showNotify('Cập nhật người dùng thành công', 'success');
        await fetchUsers(); // Reload list from N8N
        setIsUserModalOpen(false);
      } else {
        showNotify(res.message, 'error');
      }
    } else {
      if (!userForm.username || !userForm.password) {
        setIsSubmitting(false);
        showNotify('Vui lòng nhập tài khoản và mật khẩu', 'error');
        return;
      }
      const newUser: User = {
        username: userForm.username,
        password: userForm.password,
        fullName: userForm.fullName,
        email: userForm.email,
        phone: userForm.phone,
        role: userForm.role,
        permissions: userForm.permissions,
        isActive: true
      };
      const res = await addUser(newUser);
      if (res.success) {
        showNotify('Thêm người dùng thành công', 'success');
        await fetchUsers(); // Reload list from N8N
        setIsUserModalOpen(false);
      } else {
        showNotify(res.message, 'error');
      }
    }
    setIsSubmitting(false);
  };

  const handleInitiateDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;

    setIsLoadingUsers(true);
    const res = await deleteUser(userToDelete);
    setIsLoadingUsers(false);
    setUserToDelete(null); // Close modal

    if (res.success) {
      showNotify('Đã xóa người dùng', 'success');
      await fetchUsers();
    } else {
      showNotify(res.message, 'error');
    }
  };
  
  const canViewAdmin = currentUser.role === 'admin' || currentUser.permissions.includes('view_settings_admin');
  const canViewRoles = currentUser.role === 'admin' || currentUser.permissions.includes('view_settings_roles');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-[100] text-white animate-fade-in ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' && <Shield size={20} />}
            {notification.msg}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Cài đặt hệ thống</h2>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
        >
          <LogOut size={18} /> Đăng xuất
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'profile' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <UserIcon size={18} className="inline mr-2 mb-1" />
          Thông tin cá nhân
          {activeTab === 'profile' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
        </button>
        
        {canViewAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'users' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Shield size={18} className="inline mr-2 mb-1" />
            Quản lý tài khoản (Admin)
            {activeTab === 'users' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
          </button>
        )}

        {canViewRoles && (
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'roles' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Tag size={18} className="inline mr-2 mb-1" />
            Quản lý vai trò
            {activeTab === 'roles' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
        
        {/* === TAB PROFILE === */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate} className="max-w-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Cập nhật hồ sơ</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                <input disabled value={currentUser.username} className="w-full px-4 py-2 border bg-gray-100 rounded-lg text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                <input 
                  value={profileForm.fullName} 
                  disabled
                  className="w-full px-4 py-2 border bg-gray-100 border-gray-300 rounded-lg text-gray-500 cursor-not-allowed outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input 
                    type="email"
                    value={profileForm.email} 
                    disabled
                    className="w-full px-4 py-2 border bg-gray-100 border-gray-300 rounded-lg text-gray-500 cursor-not-allowed outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input 
                    value={profileForm.phone} 
                    disabled
                    className="w-full px-4 py-2 border bg-gray-100 border-gray-300 rounded-lg text-gray-500 cursor-not-allowed outline-none" 
                  />
                </div>
              </div>

              <hr className="my-6 border-gray-100" />
              <h4 className="font-semibold text-gray-700 mb-2">Đổi mật khẩu</h4>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                    <div className="relative">
                      <input 
                        type={showNewPassword ? "text" : "password"}
                        value={profileForm.newPassword} 
                        onChange={e => setProfileForm({...profileForm, newPassword: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none pr-10" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        value={profileForm.confirmPassword} 
                        onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none pr-10" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                 </div>
              </div>
              
              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition-colors shadow-sm font-medium disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* === TAB USERS MANAGEMENT === */}
        {activeTab === 'users' && canViewAdmin && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-800">Danh sách người dùng</h3>
              <div className="flex gap-2">
                 <button 
                  onClick={fetchUsers}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Tải lại danh sách"
                 >
                   <Loader2 size={18} className={isLoadingUsers ? "animate-spin" : ""} />
                 </button>
                 <button 
                  onClick={() => handleOpenUserModal()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                >
                  <Plus size={18} /> Thêm User
                </button>
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                 <div className="text-center text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={30} />
                    <p>Đang tải dữ liệu từ server...</p>
                 </div>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-bold text-gray-600 uppercase border-b border-gray-200">
                      <th className="px-4 py-3">Tài khoản</th>
                      <th className="px-4 py-3">Họ tên</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3">Quyền hạn</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {usersList.length > 0 ? (
                      usersList.map((user) => (
                        <tr key={user.username} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{user.username}</td>
                          <td className="px-4 py-3">
                              <div>{user.fullName}</div>
                              <div className="text-xs text-gray-400">{user.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded">{user.permissions.length} quyền</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleOpenUserModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa">
                                <Edit2 size={16} />
                              </button>
                              {user.username !== 'admin' && user.username !== currentUser.username && (
                                <button onClick={() => handleInitiateDeleteUser(user)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Xóa">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                       <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-500">Chưa có người dùng nào.</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* === TAB ROLES MANAGEMENT === */}
        {activeTab === 'roles' && canViewRoles && (
           <div className="max-w-2xl">
             <h3 className="text-lg font-bold text-gray-800 mb-6">Quản lý tên vai trò</h3>
             
             <div className="flex gap-3 mb-6">
                <input 
                  value={roleTabInput}
                  onChange={e => setRoleTabInput(e.target.value)}
                  placeholder="Nhập tên vai trò mới (VD: Manager, Shipper...)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={handleAddRoleTab}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Plus size={18} /> Thêm
                </button>
             </div>

             <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-gray-50 text-xs font-bold text-gray-600 uppercase border-b">
                      <tr>
                        <th className="px-4 py-3">Tên vai trò</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 text-sm">
                      {rolesList.map(role => (
                        <tr key={role} className="hover:bg-gray-50">
                           <td className="px-4 py-3 font-medium text-gray-800">{role.charAt(0).toUpperCase() + role.slice(1)}</td>
                           <td className="px-4 py-3 text-right">
                              {role !== 'admin' && role !== 'user' && (
                                <button 
                                  onClick={() => handleDeleteRoleTab(role)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              {(role === 'admin' || role === 'user') && (
                                <span className="text-xs text-gray-400 italic px-2">Mặc định</span>
                              )}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
        )}
      </div>

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in relative">
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 bg-white z-10">
               <h3 className="font-bold text-gray-800 text-lg">{editingUser ? 'Sửa thông tin' : 'Thêm người dùng mới'}</h3>
               <button onClick={() => setIsUserModalOpen(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
             </div>
             
             <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
                      <input 
                        required
                        disabled={!!editingUser}
                        value={userForm.username}
                        onChange={e => setUserForm({...userForm, username: e.target.value})}
                        className="w-full px-3 py-2.5 rounded-md disabled:opacity-50 bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="VD: user1"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu {editingUser && <span className="text-xs font-normal text-gray-400">(để trống nếu không đổi)</span>}</label>
                      <div className="relative">
                        <input 
                          type={showUserModalPassword ? "text" : "password"}
                          required={!editingUser}
                          value={userForm.password}
                          onChange={e => setUserForm({...userForm, password: e.target.value})}
                          className="w-full px-3 py-2.5 rounded-md bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                          placeholder="Aa@123..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowUserModalPassword(!showUserModalPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-200"
                          tabIndex={-1}
                        >
                          {showUserModalPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                   <input 
                      required
                      value={userForm.fullName}
                      onChange={e => setUserForm({...userForm, fullName: e.target.value})}
                      className="w-full px-3 py-2.5 rounded-md bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input 
                         type="email"
                         value={userForm.email}
                         onChange={e => setUserForm({...userForm, email: e.target.value})}
                         className="w-full px-3 py-2.5 rounded-md bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Điện thoại</label>
                      <input 
                         value={userForm.phone}
                         onChange={e => setUserForm({...userForm, phone: e.target.value})}
                         className="w-full px-3 py-2.5 rounded-md bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                   </div>
                </div>

                <div className="flex items-end gap-3">
                   <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                      {isAddingRole ? (
                         <div className="flex gap-2">
                           <input 
                             value={newRoleName}
                             onChange={e => setNewRoleName(e.target.value)}
                             placeholder="Nhập tên vai trò mới..."
                             className="flex-1 px-3 py-2.5 rounded-md bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none"
                             autoFocus
                           />
                           <button 
                             type="button" 
                             onClick={handleAddCustomRoleInline}
                             className="p-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md"
                             title="Lưu vai trò"
                           >
                             <Check size={20} />
                           </button>
                           <button 
                             type="button" 
                             onClick={() => setIsAddingRole(false)}
                             className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md"
                             title="Hủy"
                           >
                             <X size={20} />
                           </button>
                         </div>
                      ) : (
                         <select 
                           value={userForm.role}
                           onChange={e => setUserForm({...userForm, role: e.target.value as Role})}
                           className="w-full px-3 py-2.5 rounded-md bg-[#333] text-white border-none focus:ring-2 focus:ring-blue-500 outline-none"
                         >
                           {availableRoles.map(role => (
                             <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                           ))}
                         </select>
                      )}
                   </div>
                   {!isAddingRole && (
                     <button 
                        type="button" 
                        onClick={() => setIsAddingRole(true)}
                        className="px-3 py-2.5 bg-[#333] text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center"
                        title="Thêm vai trò mới"
                     >
                        <Plus size={20} />
                     </button>
                   )}
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Phân quyền chi tiết</label>
                   <div className="border rounded-lg p-3 bg-gray-50 max-h-60 overflow-y-auto space-y-4">
                      {PERMISSION_GROUPS.map((group, idx) => (
                        <div key={idx}>
                          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{group.title}</h5>
                          <div className="space-y-2">
                             {group.items.map((perm) => (
                               <label key={perm.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition-colors">
                                  <input 
                                    type="checkbox" 
                                    checked={userForm.permissions.includes(perm.id as Permission)}
                                    onChange={() => togglePermission(perm.id as Permission)}
                                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700 leading-snug">{perm.label}</span>
                               </label>
                             ))}
                          </div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white pb-2 border-t mt-4">
                   <button 
                    type="button" 
                    onClick={() => setIsUserModalOpen(false)} 
                    disabled={isSubmitting}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-red-600 border-red-200"
                  >
                    Hủy
                  </button>
                   <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Lưu'}
                  </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                 <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Xóa người dùng?</h3>
            </div>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{userToDelete.username}</strong> ({userToDelete.fullName})?
              <br/><span className="text-sm text-red-500 mt-2 block font-medium">Hành động này không thể hoàn tác.</span>
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm flex items-center gap-2"
                disabled={isLoadingUsers}
              >
                {isLoadingUsers && <Loader2 className="animate-spin" size={16} />}
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;