import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, Settings as SettingsIcon, 
  Menu, Bell, PlusCircle, LogOut, Loader2, X 
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import { OrderList } from './components/OrderList';
import OrderModal from './components/OrderModal';
import { Toast } from './components/Toast';
import Login from './components/Login';
import Settings from './components/Settings';
import { Order, OrderStatus, Product, ViewState, User, Permission } from './types';
import { getCurrentUser, logout as performLogout } from './services/authService';
import { 
  fetchOrdersFromSheet, 
  updateBatchOrdersInSheet, 
  deleteBatchOrdersFromSheet,
  sendUpdateOrderToWebhook,
  sendBulkUpdateOrdersToWebhook,
  sendDeleteOrdersToWebhook
} from './services/sheetService';

// Mock Data for Products (kept for manual order creation)
const MOCK_PRODUCTS: Product[] = [
  { id: 'SP001', name: 'Áo Thun Basic', price: 150000, stock: 100, category: 'Thời trang', image: '' },
  { id: 'SP002', name: 'Quần Jeans Slim', price: 450000, stock: 50, category: 'Thời trang', image: '' },
  { id: 'SP003', name: 'Giày Sneaker', price: 850000, stock: 30, category: 'Giày dép', image: '' },
  { id: 'SP004', name: 'Balo Laptop', price: 320000, stock: 45, category: 'Phụ kiện', image: '' },
  { id: 'SP005', name: 'Tai nghe Bluetooth', price: 550000, stock: 20, category: 'Công nghệ', image: '' },
];

const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // --- App State ---
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Initialize Sidebar state based on screen width
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Profile Dropdown State ---
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Check Auth on Mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setIsAuthChecking(false);
  }, []);

  // Click outside handler for profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch data from Google Sheet on mount (only if authenticated)
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        setIsLoading(true);
        const sheetOrders = await fetchOrdersFromSheet();
        setOrders(sheetOrders);
        setIsLoading(false);
      };
      loadData();
    }
  }, [currentUser]);

  // --- Permission Helpers ---
  const hasPermission = (perm: Permission) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions.includes(perm);
  };

  // --- Handlers ---
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    // Set default view based on permissions
    if (user.role !== 'admin' && !user.permissions.includes('view_dashboard')) {
       if (user.permissions.includes('view_orders')) setCurrentView('orders');
       else if (user.permissions.includes('view_settings_personal') || user.permissions.includes('view_settings_admin')) setCurrentView('settings');
    }
  };

  const handleLogout = () => {
    performLogout();
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  const handleAddOrder = () => {
    if (!hasPermission('add_orders')) {
      setToast({ message: 'Bạn không có quyền thêm đơn hàng', type: 'error' });
      return;
    }
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    if (!hasPermission('edit_orders')) {
      setToast({ message: 'Bạn không có quyền sửa đơn hàng', type: 'error' });
      return;
    }
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleDeleteOrder = async (id: string) => {
    if (!hasPermission('delete_orders')) {
      setToast({ message: 'Bạn không có quyền xóa đơn hàng', type: 'error' });
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa đơn hàng này?')) {
      handleBulkDelete([id]);
    }
  };

  const handleStatusChange = (id: string, newStatus: OrderStatus) => {
    if (!hasPermission('edit_orders')) return;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  // Helper Delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleBulkUpdate = async (ids: string[], updates: { status?: OrderStatus, templateStatus?: string }) => {
    if (!hasPermission('edit_orders')) {
      setToast({ message: 'Bạn không có quyền cập nhật đơn hàng', type: 'error' });
      return;
    }

    const updatedOrders = orders.map(o => {
      if (ids.includes(o.id)) {
        return { 
          ...o, 
          status: updates.status || o.status,
          templateStatus: updates.templateStatus || o.templateStatus
        };
      }
      return o;
    });
    setOrders(updatedOrders);

    setIsLoading(true);
    const changedOrders = updatedOrders.filter(o => ids.includes(o.id));

    await updateBatchOrdersInSheet(changedOrders);

    if (updates.status === OrderStatus.CANCELLED) {
      await sendDeleteOrdersToWebhook(changedOrders);
      setToast({ message: 'Hủy đơn thành công!', type: 'success' });
    } else {
      // Use single update webhook if only 1 order is selected, otherwise use bulk webhook
      if (changedOrders.length === 1) {
        await sendUpdateOrderToWebhook(changedOrders[0]);
      } else {
        await sendBulkUpdateOrdersToWebhook(changedOrders);
      }
      setToast({ message: 'Cập nhật thành công!', type: 'success' });
    }
    
    await delay(2000);
    const newSheetOrders = await fetchOrdersFromSheet();
    setOrders(newSheetOrders);
    setIsLoading(false);
  };
  
  const handleBulkDelete = async (ids: string[]) => {
    if (!hasPermission('delete_orders')) {
      setToast({ message: 'Bạn không có quyền xóa đơn hàng', type: 'error' });
      return;
    }

    setOrders(prev => prev.filter(o => !ids.includes(o.id)));
    
    const rowIndexesToDelete: number[] = [];
    orders.forEach(o => {
      if (ids.includes(o.id) && o.rowIndex) {
        rowIndexesToDelete.push(o.rowIndex);
      }
    });

    if (rowIndexesToDelete.length > 0) {
      setIsLoading(true);
      await deleteBatchOrdersFromSheet(rowIndexesToDelete);
      await delay(2500);
      const newSheetOrders = await fetchOrdersFromSheet();
      setOrders(newSheetOrders);
      setIsLoading(false);
      setToast({ message: 'Xóa đơn hàng thành công!', type: 'success' });
    }
  };

  const handleSubmitOrder = (data: Order | Order[]) => {
    if (Array.isArray(data)) {
      setOrders(prev => [...data, ...prev]);
    } else {
      if (editingOrder) {
        setOrders(prev => prev.map(o => o.id === data.id ? data : o));
      } else {
        setOrders(prev => [data, ...prev]);
      }
    }
    setToast({ message: 'Lưu đơn hàng thành công!', type: 'success' });
  };

  const SidebarItem = ({ view, icon: Icon, label, reqPerms }: { view: ViewState, icon: any, label: string, reqPerms: Permission[] }) => {
    // Show item if user has AT LEAST ONE of the required permissions
    const hasAccess = currentUser?.role === 'admin' || reqPerms.some(p => currentUser?.permissions.includes(p));
    
    if (!hasAccess) return null;
    
    return (
      <button
        onClick={() => {
          setCurrentView(view);
          // On mobile, auto-close sidebar when clicking an item
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
          ${currentView === view 
            ? 'bg-red-600 text-white shadow-md' 
            : 'text-gray-600 hover:bg-red-50 hover:text-red-600'
          }`}
      >
        <Icon size={20} className={currentView === view ? 'text-white' : 'text-gray-500 group-hover:text-red-600'} />
        <span className={`font-medium ${!isSidebarOpen && 'hidden md:hidden'}`}>{label}</span>
        {view === 'orders' && orders.some(o => o.status === OrderStatus.PLACED) && (
          <span className={`ml-auto w-2 h-2 rounded-full bg-red-500 ${!isSidebarOpen && 'hidden md:hidden'}`}></span>
        )}
      </button>
    );
  };

  // --- Render ---

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-red-600" size={40} />
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-50
          fixed md:relative h-full shadow-xl md:shadow-none
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-20 md:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
          <div className={`flex items-center gap-1 ${!isSidebarOpen && 'md:justify-center w-full'} overflow-hidden whitespace-nowrap`}>
            {isSidebarOpen ? (
              <h1 className="text-xl font-bold flex items-center gap-1">
                <span className="text-gray-800">HIEN</span>
                <span className="text-amber-500">M AUTO</span>
              </h1>
            ) : (
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold hidden md:flex shrink-0">H</div>
            )}
          </div>

          {/* Close Button for Mobile */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-gray-500 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <SidebarItem view="dashboard" icon={LayoutDashboard} label="Tổng Quan" reqPerms={['view_dashboard']} />
          <SidebarItem view="orders" icon={ShoppingCart} label="Đơn Hàng" reqPerms={['view_orders']} />
          <SidebarItem view="customers" icon={Users} label="Khách Hàng" reqPerms={['view_customers']} />
          {/* Settings requires either personal OR admin access */}
          <SidebarItem view="settings" icon={SettingsIcon} label="Cài Đặt" reqPerms={['view_settings_personal', 'view_settings_admin']} />
        </nav>

        <div className="p-4 border-t border-gray-100 shrink-0">
           <button 
             onClick={handleLogout}
             className={`w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors ${!isSidebarOpen && 'justify-center'}`}
           >
             <LogOut size={20} />
             {isSidebarOpen && <span className="font-medium">Đăng xuất</span>}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 hidden sm:block">
              {currentView === 'dashboard' ? 'Dashboard' : 
               currentView === 'orders' ? 'Quản Lý Đơn Hàng' : 
               currentView === 'customers' ? 'Danh Sách Khách Hàng' : 'Cài Đặt'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {hasPermission('add_orders') && (
              <button 
                onClick={handleAddOrder}
                className="hidden sm:flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium"
              >
                <PlusCircle size={18} />
                Tạo Đơn Mới
              </button>
            )}
            <div className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full cursor-pointer transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </div>
            
            {/* User Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer hover:bg-indigo-200 transition-colors"
                title={currentUser.username}
              >
                {currentUser.username.substring(0, 2).toUpperCase()}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 border border-gray-100 z-50 animate-fade-in origin-top-right">
                  {(hasPermission('view_settings_personal') || hasPermission('view_settings_admin') || hasPermission('view_settings_roles')) && (
                     <button
                        onClick={() => {
                           setCurrentView('settings');
                           setIsProfileMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                     >
                        Cài đặt
                     </button>
                  )}
                  <button
                     onClick={() => {
                        handleLogout();
                        setIsProfileMenuOpen(false);
                     }}
                     className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
                  >
                     Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-red-600" size={40} />
                <p className="text-gray-500 font-medium">Đang tải dữ liệu từ Google Sheet...</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto h-full">
              {currentView === 'dashboard' && hasPermission('view_dashboard') && <Dashboard orders={orders} />}
              {currentView === 'orders' && hasPermission('view_orders') && (
                <OrderList 
                  orders={orders} 
                  onEdit={handleEditOrder} 
                  onDelete={handleDeleteOrder} 
                  onStatusChange={handleStatusChange}
                  onBulkUpdate={handleBulkUpdate}
                  onBulkDelete={handleBulkDelete}
                />
              )}
              {currentView === 'customers' && hasPermission('view_customers') && (
                <div className="bg-white p-12 rounded-xl shadow-sm text-center border border-gray-200">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-600">Quản lý khách hàng</h3>
                  <p className="text-gray-400 mt-2">Tính năng đang được phát triển...</p>
                </div>
              )}
              {(currentView === 'settings') && 
               (hasPermission('view_settings_personal') || hasPermission('view_settings_admin') || hasPermission('view_settings_roles')) && (
                <Settings currentUser={currentUser} onUpdateCurrentUser={setCurrentUser} />
              )}
              
              {/* Fallback Unauthorized */}
              {((currentView === 'dashboard' && !hasPermission('view_dashboard')) ||
                (currentView === 'orders' && !hasPermission('view_orders')) ||
                (currentView === 'customers' && !hasPermission('view_customers')) ||
                (currentView === 'settings' && !hasPermission('view_settings_personal') && !hasPermission('view_settings_admin') && !hasPermission('view_settings_roles'))) && (
                 <div className="flex items-center justify-center h-full text-gray-500">
                    Bạn không có quyền truy cập trang này.
                 </div>
              )}
            </div>
          )}
        </main>

        {/* Floating Action Button (Mobile) */}
        {hasPermission('add_orders') && (
          <button 
            onClick={handleAddOrder}
            className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors z-30"
          >
            <PlusCircle size={28} />
          </button>
        )}
      </div>

      <OrderModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitOrder}
        initialData={editingOrder}
        products={MOCK_PRODUCTS}
      />
    </div>
  );
};

export default App;