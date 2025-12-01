import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Upload, Loader2, Save, Download, Search, Image as ImageIcon, FileText } from 'lucide-react';
import { Order, OrderStatus, OrderItem, Product } from '../types';
import { extractOrderFromImage } from '../services/geminiService';
import { addOrdersToSheet, sendOrdersToWebhook } from '../services/sheetService';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Order | Order[]) => void;
  initialData?: Order | null;
  products: Product[];
}

type Tab = 'auto' | 'manual';

const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSubmit, initialData, products }) => {
  const [activeTab, setActiveTab] = useState<Tab>('auto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Trạng thái đang lưu vào Sheet
  
  // --- STATE FOR UPLOAD POPUP ---
  const [isUploadPopupOpen, setIsUploadPopupOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // --- STATE FOR AUTO TAB (List of orders from AI) ---
  const [importedOrders, setImportedOrders] = useState<Partial<Order>[]>([]);

  // --- STATE FOR MANUAL TAB (Single form) ---
  const [formData, setFormData] = useState<Partial<Order>>({
    customerName: '',
    customerPhone: '',
    address: '',
    status: OrderStatus.PRINTED,
    paymentMethod: 'COD',
    items: [],
    platform: 'Shopee',
    note: '',
    carrier: '',
    trackingCode: '',
    id: ''
  });

  // Check validity for Manual Form
  const isFormValid = Boolean(
    formData.customerName?.trim() && 
    formData.address?.trim() && 
    formData.platform && 
    formData.note && 
    formData.templateStatus &&
    formData.items && formData.items.length > 0 && formData.items[0].productName?.trim()
  );

  // Helper to get local date string YYYY-MM-DD
  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
        setActiveTab('manual');
      } else {
        setFormData({
          id: '', // Bỏ mã đơn hàng mặc định
          customerName: '',
          customerPhone: '',
          address: '',
          status: OrderStatus.PRINTED, // Default: Đã in bill
          paymentMethod: 'COD',
          items: [],
          platform: 'Shopee',
          note: 'Đơn thường',
          carrier: '',
          trackingCode: '',
          totalAmount: 0,
          createdAt: getTodayStr(), // Use local date
          templateStatus: 'Có mẫu',
          deliveryDeadline: 'Trước 23h59p'
        });
        
        setImportedOrders([]);
        setPendingFiles([]);
        setIsUploadPopupOpen(false);
        setActiveTab('auto');
      }
    }
  }, [initialData, isOpen]);

  // --- Paste Event Listener for Upload Popup ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isUploadPopupOpen) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      const newFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('pdf') !== -1) {
          const file = items[i].getAsFile();
          if (file) newFiles.push(file);
        }
      }

      if (newFiles.length > 0) {
        setPendingFiles(prev => [...prev, ...newFiles]);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isUploadPopupOpen]);

  // --- Helpers ---
  const calculateTotal = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // --- Handlers for Manual Form ---
  const addManualItem = () => {
    const newItem: OrderItem = {
      productId: 'CUSTOM',
      productName: '',
      price: 0,
      quantity: 1
    };
    const newItems = [...(formData.items || []), newItem];
    setFormData({ ...formData, items: newItems });
  };

  const updateManualItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({
      ...formData,
      items: newItems,
      totalAmount: calculateTotal(newItems)
    });
  };

  const removeManualItem = (index: number) => {
    const newItems = (formData.items || []).filter((_, i) => i !== index);
    setFormData({
      ...formData,
      items: newItems,
      totalAmount: calculateTotal(newItems)
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    setIsSaving(true);
    // Lưu vào sheet
    await addOrdersToSheet([formData]);
    // Gửi Webhook (Sheet service handles the mapping to the requested N8N body format)
    await sendOrdersToWebhook([formData]);
    
    onSubmit(formData as Order);
    setIsSaving(false);
    onClose();
  };

  // --- Handlers for Auto Tab & Upload Popup ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    // Reset input so same file can be selected again if needed
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter(
        file => file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      setPendingFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyzeFiles = async () => {
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);
    setIsUploadPopupOpen(false); // Close popup, show loading on main modal
    const newOrders: Partial<Order>[] = [];

    try {
      for (const file of pendingFiles) {
        const reader = new FileReader();
        const extracted = await new Promise<Partial<Order>[] | null>((resolve) => {
          reader.onload = async () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            const mimeType = file.type;
            const result = await extractOrderFromImage(base64Data, mimeType);
            resolve(result);
          };
          reader.readAsDataURL(file);
        });

        if (extracted && extracted.length > 0) {
          extracted.forEach(o => {
            newOrders.push({
              ...o,
              id: o.id || `DH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              status: OrderStatus.PRINTED, // Default: Đã in bill
              paymentMethod: 'COD',
              items: o.items && o.items.length > 0 ? o.items : [],
              createdAt: o.createdAt || getTodayStr(), // Use local date
              note: o.note || 'Đơn thường',
              templateStatus: o.templateStatus || 'Có mẫu',
              deliveryDeadline: o.deliveryDeadline || 'Trước 23h59p',
              platform: o.platform || 'Shopee'
            });
          });
        }
      }

      setImportedOrders(prev => [...prev, ...newOrders]);
      setPendingFiles([]); // Clear pending files after success

    } catch (error) {
      console.error(error);
      alert("Đã có lỗi xảy ra khi xử lý file.");
      setIsUploadPopupOpen(true); // Re-open popup on error
    } finally {
      setIsProcessing(false);
    }
  };

  const updateImportedOrder = (index: number, field: keyof Order, value: any) => {
    const updated = [...importedOrders];
    updated[index] = { ...updated[index], [field]: value };
    setImportedOrders(updated);
  };
  
  const updateImportedProductString = (index: number, value: string) => {
    const updated = [...importedOrders];
    const currentItems = updated[index].items || [];
    if (currentItems.length > 0) {
      currentItems[0].productName = value;
    } else {
      updated[index].items = [{ productId: 'AI', productName: value, quantity: 1, price: 0 }];
    }
    setImportedOrders(updated);
  };

  const removeImportedOrder = (index: number) => {
    setImportedOrders(importedOrders.filter((_, i) => i !== index));
  };

  const handleAutoSubmit = async () => {
    if (importedOrders.length === 0) return;
    
    setIsSaving(true);
    // Gọi hàm lưu vào Google Sheet
    await addOrdersToSheet(importedOrders);
    // Gọi hàm gửi Webhook N8N
    await sendOrdersToWebhook(importedOrders);
    
    onSubmit(importedOrders as Order[]);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col relative">
          
          {/* Header Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('auto')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'auto' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Thêm tự động
              {activeTab === 'auto' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'manual' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              Thêm thủ công
              {activeTab === 'manual' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
            </button>
            <div className="ml-auto p-4">
               <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
               </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-white">
            
            {/* ================= AUTO TAB ================= */}
            {activeTab === 'auto' && (
              <div className="p-6 h-full flex flex-col">
                {/* Main Upload Button */}
                <div 
                  className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-3 text-center cursor-pointer transition-colors shadow-md group relative mb-4 shrink-0"
                  onClick={() => setIsUploadPopupOpen(true)}
                >
                   {isProcessing ? (
                     <div className="flex items-center justify-center gap-2 py-1">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="font-medium">Đang phân tích {pendingFiles.length > 0 ? pendingFiles.length : ''} file...</span>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center gap-2 py-1">
                        <Upload size={20} />
                        <h3 className="font-bold">Nhập bằng ảnh/pdf đơn hàng</h3>
                     </div>
                   )}
                </div>

                <div className="flex justify-between items-center mb-2 shrink-0">
                   <div className="flex gap-2 w-full max-w-md">
                       <div className="relative flex-1">
                         <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                         <input className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-red-400" placeholder="Search..." />
                       </div>
                       <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-600">
                          <Download size={16} /> Download
                       </button>
                   </div>
                   <span className="text-sm text-gray-500">{importedOrders.length} Records</span>
                </div>

                {/* Data Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 relative bg-white">
                  <div className="absolute inset-0 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1800px]">
                      <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                        <tr className="text-gray-700 text-xs uppercase font-bold border-b border-gray-200">
                          <th className="p-3 w-40 border-r border-gray-100">Mã đơn hàng</th>
                          <th className="p-3 w-48 border-r border-gray-100">Mã vận chuyển</th>
                          <th className="p-3 w-32 border-r border-gray-100">Đơn vị VC</th>
                          <th className="p-3 w-40 border-r border-gray-100">Tên khách</th>
                          <th className="p-3 w-32 border-r border-gray-100">SĐT khách</th>
                          <th className="p-3 w-64 border-r border-gray-100">Địa chỉ</th>
                          <th className="p-3 w-64 border-r border-gray-100">Sản phẩm</th>
                          <th className="p-3 w-32 border-r border-gray-100">Giá</th>
                          <th className="p-3 w-32 border-r border-gray-100">Ngày</th>
                          <th className="p-3 w-32 border-r border-gray-100">Nền tảng</th>
                          <th className="p-3 w-40 border-r border-gray-100">Thời gian giao hàng</th>
                          <th className="p-3 w-32 border-r border-gray-100">Note</th>
                          <th className="p-3 w-32 border-r border-gray-100">Mẫu</th>
                          <th className="p-3 w-10 sticky right-0 bg-gray-50"></th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                        {importedOrders.map((order, idx) => (
                          <tr key={idx} className="hover:bg-red-50/30 group transition-colors">
                            <td className="p-0 border-r border-gray-100">
                              <input value={order.id || ''} onChange={e => updateImportedOrder(idx, 'id', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input value={order.trackingCode || ''} onChange={e => updateImportedOrder(idx, 'trackingCode', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input value={order.carrier || ''} onChange={e => updateImportedOrder(idx, 'carrier', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input value={order.customerName || ''} onChange={e => updateImportedOrder(idx, 'customerName', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input value={order.customerPhone || ''} onChange={e => updateImportedOrder(idx, 'customerPhone', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input value={order.address || ''} onChange={e => updateImportedOrder(idx, 'address', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                               <input 
                                  value={order.items?.[0]?.productName || ''} 
                                  onChange={e => updateImportedProductString(idx, e.target.value)} 
                                  className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" 
                               />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input type="number" value={order.totalAmount || 0} onChange={e => updateImportedOrder(idx, 'totalAmount', Number(e.target.value))} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            <td className="p-0 border-r border-gray-100">
                              <input type="date" value={order.createdAt || ''} onChange={e => updateImportedOrder(idx, 'createdAt', e.target.value)} className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500" />
                            </td>
                            
                            {/* Nền tảng Select */}
                            <td className="p-0 border-r border-gray-100">
                              <select 
                                value={order.platform || 'Shopee'} 
                                onChange={e => updateImportedOrder(idx, 'platform', e.target.value)} 
                                className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500 cursor-pointer"
                              >
                                <option value="Shopee">Shopee</option>
                                <option value="Lazada">Lazada</option>
                                <option value="TikTok">TikTok</option>
                                <option value="Zalo">Zalo</option>
                                <option value="Facebook">Facebook</option>
                              </select>
                            </td>

                            {/* Thời gian giao hàng Select */}
                            <td className="p-0 border-r border-gray-100">
                               <select 
                                value={order.deliveryDeadline || 'Trước 23h59p'} 
                                onChange={e => updateImportedOrder(idx, 'deliveryDeadline', e.target.value)} 
                                className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500 cursor-pointer"
                              >
                                <option value="Trước 23h59p">Trước 23h59p</option>
                                <option value="Trước 11h59p">Trước 11h59p</option>
                              </select>
                            </td>

                            {/* Note Select */}
                            <td className="p-0 border-r border-gray-100">
                              <select 
                                value={order.note || 'Đơn thường'} 
                                onChange={e => updateImportedOrder(idx, 'note', e.target.value)} 
                                className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500 cursor-pointer"
                              >
                                <option value="Đơn thường">Đơn thường</option>
                                <option value="Đơn hỏa tốc">Đơn hỏa tốc</option>
                              </select>
                            </td>

                            {/* Mẫu Select */}
                            <td className="p-0 border-r border-gray-100">
                              <select 
                                value={order.templateStatus || 'Có mẫu'} 
                                onChange={e => updateImportedOrder(idx, 'templateStatus', e.target.value)} 
                                className="w-full px-3 py-2.5 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-red-500 cursor-pointer"
                              >
                                <option value="Có mẫu">Có mẫu</option>
                                <option value="Không có mẫu">Không có mẫu</option>
                              </select>
                            </td>

                            <td className="p-0 text-center sticky right-0 bg-white group-hover:bg-red-50/30">
                              <button onClick={() => removeImportedOrder(idx)} className="w-full h-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {importedOrders.length === 0 && (
                          <tr>
                            <td colSpan={14} className="p-12 text-center text-gray-400 bg-gray-50/50">
                              Chưa có dữ liệu. Hãy tải lên ảnh đơn hàng để AI phân tích.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {importedOrders.length > 0 && (
                   <div className="mt-4 flex justify-end">
                      <button 
                        onClick={handleAutoSubmit}
                        disabled={isSaving}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
                      >
                        {isSaving ? (
                           <>
                              <Loader2 className="animate-spin" size={18} />
                              Đang lưu vào Sheet...
                           </>
                        ) : (
                           `Xác nhận thêm ${importedOrders.length} đơn`
                        )}
                      </button>
                   </div>
                )}
              </div>
            )}

            {/* ================= MANUAL TAB ================= */}
            {activeTab === 'manual' && (
               <div className="p-8 h-full overflow-y-auto custom-scrollbar">
                 <h2 className="text-xl font-bold text-gray-800 mb-6">Thêm đơn hàng</h2>
                 <form onSubmit={handleManualSubmit} className="space-y-6 pb-20">
                   {/* ... (Existing Manual Form fields - same as before) ... */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                       <label className="block text-sm font-medium text-gray-600 mb-1">Mã đơn hàng</label>
                       <input 
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                         placeholder="Nhập mã đơn hàng"
                         value={formData.id}
                         onChange={e => setFormData({...formData, id: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-600 mb-1">Mã vận chuyển</label>
                       <input 
                         className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                         placeholder="Nhập mã vận chuyển"
                         value={formData.trackingCode || ''}
                         onChange={e => setFormData({...formData, trackingCode: e.target.value})}
                       />
                     </div>
                   </div>

                   <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Đơn vị vận chuyển</label>
                      <input 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Nhập đơn vị vận chuyển"
                        value={formData.carrier || ''}
                        onChange={e => setFormData({...formData, carrier: e.target.value})}
                      />
                   </div>

                   <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Tên khách <span className="text-red-500">*</span></label>
                      <input 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Nhập tên khách"
                        value={formData.customerName}
                        onChange={e => setFormData({...formData, customerName: e.target.value})}
                        required
                      />
                   </div>

                   <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">SĐT khách</label>
                      <div className="flex">
                         <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                           🇻🇳 +84
                         </span>
                         <input 
                           className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                           placeholder="Nhập số điện thoại khách"
                           value={formData.customerPhone}
                           onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Địa chỉ <span className="text-red-500">*</span></label>
                      <input 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="Nhập địa chỉ"
                        value={formData.address || ''}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                   </div>

                   <hr className="border-gray-100" />

                   <div>
                     <div className="flex justify-between items-center mb-2">
                       <label className="block text-sm font-medium text-gray-600">Sản phẩm <span className="text-red-500">*</span></label>
                       <button type="button" onClick={addManualItem} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                         <Plus size={14} /> Thêm SP
                       </button>
                     </div>
                     
                     <div className="space-y-4">
                       {formData.items?.map((item, idx) => (
                         <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                            {/* Close Button */}
                            <button type="button" onClick={() => removeManualItem(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                               <X size={18} />
                            </button>

                            <div className="space-y-3">
                               {/* Product Name */}
                               <div>
                                  <label className="text-xs text-gray-500 mb-1 block">Tên sản phẩm</label>
                                  <input 
                                     className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                     placeholder="Nhập tên sản phẩm"
                                     value={item.productName}
                                     onChange={e => updateManualItem(idx, 'productName', e.target.value)}
                                  />
                               </div>

                               <div className="flex gap-4">
                                   {/* Price */}
                                   <div className="flex-1">
                                       <label className="text-xs text-gray-500 mb-1 block">Giá</label>
                                       <input 
                                           type="number"
                                           className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                           placeholder="Nhập giá"
                                           value={item.price}
                                           onChange={e => updateManualItem(idx, 'price', Number(e.target.value))}
                                       />
                                   </div>
                                   {/* Quantity */}
                                   <div className="w-24">
                                       <label className="text-xs font-bold text-gray-700 mb-1 block">Số lượng</label>
                                       <input 
                                           type="number"
                                           className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                           value={item.quantity}
                                           onChange={e => updateManualItem(idx, 'quantity', Number(e.target.value))}
                                       />
                                   </div>
                               </div>
                            </div>
                         </div>
                       ))}
                       {(!formData.items || formData.items.length === 0) && (
                          <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 cursor-pointer hover:bg-gray-100" onClick={addManualItem}>
                             Chưa có sản phẩm. Nhấn để thêm.
                          </div>
                       )}
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Nền tảng <span className="text-red-500">*</span></label>
                        <select 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.platform}
                          onChange={e => setFormData({...formData, platform: e.target.value as any})}
                        >
                           <option value="Shopee">Shopee</option>
                           <option value="Lazada">Lazada</option>
                           <option value="TikTok">TikTok</option>
                           <option value="Zalo">Zalo</option>
                           <option value="Facebook">Facebook</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Note <span className="text-red-500">*</span></label>
                        <select 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.note || 'Đơn thường'}
                          onChange={e => setFormData({...formData, note: e.target.value})}
                        >
                           <option value="Đơn thường">Đơn thường</option>
                           <option value="Đơn hỏa tốc">Đơn hỏa tốc</option>
                        </select>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Mẫu <span className="text-red-500">*</span></label>
                        <select 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.templateStatus || 'Có mẫu'}
                          onChange={e => setFormData({...formData, templateStatus: e.target.value})}
                        >
                           <option value="Có mẫu">Có mẫu</option>
                           <option value="Không có mẫu">Không có mẫu</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Thời gian giao hàng</label>
                         <select 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.deliveryDeadline || 'Trước 23h59p'}
                          onChange={e => setFormData({...formData, deliveryDeadline: e.target.value})}
                        >
                           <option value="Trước 23h59p">Trước 23h59p</option>
                           <option value="Trước 11h59p">Trước 11h59p</option>
                        </select>
                      </div>
                   </div>

                   <div className="flex justify-end pt-4 gap-3">
                      <button type="button" onClick={() => setFormData({})} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2">
                         <Trash2 size={16} /> Xóa form
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSaving || !isFormValid}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm ${
                          isFormValid 
                            ? 'bg-red-600 text-white hover:bg-red-700' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                         {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} 
                         {isSaving ? 'Đang lưu...' : 'Thêm đơn'}
                      </button>
                   </div>
                 </form>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= UPLOAD POPUP OVERLAY ================= */}
      {isUploadPopupOpen && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-70 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
              <div className="flex justify-between items-center p-4 border-b">
                 <h3 className="text-lg font-bold text-gray-800">Upload Đơn Hàng</h3>
                 <button 
                   onClick={() => setIsUploadPopupOpen(false)}
                   className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
                 >
                   <X size={20} />
                 </button>
              </div>
              
              <div className="p-6">
                {/* Drag & Drop Zone */}
                <div 
                  className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-8 text-center cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => uploadInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={handleDrop}
                >
                   <input 
                      type="file" 
                      ref={uploadInputRef} 
                      className="hidden" 
                      accept="image/*,application/pdf"
                      multiple
                      onChange={handleFileSelect}
                   />
                   <Upload size={48} className="mx-auto text-blue-500 mb-4" />
                   <p className="text-lg font-medium text-gray-700">Drop files here, paste or <span className="text-blue-600 underline">browse files</span></p>
                   <p className="text-sm text-gray-500 mt-2">Hỗ trợ ảnh (JPG, PNG) và PDF</p>
                </div>

                {/* Selected Files List */}
                {pendingFiles.length > 0 && (
                   <div className="mt-6">
                      <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                         <ImageIcon size={18} /> 
                         Selected Files ({pendingFiles.length})
                      </h4>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-lg divide-y divide-gray-100">
                         {pendingFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white hover:bg-gray-50">
                               <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500">
                                    {file.type.includes('image') ? <ImageIcon size={20} /> : <FileText size={20} />}
                                  </div>
                                  <div className="min-w-0">
                                     <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                                     <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => removePendingFile(idx)}
                                 className="text-gray-400 hover:text-red-500 p-1"
                               >
                                  <Trash2 size={16} />
                               </button>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                 <button 
                   onClick={() => setIsUploadPopupOpen(false)}
                   className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                 >
                   Hủy bỏ
                 </button>
                 <button 
                   onClick={handleAnalyzeFiles}
                   disabled={pendingFiles.length === 0}
                   className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                 >
                   {pendingFiles.length > 0 ? `Phân tích ${pendingFiles.length} file` : 'Chọn file để tiếp tục'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default OrderModal;