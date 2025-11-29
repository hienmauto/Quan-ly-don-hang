import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, Settings, 
  Menu, Bell, Search, PlusCircle, LogOut, Loader2, X 
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import { OrderList } from './components/OrderList';
import OrderModal from './components/OrderModal';
import { Toast } from './components/Toast';
import { Order, OrderStatus, Product, ViewState } from './types';
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
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Initialize Sidebar state based on screen width (Desktop default open, Mobile default closed)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch data from Google Sheet on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const sheetOrders = await fetchOrdersFromSheet();
      setOrders(sheetOrders);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Handlers
  const handleAddOrder = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleDeleteOrder = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa đơn hàng này?')) {
      handleBulkDelete([id]);
    }
  };

  const handleStatusChange = (id: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  // Helper Delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  const SidebarItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
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
          <SidebarItem view="dashboard" icon={LayoutDashboard} label="Tổng Quan" />
          <SidebarItem view="orders" icon={ShoppingCart} label="Đơn Hàng" />
          <SidebarItem view="customers" icon={Users} label="Khách Hàng" />
          <SidebarItem view="settings" icon={Settings} label="Cài Đặt" />
        </nav>

        <div className="p-4 border-t border-gray-100 shrink-0">
           <button className={`w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors ${!isSidebarOpen && 'justify-center'}`}>
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
            <button 
              onClick={handleAddOrder}
              className="hidden sm:flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium"
            >
              <PlusCircle size={18} />
              Tạo Đơn Mới
            </button>
            <div className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full cursor-pointer transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
              AD
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
              {currentView === 'dashboard' && <Dashboard orders={orders} />}
              {currentView === 'orders' && (
                <OrderList 
                  orders={orders} 
                  onEdit={handleEditOrder} 
                  onDelete={handleDeleteOrder} 
                  onStatusChange={handleStatusChange}
                  onBulkUpdate={handleBulkUpdate}
                  onBulkDelete={handleBulkDelete}
                />
              )}
              {currentView === 'customers' && (
                <div className="bg-white p-12 rounded-xl shadow-sm text-center border border-gray-200">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-600">Quản lý khách hàng</h3>
                  <p className="text-gray-400 mt-2">Tính năng đang được phát triển...</p>
                </div>
              )}
              {currentView === 'settings' && (
                <div className="bg-white p-12 rounded-xl shadow-sm text-center border border-gray-200">
                  <Settings size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-600">Cài đặt hệ thống</h3>
                  <p className="text-gray-400 mt-2">Tính năng đang được phát triển...</p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Floating Action Button (Mobile) */}
        <button 
          onClick={handleAddOrder}
          className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors z-30"
        >
          <PlusCircle size={28} />
        </button>
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