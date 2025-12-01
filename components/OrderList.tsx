import React, { useState } from 'react';
import { 
  Search, Eye, 
  ChevronLeft, ChevronRight, FileText, CheckSquare, XCircle, X,
  User, MapPin, Truck, Calendar, Package, AlertTriangle, Lock
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderListProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: OrderStatus) => void;
  onBulkUpdate: (ids: string[], updates: { status?: OrderStatus, templateStatus?: string }) => void;
  onBulkDelete: (ids: string[]) => void; // New prop for bulk delete
}

// Define the strictly allowed statuses for selection
const ALLOWED_STATUSES = [
  OrderStatus.PLACED,
  OrderStatus.PRINTED,
  OrderStatus.PACKED,
  OrderStatus.SENT
];

export const OrderList: React.FC<OrderListProps> = ({ orders, onEdit, onDelete, onStatusChange, onBulkUpdate, onBulkDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // View Details State
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Bulk Action State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  
  // Bulk Cancel State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');

  // Bulk Form State (No default values)
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [bulkTemplate, setBulkTemplate] = useState<string>('');

  // Filter Logic
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerPhone.includes(searchTerm);
    
    // Filter status logic maintained but UI removed as requested, effectively defaults to 'all'
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  // Status colors helper
  const getStatusColor = (status: OrderStatus) => {
    // Basic color mapping, now robust to any string
    const s = String(status).toLowerCase();
    if (s.includes('chờ') || s.includes('pending')) return 'text-orange-600 bg-orange-50 border-orange-100';
    if (s.includes('lên đơn') || s.includes('placed')) return 'text-yellow-700 bg-yellow-50 border-yellow-100';
    if (s.includes('in bill') || s.includes('printed')) return 'text-indigo-700 bg-indigo-50 border-indigo-100';
    if (s.includes('đóng') || s.includes('packed')) return 'text-purple-700 bg-purple-50 border-purple-100';
    if (s.includes('gửi') || s.includes('sent')) return 'text-teal-700 bg-teal-50 border-teal-100';
    if (s.includes('thành công') || s.includes('giao')) return 'text-green-700 bg-green-50 border-green-100';
    if (s.includes('hủy') || s.includes('cancelled')) return 'text-red-700 bg-red-50 border-red-100';
    return 'text-gray-700 bg-gray-50 border-gray-100';
  };

  // Format Date Helper
  const formatDateDisplay = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      // If matches simplified format "hh:mm dd-mm"
      if (dateStr.includes(':') && dateStr.includes('-') && dateStr.length <= 11) {
          return dateStr;
      }
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`; 
    } catch {
      return dateStr;
    }
  };

  // Bulk Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredOrders.map(o => o.id);
      setSelectedOrderIds(allIds);
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkUpdateConfirm = () => {
    if (selectedOrderIds.length > 0) {
      const updates: { status?: OrderStatus, templateStatus?: string } = {};
      if (bulkStatus) updates.status = bulkStatus;
      if (bulkTemplate) updates.templateStatus = bulkTemplate;

      if (Object.keys(updates).length > 0) {
        onBulkUpdate(selectedOrderIds, updates);
        setSelectedOrderIds([]); 
        setShowBulkUpdateModal(false);
        setBulkStatus('');
        setBulkTemplate('');
      } else {
        alert("Vui lòng chọn ít nhất một thông tin để cập nhật.");
      }
    }
  };

  const handleBulkCancelClick = () => {
    if (selectedOrderIds.length > 0) {
      setCancelPassword('');
      setShowCancelModal(true);
    }
  };

  const handleConfirmCancelWithPassword = () => {
    if (cancelPassword === '479974') {
      onBulkUpdate(selectedOrderIds, { status: OrderStatus.CANCELLED });
      setSelectedOrderIds([]);
      setShowCancelModal(false);
      setCancelPassword('');
    }
  };

  const selectedOrdersData = orders.filter(o => selectedOrderIds.includes(o.id));
  const isPasswordCorrect = cancelPassword === '479974';
  const isUpdateBtnVisible = bulkStatus !== '' || bulkTemplate !== '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in flex flex-col h-full relative">
      {/* Header / Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText size={20} className="text-blue-600" /> 
          Danh Sách Đơn Hàng
          <span className="text-sm font-normal text-gray-500 bg-white px-2 py-0.5 rounded-full border">
            {filteredOrders.length}
          </span>
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          
          {/* Bulk Action Buttons */}
          {selectedOrderIds.length > 0 && (
            <div className="flex gap-2 mr-2 animate-fade-in">
              <button 
                onClick={() => setShowBulkUpdateModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                <CheckSquare size={16} />
                Cập nhật ({selectedOrderIds.length})
              </button>
              <button 
                onClick={handleBulkCancelClick}
                className="flex items-center gap-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
              >
                <XCircle size={16} />
                Hủy đơn
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT, mã đơn..." 
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table Container with horizontal scroll */}
      <div className="overflow-x-auto custom-scrollbar flex-1 relative">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[2000px]">
          <thead className="bg-white sticky top-0 z-30 shadow-sm">
            <tr className="text-gray-700 text-sm font-bold border-b border-gray-200">
              {/* Pinned Header Checkbox */}
              <th className="p-4 w-[50px] text-center sticky left-0 bg-white z-40 border-r border-gray-100">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                  onChange={handleSelectAll}
                />
              </th>
              
              {/* Pinned Header Order ID */}
              <th className="p-4 border-r border-gray-100 sticky left-[50px] bg-white z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Mã đơn hàng</th>
              
              <th className="p-4 border-r border-gray-100">Đơn vị vận chuyển</th>
              <th className="p-4 border-r border-gray-100 max-w-xs">Sản phẩm</th>
              <th className="p-4 border-r border-gray-100 min-w-[220px]">Trạng thái</th>
              <th className="p-4 border-r border-gray-100">Nền tảng</th>
              <th className="p-4 border-r border-gray-100">Note</th>
              
              {/* Remaining Columns */}
              <th className="p-4 border-r border-gray-100">Mã vận chuyển</th>
              <th className="p-4 border-r border-gray-100">Tên khách</th>
              <th className="p-4 border-r border-gray-100">SĐT khách</th>
              <th className="p-4 border-r border-gray-100">Địa chỉ</th>
              <th className="p-4 border-r border-gray-100">Giá</th>
              <th className="p-4 border-r border-gray-100">Ngày</th>
              <th className="p-4 border-r border-gray-100">Thời gian giao</th>
              <th className="p-4 border-r border-gray-100">Mẫu</th>
              
              <th className="p-4 text-center sticky right-0 bg-white border-l border-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] z-30">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
            {currentOrders.length > 0 ? (
              currentOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                const rowBg = isSelected ? 'bg-blue-50' : 'bg-white';
                
                return (
                  <tr 
                    key={order.id} 
                    onClick={() => handleSelectRow(order.id)}
                    className={`hover:bg-blue-50 transition-colors group cursor-pointer ${rowBg}`}
                  >
                    <td className={`p-4 text-center sticky left-0 group-hover:bg-blue-50 z-20 border-r border-gray-100 ${rowBg}`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none" 
                        checked={isSelected}
                        readOnly 
                      />
                    </td>
                    
                    {/* Mã đơn hàng (Cột A) - Pinned */}
                    <td className={`p-4 border-r border-gray-100 font-medium text-blue-600 sticky left-[50px] group-hover:bg-blue-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${rowBg}`}>
                      {order.id.startsWith('_gen_') ? '' : order.id}
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600">
                      {order.carrier || '---'}
                    </td>

                    <td className="p-4 border-r border-gray-100 max-w-xs truncate" title={order.items.map(i => i.productName).join(', ')}>
                      {order.items.length > 0 ? order.items[0].productName : 'Chưa có SP'}
                      {order.items.length > 1 && <span className="text-gray-400 text-xs ml-1">+{order.items.length - 1}</span>}
                    </td>

                    <td className="p-4 border-r border-gray-100">
                      <span className={`inline-block px-3 py-1.5 rounded-md text-xs font-semibold border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>

                    <td className="p-4 border-r border-gray-100 uppercase text-xs font-bold text-gray-500">
                      {order.platform || 'SHOPEE'}
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600">
                      {order.note || ''}
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600 font-mono text-xs">
                      {order.trackingCode || '---'}
                    </td>

                    <td className="p-4 border-r border-gray-100 font-medium text-gray-800">
                      {order.customerName}
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600">
                      {order.customerPhone}
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600 truncate max-w-[200px]" title={order.address}>
                      {order.address || '---'}
                    </td>

                    <td className="p-4 border-r border-gray-100 font-medium text-gray-800">
                      {order.totalAmount.toLocaleString('vi-VN')} ₫
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600">
                      {formatDateDisplay(order.createdAt)}
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600">
                      <span className="text-gray-900 font-medium">
                        {order.deliveryDeadline || 'Trước 23h59p'}
                      </span>
                    </td>

                    <td className="p-4 border-r border-gray-100 text-gray-600">
                      {order.templateStatus || 'Có mẫu'}
                    </td>

                    {/* Thao tác */}
                    <td className="p-4 text-center sticky right-0 bg-white border-l border-gray-100 group-hover:bg-blue-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] z-20" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button 
                           onClick={() => setViewingOrder(order)}
                           className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-sm"
                           title="Xem chi tiết"
                        >
                           <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={16} className="p-12 text-center text-gray-500">
                  Không tìm thấy đơn hàng nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-white shrink-0">
        <div className="text-sm text-gray-500 hidden sm:block">
          Hiển thị {filteredOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} đến {Math.min(currentPage * itemsPerPage, filteredOrders.length)} trong tổng số {filteredOrders.length}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Cập nhật {selectedOrderIds.length} đơn hàng</h3>
              <button 
                onClick={() => setShowBulkUpdateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Select Status */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Trạng thái mới</label>
                <select 
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white ${!bulkStatus ? 'text-gray-400' : 'text-gray-900'}`}
                >
                  <option value="" disabled>Chọn trạng thái</option>
                  {ALLOWED_STATUSES.map(status => (
                    <option key={status} value={status} className="text-gray-800">{status}</option>
                  ))}
                </select>
              </div>

              {/* Select Template Status */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Tình trạng mẫu</label>
                <select 
                  value={bulkTemplate}
                  onChange={(e) => setBulkTemplate(e.target.value)}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white ${!bulkTemplate ? 'text-gray-400' : 'text-gray-900'}`}
                >
                  <option value="" disabled>Chọn tình trạng mẫu</option>
                  <option value="Có mẫu" className="text-gray-800">Có mẫu</option>
                  <option value="Không có mẫu" className="text-gray-800">Không có mẫu</option>
                </select>
              </div>
              
              {isUpdateBtnVisible && (
                <button 
                  onClick={handleBulkUpdateConfirm}
                  className="w-full mt-6 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Cập nhật
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal for Bulk Cancel */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Xác nhận hủy đơn hàng</h3>
                <p className="text-sm text-gray-600">Bạn đang chọn hủy {selectedOrderIds.length} đơn hàng</p>
              </div>
              <button 
                onClick={() => setShowCancelModal(false)}
                className="ml-auto text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Danh sách đơn hàng:</p>
                <div className="space-y-2">
                  {selectedOrdersData.map((order) => (
                    <div key={order.id} className="text-sm border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                      <span className="font-bold text-gray-800">{order.id.startsWith('_gen_') ? '(Chưa có mã)' : order.id}</span>
                      <span className="text-gray-500 mx-2">-</span>
                      <span className="text-gray-600 truncate inline-block align-bottom max-w-[200px]" title={order.items[0]?.productName}>
                        {order.items[0]?.productName || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Mật khẩu xác nhận</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="password" 
                    value={cancelPassword}
                    onChange={(e) => setCancelPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hủy đơn"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    autoFocus
                  />
                </div>
                {cancelPassword.length > 0 && !isPasswordCorrect && (
                   <p className="text-sm text-red-600 font-medium animate-pulse">
                     Mật khẩu không chính xác
                   </p>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Đóng
                </button>
                {isPasswordCorrect && (
                  <button 
                    onClick={handleConfirmCancelWithPassword}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Xác nhận hủy
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal - (No changes needed here) */}
      {viewingOrder && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setViewingOrder(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="text-blue-600" size={24} />
                Chi tiết đơn hàng
              </h3>
              <button 
                onClick={() => setViewingOrder(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
              <div className="flex flex-wrap gap-4 justify-between items-start mb-6">
                <div>
                   <span className="text-sm text-gray-500 font-medium">Mã đơn hàng</span>
                   <p className="text-2xl font-bold text-gray-800 tracking-tight">{viewingOrder.id.startsWith('_gen_') ? '---' : viewingOrder.id}</p>
                   <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar size={14} /> Ngày tạo: <span className="font-medium text-gray-700">{formatDateDisplay(viewingOrder.createdAt)}</span>
                   </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getStatusColor(viewingOrder.status)}`}>
                      {viewingOrder.status}
                   </span>
                   <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-white bg-gray-500 px-2 py-0.5 rounded">
                          {viewingOrder.platform}
                      </span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 h-full">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                       <User size={18} /> Khách hàng
                    </h4>
                    <div className="space-y-2 text-sm">
                       <p className="flex justify-between"><span className="text-gray-500">Họ tên:</span> <span className="text-gray-900 font-bold text-right">{viewingOrder.customerName}</span></p>
                       <p className="flex justify-between"><span className="text-gray-500">SĐT:</span> <span className="text-gray-900 font-bold text-right">{viewingOrder.customerPhone}</span></p>
                       <div className="pt-2 border-t border-blue-200/50 mt-2">
                          <p className="text-gray-500 mb-1 flex items-center gap-1"><MapPin size={14} /> Địa chỉ:</p>
                          <p className="font-medium text-gray-900 leading-snug">{viewingOrder.address}</p>
                       </div>
                    </div>
                 </div>

                 <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 h-full">
                    <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                       <Truck size={18} /> Vận chuyển & Thông tin
                    </h4>
                    <div className="space-y-2 text-sm">
                       <p className="flex justify-between"><span className="text-gray-500">Đơn vị VC:</span> <span className="text-gray-900 font-bold text-right">{viewingOrder.carrier || '---'}</span></p>
                       <p className="flex justify-between"><span className="text-gray-500">Mã vận đơn:</span> <span className="font-mono font-medium text-purple-700 text-right">{viewingOrder.trackingCode || '---'}</span></p>
                       <p className="flex justify-between"><span className="text-gray-500">Hạn giao:</span> <span className="text-gray-900 font-bold text-right">{viewingOrder.deliveryDeadline}</span></p>
                       <p className="flex justify-between"><span className="text-gray-500">Loại đơn:</span> <span className="font-medium text-orange-600 text-right">{viewingOrder.note}</span></p>
                       <p className="flex justify-between border-t border-purple-200 pt-2 mt-2"><span className="text-gray-500">Trạng thái mẫu:</span> <span className="font-medium text-right text-gray-800">{viewingOrder.templateStatus}</span></p>
                    </div>
                 </div>
              </div>

              <div className="border rounded-xl overflow-hidden mb-6">
                 <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                       <Package size={18} /> Sản phẩm
                    </h4>
                 </div>
                 <div className="divide-y divide-gray-100">
                    {viewingOrder.items.map((item, idx) => (
                       <div key={idx} className="p-4 flex justify-between items-center hover:bg-gray-50/50">
                          <div className="flex-1 pr-4">
                             <p className="font-medium text-gray-800 break-words">{item.productName}</p>
                             <p className="text-xs text-gray-500 mt-1">Số lượng: {item.quantity}</p>
                          </div>
                          <p className="font-medium text-gray-700 whitespace-nowrap">{(item.price * item.quantity).toLocaleString('vi-VN')} ₫</p>
                       </div>
                    ))}
                 </div>
                 <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
                    <span className="font-bold text-gray-600">Tổng tiền thu</span>
                    <span className="text-xl font-bold text-red-600 flex items-center gap-1">
                       {viewingOrder.totalAmount.toLocaleString('vi-VN')} ₫
                    </span>
                 </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};