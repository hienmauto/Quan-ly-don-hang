
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, Search, X, Printer, QrCode, ShoppingCart, Construction, Filter, CheckSquare, Square, Loader2, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { 
  fetchTascoFromSheet, 
  addTascoItemToSheet, 
  updateTascoItemInSheet, 
  deleteTascoItemFromSheet 
} from '../services/sheetService';

// --- TYPES ---
type TascoCategory = 'BRAND' | 'MODEL' | 'COLOR' | 'YEAR' | 'SEAT' | 'CARPET_TYPE';

interface TascoItem {
  id: string;
  rowIndex?: number; // Added for Sheet synchronization
  name: string;
  category: TascoCategory;
  parentId?: string; // Used for linking MODEL to BRAND
  description?: string;
  logoUrl?: string; // Link logo cho Hãng xe
  code?: string; // Mã số (New field)
  status: 'Active' | 'Inactive';
  createdAt: string;
}

interface TascoProps {
  currentUser: User;
}

const CATEGORY_LABELS: Record<TascoCategory, string> = {
  BRAND: 'Hãng xe',
  MODEL: 'Tên xe',
  COLOR: 'Màu thảm',
  YEAR: 'Đời xe',
  SEAT: 'Hàng ghế',
  CARPET_TYPE: 'Loại thảm'
};

// Static seat options (Shared between PrintTab and CodeManagerTab)
const SEAT_OPTIONS = [
  'Tài + Phụ',
  'Hàng ghế 2',
  'Hàng ghế 3',
  'Cốp'
];

// Helper to load html2canvas dynamically
const loadHtml2Canvas = () => {
  return new Promise<any>((resolve, reject) => {
    if ((window as any).html2canvas) {
      resolve((window as any).html2canvas);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve((window as any).html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const Tasco: React.FC<TascoProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'print' | 'code' | 'orders'>('print');
  const [items, setItems] = useState<TascoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data on mount
  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchTascoFromSheet();
    setItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers for Data Management via Sheet Service
  const handleAddItem = async (item: TascoItem) => {
    // Optimistic UI update not ideal for row index sync, so we reload after add
    // Or temporarily add to list
    setItems(prev => [item, ...prev]); 
    const success = await addTascoItemToSheet(item);
    if (success) {
      // Reload to get correct rowIndex from sheet
      await loadData(); 
    } else {
      alert("Lỗi khi thêm vào Google Sheet");
    }
  };

  const handleUpdateItem = async (updatedItem: TascoItem) => {
    setItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    const success = await updateTascoItemInSheet(updatedItem);
    if (!success) {
      alert("Lỗi khi cập nhật vào Google Sheet");
      await loadData(); // Revert on failure
    }
  };

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;

    setItems(prev => prev.filter(item => item.id !== id));
    
    // We need rowIndex to delete specific row
    if (itemToDelete.rowIndex) {
      const success = await deleteTascoItemFromSheet(itemToDelete.rowIndex);
      if (!success) {
         alert("Lỗi khi xóa khỏi Google Sheet");
         await loadData(); // Revert
      }
    } else {
       console.warn("Missing rowIndex for deletion, reloading data...");
       await loadData();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto justify-between items-center pr-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'print' ? 'text-blue-600 bg-white border-t-2 border-t-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Printer size={18} />
            In tem
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'code' ? 'text-blue-600 bg-white border-t-2 border-t-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <QrCode size={18} />
            Quản lý code
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'orders' ? 'text-blue-600 bg-white border-t-2 border-t-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart size={18} />
            Quản lý đơn hàng tasco
          </button>
        </div>
        
        {/* Refresh Button */}
        <button 
          onClick={loadData} 
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-full transition-colors"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {isLoading && items.length === 0 ? (
           <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-blue-600" size={32} />
           </div>
        ) : (
          <>
            {activeTab === 'print' && <PrintTab items={items} />}
            {activeTab === 'code' && (
              <CodeManagerTab 
                currentUser={currentUser} 
                items={items}
                onAdd={handleAddItem}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            )}
            {activeTab === 'orders' && <OrdersTab />}
          </>
        )}
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const PrintTab: React.FC<{ items: TascoItem[] }> = ({ items }) => {
  const [formData, setFormData] = useState({
    brandId: '',
    modelId: '',
    colorId: '',
    yearId: '',
    selectedSeats: [] as string[],
    quantity: 1
  });
  const [isPrinting, setIsPrinting] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  const activeItems = items.filter(i => i.status === 'Active');
  
  const brands = activeItems.filter(i => i.category === 'BRAND');
  // Filter models based on selected brand
  const models = activeItems.filter(i => i.category === 'MODEL' && i.parentId === formData.brandId);
  
  const colors = activeItems.filter(i => i.category === 'COLOR');
  const years = activeItems.filter(i => i.category === 'YEAR');

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      if (field === 'brandId') {
          return { ...prev, [field]: value, modelId: '' }; // Reset model when brand changes
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleSeat = (seat: string) => {
    setFormData(prev => {
      const current = prev.selectedSeats;
      if (current.includes(seat)) {
        return { ...prev, selectedSeats: current.filter(s => s !== seat) };
      } else {
        return { ...prev, selectedSeats: [...current, seat] };
      }
    });
  };

  const getLabel = (id: string, list: TascoItem[]) => list.find(i => i.id === id)?.name || '';
  const getItem = (id: string, list: TascoItem[]) => list.find(i => i.id === id);

  const selectedBrandItem = getItem(formData.brandId, brands);
  const selectedBrandName = selectedBrandItem?.name || '';
  const selectedBrandLogo = selectedBrandItem?.logoUrl || '';

  const selectedModelName = getLabel(formData.modelId, models);
  const selectedColorName = getLabel(formData.colorId, colors);
  const selectedYearName = getLabel(formData.yearId, years);

  // Get Codes for Product Code Construction
  const selectedModelCode = models.find(m => m.id === formData.modelId)?.code || '';
  const selectedColorCode = colors.find(c => c.id === formData.colorId)?.code || '';
  
  // Logic for Seat Code
  const getSeatCode = (selected: string[]) => {
    const hasTP = selected.includes('Tài + Phụ');
    const hasHG2 = selected.includes('Hàng ghế 2');
    const hasHG3 = selected.includes('Hàng ghế 3');
    const hasC = selected.includes('Cốp');
    
    // Strict matching based on requirements
    if (hasTP && hasHG2 && hasHG3 && hasC) return '03';
    if (hasTP && hasHG2 && hasHG3 && !hasC) return '02';
    if (hasTP && hasHG2 && !hasHG3 && hasC) return '04';
    if (hasTP && hasHG2 && !hasHG3 && !hasC) return '01';

    return '';
  };

  const seatCode = getSeatCode(formData.selectedSeats);

  // Construct Product Code
  const productCode = useMemo(() => {
    const formatModelCode = (code: string) => {
        if (!code) return '';
        // Remove leading zeros: 001 -> 1, 010 -> 10, 000 -> 0
        return code.replace(/^0+(?!$)/, '') || code; 
    };

    const cCode = selectedColorCode || '';
    const mCode = formatModelCode(selectedModelCode);
    const sCode = seatCode || '';

    if (!cCode && !mCode && !sCode) return '---';
    
    return `D${cCode}X${mCode}HG${sCode}`;
  }, [selectedModelCode, selectedColorCode, seatCode]);

  // Handle Print Action (Generate Image)
  const handlePrint = async () => {
    if (!previewRef.current) return;
    setIsPrinting(true);

    try {
      const html2canvas = await loadHtml2Canvas();
      
      const canvas = await html2canvas(previewRef.current, {
        scale: 3, // High DPI for print quality
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (doc: Document) => {
           // Remove shadow and hover effects in the cloned document before capturing
           const el = doc.getElementById('print-preview-card');
           if (el) {
             el.style.boxShadow = 'none';
             el.style.transform = 'none';
             el.classList.remove('cursor-pointer', 'shadow-2xl', 'hover:scale-[1.02]');
           }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Vui lòng cho phép popup để in.');
        setIsPrinting(false);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>In Tem - ${productCode}</title>
            <style>
              @page {
                size: 150mm 100mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background-color: white;
              }
              img {
                width: 150mm;
                height: 100mm;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${imgData}" onload="window.print();" />
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (err) {
      console.error("Lỗi khi tạo ảnh in:", err);
      alert('Không thể tạo ảnh in. Vui lòng kiểm tra logo (CORS) hoặc thử lại.');
    } finally {
      setIsPrinting(false);
    }
  };

  const renderPreviewCheckbox = (label: string) => {
    const isSelected = formData.selectedSeats.includes(label);
    return (
        <div className="flex items-center gap-2 whitespace-nowrap">
            {isSelected ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
            )}
            <span className="font-bold text-black text-xl" style={{color: '#000000'}}>{label}</span>
        </div>
    );
  };

  // Dark select style class
  const darkSelectClass = "w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-gray-900 text-white transition-all hover:border-gray-500 placeholder-gray-400";

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Printer size={20} className="text-blue-600" />
        Thiết kế và In Tem
      </h3>
      
      <div className="flex flex-col gap-6 pb-20">
        {/* Input Form */}
        <div className="space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Group Hãng xe & Tên xe */}
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hãng xe</label>
                <select 
                  className={darkSelectClass}
                  value={formData.brandId}
                  onChange={(e) => handleChange('brandId', e.target.value)}
                >
                  <option value="" className="text-gray-400">Chọn hãng xe</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
             </div>

             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên xe</label>
                 <select 
                  className={`${darkSelectClass} ${!formData.brandId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  value={formData.modelId}
                  onChange={(e) => handleChange('modelId', e.target.value)}
                  disabled={!formData.brandId}
                >
                  <option value="" className="text-gray-400">Chọn tên xe</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Màu thảm */}
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Màu thảm</label>
               <select 
                className={darkSelectClass}
                value={formData.colorId}
                onChange={(e) => handleChange('colorId', e.target.value)}
              >
                <option value="" className="text-gray-400">Chọn màu thảm</option>
                {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Đời xe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đời xe</label>
               <select 
                className={darkSelectClass}
                value={formData.yearId}
                onChange={(e) => handleChange('yearId', e.target.value)}
              >
                <option value="" className="text-gray-400">Chọn đời xe</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          </div>

          {/* Hàng ghế (Checkboxes) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hàng ghế</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SEAT_OPTIONS.map((seat) => {
                const isSelected = formData.selectedSeats.includes(seat);
                return (
                  <div 
                    key={seat}
                    onClick={() => toggleSeat(seat)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-gray-900 border-gray-900 text-white' 
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {isSelected ? (
                       <CheckSquare size={20} className="text-red-500" /> 
                    ) : (
                       <Square size={20} className="text-gray-400" />
                    )}
                    <span className="font-medium text-sm">{seat}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Số lượng */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                <input 
                  type="number"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-gray-900 text-white transition-all hover:border-gray-500"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', Number(e.target.value))}
                />
              </div>

              {/* Mã số (New Field Display) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã số</label>
                <div className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white font-mono font-bold tracking-wider">
                   {productCode}
                </div>
              </div>
          </div>

          <div className="pt-2">
            <button 
              onClick={handlePrint}
              disabled={isPrinting}
              className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPrinting ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />}
              {isPrinting ? 'Đang tạo ảnh...' : 'Tiến hành in'}
            </button>
          </div>
        </div>

        {/* Preview Area - Moved below the form */}
        <div className="flex flex-col items-center justify-center bg-gray-200 rounded-xl p-8 border border-gray-300 overflow-auto">
           <div 
             ref={previewRef}
             id="print-preview-card"
             className="bg-white text-black shadow-2xl flex flex-col box-border relative transition-transform hover:scale-[1.02] shrink-0 cursor-pointer"
             title="Nhấn để xem preview in"
             style={{
               width: '567px', // 150mm * 3.78 px/mm
               height: '378px', // 100mm * 3.78 px/mm
               fontFamily: '"Times New Roman", Times, serif',
               padding: '5mm',
               color: '#000000'
             }}
           >
              {/* Content Wrapper for Vertical Centering */}
              <div className="flex flex-col h-full justify-center">
                  
                  {/* Logo: ~21% height */}
                  <div 
                    className="flex items-center justify-center mb-1 shrink-0 mx-auto"
                    style={{ width: '100%', height: '80px' }}
                  >
                    {selectedBrandLogo ? (
                      <img 
                        src={selectedBrandLogo} 
                        alt={selectedBrandName} 
                        className="w-full h-full object-contain" 
                        crossOrigin="anonymous" 
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center text-3xl font-extrabold uppercase tracking-widest font-sans text-center border border-dashed border-gray-300 text-black"
                        style={{color:'#000'}}
                      >
                        {selectedBrandName || 'HÃNG XE'}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div 
                    className="text-center leading-none mb-4 font-bold shrink-0 text-black w-full" 
                    style={{ fontFamily: '"Lobster", cursive', color: '#000000', fontSize: '38px' }}
                  >
                     Thảm Lót Sàn Ô Tô
                  </div>

                  {/* Details List - Centered Table */}
                  <div className="w-full flex justify-center">
                     <table className="text-[18px] leading-snug border-collapse" style={{color: '#000000', width: 'auto'}}>
                        <tbody>
                           <tr>
                              <td className="font-bold w-[140px] align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Mã sản phẩm:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>{productCode}</td>
                           </tr>
                           <tr>
                              <td className="font-bold align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Dòng xe:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>{selectedModelName}</td>
                           </tr>
                           <tr>
                              <td className="font-bold align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Đời xe:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>{selectedYearName}</td>
                           </tr>
                           <tr>
                              <td className="font-bold align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Hàng ghế:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>
                                 <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-8">
                                       {renderPreviewCheckbox('Tài + Phụ')}
                                       {renderPreviewCheckbox('Hàng ghế 2')}
                                    </div>
                                    <div className="flex items-center gap-8">
                                       {renderPreviewCheckbox('Hàng ghế 3')}
                                       {renderPreviewCheckbox('Cốp')}
                                    </div>
                                 </div>
                              </td>
                           </tr>
                           <tr>
                              <td className="font-bold align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Loại thảm:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>Diamond</td>
                           </tr>
                           <tr>
                              <td className="font-bold align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Màu sắc:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>{selectedColorName}</td>
                           </tr>
                           <tr>
                              <td className="font-bold align-top py-1 whitespace-nowrap" style={{color: '#000'}}>• Số lượng:</td>
                              <td className="font-bold align-top py-1 pl-4" style={{color: '#000'}}>{formData.quantity ? `${formData.quantity} Bộ` : ''}</td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
              </div>
           </div>
           <p className="text-gray-500 text-xs mt-4 font-medium uppercase tracking-wide">Khổ giấy 150 x 100 mm (Ngang) - Lề 5mm</p>
        </div>
      </div>
    </div>
  );
};

interface CodeManagerProps {
  currentUser: User;
  items: TascoItem[];
  onAdd: (item: TascoItem) => void;
  onUpdate: (item: TascoItem) => void;
  onDelete: (id: string) => void;
}

const CodeManagerTab: React.FC<CodeManagerProps> = ({ currentUser, items, onAdd, onUpdate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<TascoCategory | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TascoItem | null>(null);
  
  // Form State for shared properties
  const [formData, setFormData] = useState<Partial<TascoItem>>({
    category: 'BRAND',
    status: 'Active',
    parentId: '',
  });

  // State for multiple entries (creation mode)
  const [entries, setEntries] = useState<{ name: string, logoUrl: string, code: string }[]>([{ name: '', logoUrl: '', code: '' }]);

  // Permissions Helpers
  const canAdd = currentUser.role === 'admin' || currentUser.permissions.includes('add_tasco');
  const canEdit = currentUser.role === 'admin' || currentUser.permissions.includes('edit_tasco');
  const canDelete = currentUser.role === 'admin' || currentUser.permissions.includes('delete_tasco');

  // Filter Logic
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getParentName = (parentId?: string) => {
    if (!parentId) return '';
    return items.find(i => i.id === parentId)?.name || '---';
  };

  const handleOpenModal = (item?: TascoItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        category: item.category,
        status: item.status,
        parentId: item.parentId || '',
        description: item.description || '',
      });
      // Edit mode: single entry with existing data
      setEntries([{ name: item.name, logoUrl: item.logoUrl || '', code: item.code || '' }]);
    } else {
      setEditingItem(null);
      setFormData({
        category: filterCategory !== 'ALL' && filterCategory !== 'SEAT' ? filterCategory : 'BRAND', // Default to BRAND, exclude SEAT for new
        status: 'Active',
        parentId: '',
        description: '',
      });
      // Create mode: start with one empty entry
      setEntries([{ name: '', logoUrl: '', code: '' }]);
    }
    setIsModalOpen(true);
  };

  const handleAddEntry = () => {
    setEntries(prev => [...prev, { name: '', logoUrl: '', code: '' }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleEntryChange = (index: number, field: 'name' | 'logoUrl' | 'code', value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate: At least one name must be present
    const validEntries = entries.filter(e => e.name.trim() !== '');
    if (validEntries.length === 0) return;

    if (editingItem) {
      onUpdate({
        ...editingItem,
        ...formData as any,
        name: validEntries[0].name,
        logoUrl: validEntries[0].logoUrl,
        code: validEntries[0].code
      });
    } else {
      // Create multiple items
      validEntries.forEach((entry, idx) => {
        const newItem: TascoItem = {
          id: `T${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10000)}`,
          name: entry.name,
          category: formData.category!,
          status: formData.status as 'Active' | 'Inactive',
          parentId: formData.parentId,
          description: formData.description,
          logoUrl: entry.logoUrl,
          code: entry.code,
          createdAt: new Date().toISOString().split('T')[0]
        };
        onAdd(newItem);
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Xác nhận xóa dòng này?')) {
      onDelete(id);
    }
  };

  // Available brands for the Parent Select when creating a Model
  const availableBrands = items.filter(i => i.category === 'BRAND' && i.status === 'Active');

  // Define style for black background white text select
  const darkSelectStyle = "pl-9 pr-4 py-2 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white cursor-pointer";

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar & Actions */}
      <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full sm:w-auto">
          {/* Category Filter */}
           <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <select 
               className={darkSelectStyle}
               value={filterCategory}
               onChange={(e) => setFilterCategory(e.target.value as any)}
             >
               <option value="ALL">Tất cả danh mục</option>
               <option value="BRAND">Hãng xe</option>
               <option value="MODEL">Tên xe</option>
               <option value="COLOR">Màu thảm</option>
               <option value="CARPET_TYPE">Loại thảm</option>
               <option value="YEAR">Đời xe</option>
               <option value="SEAT">Hàng ghế</option>
             </select>
           </div>
        </div>

        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {canAdd && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <Plus size={18} /> Thêm mới
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white sticky top-0 z-10 shadow-sm">
            <tr className="text-gray-600 text-xs font-bold uppercase border-b border-gray-200 bg-gray-50">
              <th className="p-4">Danh mục</th>
              <th className="p-4">Link Logo</th>
              <th className="p-4">Tên</th>
              <th className="p-4">Thuộc Hãng</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4">Ngày tạo</th>
              {(canEdit || canDelete) && <th className="p-4 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-4">
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </td>
                  <td className="p-4 max-w-[200px] truncate">
                    {item.logoUrl ? (
                       <a href={item.logoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block" title={item.logoUrl}>
                         {item.logoUrl}
                       </a>
                    ) : (
                       <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-800 font-medium">
                    <div className="flex items-center gap-2">
                      {item.category === 'BRAND' && item.logoUrl && (
                        <img src={item.logoUrl} alt="logo" className="w-6 h-6 object-contain" />
                      )}
                      {item.name}
                      {item.code && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded ml-1 border border-gray-300 font-mono">{item.code}</span>}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 italic">
                    {item.category === 'MODEL' ? getParentName(item.parentId) : '-'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      item.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">{item.createdAt}</td>
                  {(canEdit || canDelete) && (
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <button 
                            onClick={() => handleOpenModal(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
             <div className="p-4 border-b border-gray-700 flex justify-between items-center">
               <h3 className="font-bold text-white text-lg">{editingItem ? 'Sửa thông tin' : 'Thêm mới'}</h3>
               <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Loại danh mục</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    disabled={!!editingItem} // Disable category change when editing
                  >
                    <option value="BRAND">Hãng xe</option>
                    <option value="MODEL">Tên xe</option>
                    <option value="COLOR">Màu thảm</option>
                    <option value="CARPET_TYPE">Loại thảm</option>
                    <option value="YEAR">Đời xe</option>
                  </select>
               </div>
               
               {/* Nếu chọn Tên xe thì phải chọn Hãng xe cha */}
               {formData.category === 'MODEL' && (
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Thuộc Hãng xe</label>
                    <select 
                      className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white"
                      value={formData.parentId}
                      onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      required
                    >
                      <option value="" className="text-gray-500">Chọn hãng xe</option>
                      {availableBrands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                 </div>
               )}

               {/* Dynamic Entries */}
               <div className="space-y-3">
                 <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-400">Danh sách ({entries.length})</label>
                    {!editingItem && (
                      <button type="button" onClick={handleAddEntry} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <Plus size={14} /> Thêm dòng
                      </button>
                    )}
                 </div>
                 
                 <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-3 pr-2">
                   {entries.map((entry, idx) => (
                     <div key={idx} className="p-3 bg-gray-700/50 rounded-lg border border-gray-600 relative group">
                        {!editingItem && entries.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveEntry(idx)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} />
                          </button>
                        )}
                        <div className="space-y-3">
                           <div>
                             <label className="block text-xs font-medium text-gray-500 mb-1">Tên hiển thị {idx + 1}</label>
                             <input 
                               required
                               className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white placeholder-gray-500"
                               value={entry.name}
                               onChange={(e) => handleEntryChange(idx, 'name', e.target.value)}
                               placeholder={`Nhập tên ${CATEGORY_LABELS[formData.category!] || ''}...`}
                             />
                           </div>
                           
                           {/* Show Logo input only for BRAND */}
                           {formData.category === 'BRAND' && (
                             <div>
                               <label className="block text-xs font-medium text-gray-500 mb-1">Link Logo (URL)</label>
                               <input 
                                 className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white placeholder-gray-500"
                                 value={entry.logoUrl}
                                 onChange={(e) => handleEntryChange(idx, 'logoUrl', e.target.value)}
                                 placeholder="https://example.com/logo.png"
                               />
                             </div>
                           )}

                           {/* Show Code input for MODEL and COLOR */}
                           {(formData.category === 'MODEL' || formData.category === 'COLOR') && (
                             <div>
                               <label className="block text-sm font-medium text-gray-400 mb-1">Mã số</label>
                               <input 
                                 className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white placeholder-gray-500"
                                 value={entry.code || ''}
                                 onChange={(e) => handleEntryChange(idx, 'code', e.target.value)}
                                 placeholder="Nhập mã số"
                               />
                             </div>
                           )}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>

               <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Trạng thái</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-900 text-white"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
               </div>

               <div className="pt-4 flex justify-end gap-3 border-t border-gray-700 mt-4">
                  <button 
                   type="button" 
                   onClick={() => setIsModalOpen(false)} 
                   className="px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                 >
                   Hủy
                 </button>
                  <button 
                   type="submit" 
                   className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2"
                 >
                   {editingItem ? 'Cập nhật' : 'Thêm mới'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

const OrdersTab = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Construction size={48} className="mb-4 text-gray-300" />
      <p className="text-lg font-medium">Quản lý đơn hàng Tasco đang được phát triển</p>
    </div>
  );
};

export default Tasco;
