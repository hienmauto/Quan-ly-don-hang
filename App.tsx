
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, Settings as SettingsIcon, 
  Menu, Bell, PlusCircle, LogOut, Loader2, X, LogIn 
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

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

  // Helper to fetch data
  const fetchData = async () => {
    setIsLoading(true);
    const sheetOrders = await fetchOrdersFromSheet();
    setOrders(sheetOrders);
    setIsLoading(false);
  };

  // Fetch data from Google Sheet on mount
  useEffect(() => {
    fetchData();
  }, []); 

  // Handler for Refresh Button
  const handleRefreshData = async () => {
    await fetchData();
    setToast({ message: 'Dữ liệu đã được làm mới', type: 'success' });
  };

  // --- Permission Helpers ---
  const hasPermission = (perm: Permission) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions.includes(perm);
  };

  // --- Handlers ---
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    setToast({ message: `Xin chào, ${user.fullName}`, type: 'success' });
  };

  const handleLogout = () => {
    performLogout();
    setCurrentUser(null);
    setCurrentView('dashboard');
    setIsProfileMenuOpen(false);
  };

  // Keep restricted: Add Order
  const handleAddOrder = () => {
    if (!currentUser) {
      setToast({ message: 'Vui lòng đăng nhập để tạo đơn hàng mới', type: 'error' });
      setIsLoginModalOpen(true);
      return;
    }
    if (!hasPermission('add_orders')) {
      setToast({ message: 'Bạn không có quyền thêm đơn hàng', type: 'error' });
      return;
    }
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  // Keep restricted: Edit Full Order Details
  const handleEditOrder = (order: Order) => {
    if (!currentUser) {
      setToast({ message: 'Vui lòng đăng nhập để sửa đơn hàng', type: 'error' });
      setIsLoginModalOpen(true);
      return;
    }
    if (!hasPermission('edit_orders')) {
      setToast({ message: 'Bạn không có quyền chỉnh sửa đơn hàng', type: 'error' });
      return;
    }
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  // Public: Delete Order
  const handleDeleteOrder = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa đơn hàng này?')) {
      handleBulkDelete([id]);
    }
  };

  // Public: Status Change
  const handleStatusChange = (id: string, newStatus: OrderStatus) => {
     // Update UI optimistic
     setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  // Helper Delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Public: Bulk Update (Status/Template/Cancel)
  const handleBulkUpdate = async (ids: string[], updates: { status?: OrderStatus, templateStatus?: string }) => {
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
  
  // Public: Bulk Delete
  const handleBulkDelete = async (ids: string[]) => {
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

  const SidebarItem = ({ view, icon: Icon, label, needsLogin = false }: { view: ViewState, icon: any, label: string, needsLogin?: boolean }) => {
    let isVisible = true;
    if (currentUser) {
        if (view === 'customers' && !hasPermission('view_customers')) isVisible = false;
        if (view === 'settings' && (!hasPermission('view_settings_personal') && !hasPermission('view_settings_admin'))) isVisible = false;
    }
    
    if (!isVisible) return null;

    return (
      <button
        onClick={() => {
          if (needsLogin && !currentUser) {
             setIsLoginModalOpen(true);
             if (window.innerWidth < 768) setIsSidebarOpen(false);
             return;
          }
          setCurrentView(view);
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

  return (
    // Updated: supports-[height:100dvh]:h-[100dvh] for better mobile browser support
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-50 overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Login Modal */}
      {isLoginModalOpen && (
        <Login onLoginSuccess={handleLoginSuccess} onClose={() => setIsLoginModalOpen(false)} isModal={true} />
      )}

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

          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-gray-500 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <SidebarItem view="dashboard" icon={LayoutDashboard} label="Tổng Quan" />
          <SidebarItem view="orders" icon={ShoppingCart} label="Đơn Hàng" />
          <SidebarItem view="customers" icon={Users} label="Khách Hàng" needsLogin={true} />
          <SidebarItem view="settings" icon={SettingsIcon} label="Cài Đặt" needsLogin={true} />
        </nav>

        {currentUser && (
          <div className="p-4 border-t border-gray-100 shrink-0">
             <button 
               onClick={handleLogout}
               className={`w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors
                 ${!isSidebarOpen && 'justify-center px-2'}
               `}
               title="Đăng xuất"
             >
               <LogOut size={20} />
               <span className={`font-medium ${!isSidebarOpen && 'hidden md:hidden'}`}>Đăng xuất</span>
             </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold text-gray-800 hidden sm:block">
              {currentView === 'dashboard' && 'Dashboard'}
              {currentView === 'orders' && 'Quản Lý Đơn Hàng'}
              {currentView === 'customers' && 'Danh Sách Khách Hàng'}
              {currentView === 'settings' && 'Cài Đặt Hệ Thống'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleRefreshData}
              className={`p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative ${isLoading ? 'animate-spin text-blue-500' : ''}`}
              title="Làm mới dữ liệu"
            >
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white hidden"></div>
              {isLoading ? <Loader2 size={20} /> : <Bell size={20} />}
            </button>
            
            {/* Create Order Button */}
            <button 
              onClick={handleAddOrder}
              className="hidden sm:flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all shadow-sm font-medium"
            >
              <PlusCircle size={18} />
              <span>Tạo Đơn Mới</span>
            </button>
            
            {/* Create Order Icon (Mobile) */}
            <button 
              onClick={handleAddOrder}
              className="sm:hidden flex items-center justify-center bg-red-600 text-white w-9 h-9 rounded-full shadow-sm"
            >
              <PlusCircle size={20} />
            </button>

            {/* Profile Dropdown or Login Button */}
            {currentUser ? (
              <div className="relative" ref={profileMenuRef}>
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm">
                    {currentUser.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left mr-1">
                    <p className="text-sm font-bold text-gray-700 leading-none">{currentUser.fullName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{currentUser.role}</p>
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-gray-100 md:hidden">
                      <p className="text-sm font-bold text-gray-800">{currentUser.fullName}</p>
                      <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
                    </div>
                    <button 
                      onClick={() => { setCurrentView('settings'); setIsProfileMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <SettingsIcon size={16} /> Cài đặt tài khoản
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">Đăng nhập</span>
              </button>
            )}
          </div>
        </header>

        {/* View Content */}
        {/* Updated: Use overflow-y-auto for Dashboard/Settings to allow scrolling on Mobile. Keep overflow-hidden for Orders. */}
        <div className={`flex-1 p-4 md:p-6 relative w-full ${currentView === 'orders' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
          {currentView === 'dashboard' && <Dashboard orders={orders} />}
          
          {currentView === 'orders' && (
            <OrderList 
              orders={orders} 
              onEdit={handleEditOrder} 
              onDelete={handleDeleteOrder}
              onStatusChange={handleStatusChange}
              onBulkUpdate={handleBulkUpdate}
              onBulkDelete={handleBulkDelete}
              onRefresh={handleRefreshData}
            />
          )}

          {currentView === 'customers' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-white rounded-xl border border-dashed border-gray-300 min-h-[400px]">
              <Users size={48} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium">Quản lý khách hàng đang được phát triển</p>
            </div>
          )}

          {currentView === 'settings' && currentUser && (
            <Settings currentUser={currentUser} onUpdateCurrentUser={setCurrentUser} />
          )}
        </div>
      </main>

      {/* Modals */}
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
