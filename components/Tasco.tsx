
import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, Plus, Edit2, Trash2, Save, X, Search, 
  ChevronRight, ChevronDown, Check, Loader2, Image as ImageIcon,
  RotateCcw, Settings, List, Layers, Square, CheckSquare
} from 'lucide-react';
import { User, Permission } from '../types';
import { 
  fetchTascoFromSheet, 
  addTascoItemToSheet, 
  addBatchTascoItemsToSheet,
  updateTascoItemInSheet, 
  deleteTascoItemFromSheet 
} from '../services/sheetService';

interface TascoItem {
  id: string;
  rowIndex?: number;
  name: string;
  category: string; // 'BRAND' | 'MODEL' | 'YEAR' | 'COLOR'
  parentId?: string;
  description?: string;
  logoUrl?: string;
  code?: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}

interface TascoProps {
  currentUser: User;
}

interface BatchRow {
  id: number;
  name: string;
  code: string;
  logoUrl: string;
}

const Tasco: React.FC<TascoProps> = ({ currentUser }) => {
  // --- STATE ---
  const [items, setItems] = useState<TascoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'print' | 'manage'>('print');
  
  // Print Selection State
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedColorId, setSelectedColorId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    seatRows: [] as string[],
    quantity: 1,
  });

  const previewRef = useRef<HTMLDivElement>(null);

  // Manage State
  const [manageCategory, setManageCategory] = useState<string>('BRAND');
  const [manageSearch, setManageSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit Mode (Single Item)
  const [editingItem, setEditingItem] = useState<Partial<TascoItem> | null>(null);
  
  // Add Mode (Batch)
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [globalBrandId, setGlobalBrandId] = useState<string>('');
  const [globalModelId, setGlobalModelId] = useState<string>('');

  // --- DATA LOADING ---
  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchTascoFromSheet();
    setItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- DERIVED DATA ---
  const selectedBrand = items.find(i => i.id === selectedBrandId);
  const selectedModel = items.find(i => i.id === selectedModelId);
  const selectedYear = items.find(i => i.id === selectedYearId);
  const selectedColor = items.find(i => i.id === selectedColorId);

  const selectedBrandName = selectedBrand?.name || '';
  const selectedBrandLogo = selectedBrand?.logoUrl || '';
  const selectedModelName = selectedModel?.name || '';
  const selectedYearName = selectedYear?.name || '';
  const selectedColorName = selectedColor?.name || '';
  
  // --- NEW PRODUCT CODE LOGIC ---
  const formatModelCode = (code: string | undefined) => {
    if (!code) return '0';
    // Remove leading zeros (e.g. 001 -> 1, 010 -> 10)
    return code.replace(/^0+/, '') || code; 
  };

  const calculateSeatRowCode = (rows: string[]) => {
    const hasRow1 = rows.includes('Tài + Phụ');
    const hasRow2 = rows.includes('Hàng ghế 2');
    const hasRow3 = rows.includes('Hàng ghế 3');
    const hasTrunk = rows.includes('Cốp');

    // Priority logic for mapping selections to code (HGxx)
    if (hasRow1 && hasRow2 && hasRow3) return '03'; // 3 Rows
    if (hasRow1 && hasRow2) return '02'; // 2 Rows
    if (hasTrunk && !hasRow1 && !hasRow2 && !hasRow3) return '04'; // Trunk only
    if (hasRow1) return '01'; // Driver + Passenger (Default for single row)
    
    // Fallback if selections are mixed weirdly or empty, default to 01 or based on count
    return '01'; 
  };

  const colorCode = selectedColor?.code || '00';
  const modelCode = formatModelCode(selectedModel?.code);
  const seatRowCode = calculateSeatRowCode(formData.seatRows);

  const productCode = `D${colorCode}X${modelCode}HG${seatRowCode}`;

  // Filtered Lists for Dropdowns
  const brands = items.filter(i => i.category === 'BRAND' && i.status === 'Active');
  const models = items.filter(i => i.category === 'MODEL' && i.status === 'Active' && i.parentId === selectedBrandId);
  // UPDATED: Show years linked to the model OR years with no parent (global/orphan years)
  const years = items.filter(i => i.category === 'YEAR' && i.status === 'Active' && (i.parentId === selectedModelId || !i.parentId));
  const colors = items.filter(i => i.category === 'COLOR' && i.status === 'Active');
  
  // Helper for Global Dropdowns in Modal
  const globalModels = items.filter(i => i.category === 'MODEL' && i.status === 'Active' && i.parentId === globalBrandId);
  const allActiveModels = items.filter(i => i.category === 'MODEL' && i.status === 'Active');

  // --- PERMISSIONS ---
  const canAdd = currentUser.role === 'admin' || currentUser.permissions.includes('add_tasco');
  const canEdit = currentUser.role === 'admin' || currentUser.permissions.includes('edit_tasco');
  const canDelete = currentUser.role === 'admin' || currentUser.permissions.includes('delete_tasco');

  // --- HANDLERS ---
  const handlePrint = () => {
    if (!previewRef.current) return;
    
    const printContent = previewRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
        <html>
          <head>
            <title>In Tem Tasco</title>
            <link href="https://fonts.googleapis.com/css2?family=Lobster&family=Roboto:wght@400;700&display=swap" rel="stylesheet">
            <style>
              @page { size: 150mm 100mm; margin: 0; }
              body { 
                margin: 0; 
                padding: 0; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                background: #fff; 
              }
              .print-container { 
                 width: 150mm; 
                 height: 100mm; 
                 overflow: hidden; 
                 position: relative;
                 box-sizing: border-box;
                 font-family: "Times New Roman", Times, serif;
                 color: #000;
                 padding: 5mm; 
                 display: flex;
                 flex-direction: column;
              }
              /* Utility classes replication */
              .flex { display: flex; }
              .flex-col { flex-direction: column; }
              .items-center { align-items: center; }
              .justify-center { justify-content: center; }
              .justify-between { justify-content: space-between; }
              .w-full { width: 100%; }
              .h-full { height: 100%; }
              .flex-1 { flex: 1 1 0%; }
              .shrink-0 { flex-shrink: 0; }
              .font-bold { font-weight: bold; }
              .text-center { text-align: center; }
              .leading-none { line-height: 1; }
              .leading-snug { line-height: 1.375; }
              .mb-1 { margin-bottom: 0.25rem; }
              .mb-2 { margin-bottom: 0.5rem; }
              .gap-1 { gap: 0.25rem; }
              .gap-2 { gap: 0.5rem; }
              .gap-8 { gap: 2rem; }
              .pl-2 { padding-left: 0.5rem; }
              .pl-4 { padding-left: 1rem; }
              .pt-1 { padding-top: 0.25rem; }
              .whitespace-nowrap { white-space: nowrap; }
              .align-middle { vertical-align: middle; }
              .align-top { vertical-align: top; }
              .border-collapse { border-collapse: collapse; }
              .text-lg { font-size: 1.125rem; }
              .uppercase { text-transform: uppercase; }
              
              img { max-width: 100%; max-height: 100%; object-fit: contain; }
            </style>
          </head>
          <body>
            <div class="print-container">
               ${printContent}
            </div>
            <script>
               window.onload = () => {
                 setTimeout(() => { window.print(); window.close(); }, 500);
               };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const toggleSeatRow = (row: string) => {
    setFormData(prev => {
      if (prev.seatRows.includes(row)) {
        return { ...prev, seatRows: prev.seatRows.filter(r => r !== row) };
      } else {
        return { ...prev, seatRows: [...prev.seatRows, row] };
      }
    });
  };

  const renderPreviewCheckbox = (label: string) => {
    const checked = formData.seatRows.includes(label);
    return (
      <div className="flex items-center" style={{ gap: '8px' }}>
         <div style={{
             width: '24px', 
             height: '24px', 
             border: '2px solid #000', 
             display: 'flex', 
             alignItems: 'center', 
             justifyContent: 'center',
             borderRadius: '4px',
             position: 'relative',
             backgroundColor: '#fff',
             boxSizing: 'border-box'
         }}>
            {checked && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            )}
         </div>
         <span className="font-bold text-[20px]" style={{color: '#000', paddingTop: '2px', lineHeight: '1'}}>{label}</span>
      </div>
    );
  };

  // --- CRUD HANDLERS ---
  const handleOpenAddModal = () => {
    setEditingItem(null); // Null means Add Mode
    setBatchRows([{ id: Date.now(), name: '', code: '', logoUrl: '' }]);
    setGlobalBrandId('');
    setGlobalModelId('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TascoItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  // Batch Row Management
  const addBatchRow = () => {
    setBatchRows(prev => [...prev, { id: Date.now(), name: '', code: '', logoUrl: '' }]);
  };

  const removeBatchRow = (id: number) => {
    setBatchRows(prev => prev.filter(r => r.id !== id));
  };

  const updateBatchRow = (id: number, field: keyof BatchRow, value: string) => {
    setBatchRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchRows.length === 0) return;
    
    // Validation
    const invalidRows = batchRows.filter(r => !r.name.trim());
    if (invalidRows.length > 0) {
      alert('Vui lòng nhập tên cho tất cả các dòng.');
      return;
    }

    if (manageCategory === 'MODEL' && !globalBrandId) {
      alert('Vui lòng chọn Hãng xe');
      return;
    }

    setIsSaving(true);

    const newItems = batchRows.map((row, idx) => ({
      id: `T${Date.now()}_${idx}`,
      rowIndex: undefined,
      name: row.name,
      category: manageCategory,
      // For Brand: no parent
      // For Model: parent is globalBrandId
      // For Year: no parent (orphan)
      parentId: manageCategory === 'MODEL' ? globalBrandId : '',
      description: '',
      logoUrl: row.logoUrl || '',
      code: row.code || '',
      status: 'Active' as const,
      createdAt: new Date().toISOString()
    }));

    const success = await addBatchTascoItemsToSheet(newItems);
    
    if (success) {
      await loadData();
      setIsModalOpen(false);
    } else {
      alert('Có lỗi xảy ra khi lưu dữ liệu');
    }
    setIsSaving(false);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    setIsSaving(true);
    const success = await updateTascoItemInSheet(editingItem);
    
    if (success) {
      await loadData();
      setIsModalOpen(false);
      setEditingItem(null);
    } else {
      alert('Có lỗi xảy ra khi cập nhật');
    }
    setIsSaving(false);
  };

  const handleDeleteItem = async (item: TascoItem) => {
     if (!confirm(`Bạn chắc chắn muốn xóa "${item.name}"?`)) return;
     if (!item.rowIndex) return;
     
     setIsSaving(true);
     const success = await deleteTascoItemFromSheet(item.rowIndex);
     if (success) {
       await loadData();
     } else {
       alert('Có lỗi xảy ra khi xóa');
     }
     setIsSaving(false);
  };

  // --- MANAGE VIEW ---
  const filteredManageItems = items.filter(i => {
     const matchesCategory = i.category === manageCategory;
     const matchesSearch = i.name.toLowerCase().includes(manageSearch.toLowerCase()) || 
                           (i.code && i.code.toLowerCase().includes(manageSearch.toLowerCase()));
     return matchesCategory && matchesSearch;
  });

  const getParentName = (parentId: string | undefined) => {
     if (!parentId) return '---';
     return items.find(i => i.id === parentId)?.name || parentId;
  };

  return (
    <div className="flex flex-col min-h-full bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 bg-gray-50">
         <div className="flex gap-4">
            <button 
              onClick={() => setViewMode('print')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${viewMode === 'print' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
               <Printer size={18} /> In Tem
            </button>
            {(canAdd || canEdit) && (
              <button 
                onClick={() => setViewMode('manage')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${viewMode === 'manage' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                 <Settings size={18} /> Quản Lý Dữ Liệu
              </button>
            )}
         </div>
         {isLoading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin"/> Đang tải dữ liệu...</div>}
      </div>

      {/* Content */}
      <div className="p-6">
        
        {/* === PRINT VIEW === */}
        {viewMode === 'print' && (
           <div className="flex flex-col gap-8">
              {/* Top Panel: Configuration (Form) */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                 <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4"><Settings size={20}/> Cấu hình in</h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Brand */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Hãng xe</label>
                       <select 
                         className="w-full p-2 border border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-slate-900 text-white"
                         value={selectedBrandId}
                         onChange={e => {
                           setSelectedBrandId(e.target.value);
                           setSelectedModelId('');
                           setSelectedYearId('');
                         }}
                       >
                          <option value="" className="bg-slate-800">-- Chọn hãng --</option>
                          {brands.map(b => <option key={b.id} value={b.id} className="bg-slate-800">{b.name}</option>)}
                       </select>
                    </div>

                    {/* Model */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Dòng xe</label>
                       <select 
                         className="w-full p-2 border border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-slate-900 text-white"
                         value={selectedModelId}
                         onChange={e => {
                           setSelectedModelId(e.target.value);
                           setSelectedYearId('');
                         }}
                         disabled={!selectedBrandId}
                       >
                          <option value="" className="bg-slate-800">-- Chọn dòng xe --</option>
                          {models.map(m => <option key={m.id} value={m.id} className="bg-slate-800">{m.name}</option>)}
                       </select>
                    </div>

                    {/* Year */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Đời xe</label>
                       <select 
                         className="w-full p-2 border border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-slate-900 text-white"
                         value={selectedYearId}
                         onChange={e => setSelectedYearId(e.target.value)}
                         disabled={!selectedModelId}
                       >
                          <option value="" className="bg-slate-800">-- Chọn đời xe --</option>
                          {years.map(y => <option key={y.id} value={y.id} className="bg-slate-800">{y.name}</option>)}
                       </select>
                    </div>

                    {/* Color */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Màu thảm</label>
                       <select 
                         className="w-full p-2 border border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-slate-900 text-white"
                         value={selectedColorId}
                         onChange={e => setSelectedColorId(e.target.value)}
                       >
                          <option value="" className="bg-slate-800">-- Chọn màu --</option>
                          {colors.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.name}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Seat Rows */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Hàng ghế</label>
                       <div className="flex flex-wrap gap-2">
                          {['Tài + Phụ', 'Hàng ghế 2', 'Hàng ghế 3', 'Cốp'].map(row => (
                            <label key={row} className="flex items-center gap-2 cursor-pointer bg-slate-900 p-2 rounded border border-gray-600 hover:border-red-500 text-white">
                               <input 
                                 type="checkbox" 
                                 checked={formData.seatRows.includes(row)}
                                 onChange={() => toggleSeatRow(row)}
                                 className="w-4 h-4 rounded focus:ring-red-500 accent-red-600"
                               />
                               <span className="text-sm font-medium">{row}</span>
                            </label>
                          ))}
                       </div>
                    </div>

                    {/* Quantity */}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Số lượng bộ</label>
                       <input 
                         type="number"
                         min="1"
                         className="w-full max-w-[200px] p-2 border border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-slate-900 text-white"
                         value={formData.quantity}
                         onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                       />
                    </div>
                 </div>

                 <div className="mt-6">
                    <button 
                      onClick={handlePrint}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                       <Printer size={24} /> In Tem Ngay
                    </button>
                 </div>
              </div>

              {/* Bottom Panel: Preview Area */}
              <div className="flex flex-col items-center justify-center bg-gray-200 rounded-xl p-8 border border-gray-300 relative">
                 <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-mono text-gray-600 border border-gray-200">
                    Size: 150x100mm | Margin: 5mm
                 </div>
                 
                 <div 
                   className="bg-white shadow-2xl transition-transform hover:scale-[1.01] shrink-0 cursor-pointer overflow-hidden box-border"
                   title="Preview in ấn"
                   style={{
                     width: '567px', 
                     height: '378px',
                     fontFamily: '"Times New Roman", Times, serif',
                     padding: '18px', // Approx 5mm
                     color: '#000000',
                     position: 'relative'
                   }}
                 >
                    {/* Inner content wrapper */}
                    <div ref={previewRef} className="flex flex-col h-full w-full">
                        {/* Header */}
                        <div className="flex flex-col items-center w-full mb-1 shrink-0">
                            <div className="flex items-center justify-center mb-1 shrink-0 mx-auto" style={{ width: '100%', height: '60px' }}>
                              {selectedBrandLogo ? (
                                <img src={selectedBrandLogo} alt={selectedBrandName} className="object-contain h-full" crossOrigin="anonymous" />
                              ) : (
                                <div className="text-4xl font-extrabold uppercase tracking-widest font-sans text-center text-black w-full" style={{color:'#000'}}>
                                  {selectedBrandName || 'HÃNG XE'}
                                </div>
                              )}
                            </div>
                            <div className="text-center leading-none font-bold shrink-0 text-black w-full" style={{ fontFamily: '"Lobster", cursive', color: '#000000', fontSize: '40px' }}>
                              Thảm Lót Sàn Ô Tô
                            </div>
                        </div>

                        {/* Body - Centered Table */}
                        <div className="w-full flex-1 flex flex-col justify-center items-center">
                           <table className="text-[20px] leading-snug border-collapse" style={{color: '#000000', width: 'auto'}}>
                              <tbody>
                                 <tr>
                                    <td className="font-bold w-[160px] align-middle whitespace-nowrap" style={{color: '#000'}}>• Mã sản phẩm:</td>
                                    <td className="font-bold align-middle pl-2 text-[22px]" style={{color: '#000'}}>{productCode}</td>
                                 </tr>
                                 <tr>
                                    <td className="font-bold align-middle whitespace-nowrap" style={{color: '#000'}}>• Dòng xe:</td>
                                    <td className="font-bold align-middle pl-2 text-[22px]" style={{color: '#000'}}>{selectedModelName}</td>
                                 </tr>
                                 <tr>
                                    <td className="font-bold align-middle whitespace-nowrap" style={{color: '#000'}}>• Đời xe:</td>
                                    <td className="font-bold align-middle pl-2 text-[22px]" style={{color: '#000'}}>{selectedYearName}</td>
                                 </tr>
                                 <tr>
                                    <td className="font-bold align-top whitespace-nowrap pt-2" style={{color: '#000'}}>• Hàng ghế:</td>
                                    <td className="font-bold align-top pl-2 pt-1" style={{color: '#000'}}>
                                       <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: '30px', rowGap: '8px' }}>
                                          {renderPreviewCheckbox('Tài + Phụ')}
                                          {renderPreviewCheckbox('Hàng ghế 2')}
                                          {renderPreviewCheckbox('Hàng ghế 3')}
                                          {renderPreviewCheckbox('Cốp')}
                                       </div>
                                    </td>
                                 </tr>
                                 <tr>
                                    <td className="font-bold align-middle whitespace-nowrap" style={{color: '#000'}}>• Loại thảm:</td>
                                    <td className="font-bold align-middle pl-2 text-[22px]" style={{color: '#000'}}>Diamond</td>
                                 </tr>
                                 <tr>
                                    <td className="font-bold align-middle whitespace-nowrap" style={{color: '#000'}}>• Màu sắc:</td>
                                    <td className="font-bold align-middle pl-2 text-[22px]" style={{color: '#000'}}>{selectedColorName}</td>
                                 </tr>
                                 <tr>
                                    <td className="font-bold align-middle whitespace-nowrap" style={{color: '#000'}}>• Số lượng:</td>
                                    <td className="font-bold align-middle pl-2 text-[22px]" style={{color: '#000'}}>{formData.quantity ? `${formData.quantity} Bộ` : ''}</td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>
                    </div>
                 </div>
                 <p className="text-gray-500 text-xs mt-4 font-medium uppercase tracking-wide">Khổ giấy 150 x 100 mm (Ngang) - Lề 5mm</p>
              </div>
           </div>
        )}

        {/* === MANAGE VIEW === */}
        {viewMode === 'manage' && (
           <div className="h-full flex flex-col">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                 <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                    {['BRAND', 'MODEL', 'YEAR', 'COLOR'].map(cat => (
                      <button 
                        key={cat}
                        onClick={() => { setManageCategory(cat); setManageSearch(''); }}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${manageCategory === cat ? 'bg-white text-red-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {cat === 'BRAND' ? 'Hãng Xe' : cat === 'MODEL' ? 'Dòng Xe' : cat === 'YEAR' ? 'Đời Xe' : 'Màu Sắc'}
                      </button>
                    ))}
                 </div>
                 
                 <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                      value={manageSearch}
                      onChange={e => setManageSearch(e.target.value)}
                    />
                 </div>

                 {canAdd && (
                   <button 
                     onClick={handleOpenAddModal}
                     className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"
                   >
                     <Plus size={18} /> Thêm Mới
                   </button>
                 )}
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase sticky top-0">
                       <tr>
                          <th className="p-4 border-b">Tên</th>
                          {(manageCategory === 'MODEL' || manageCategory === 'COLOR') && <th className="p-4 border-b">Mã (Code)</th>}
                          {manageCategory === 'BRAND' && <th className="p-4 border-b">Logo</th>}
                          {manageCategory === 'MODEL' && <th className="p-4 border-b">Thuộc Hãng</th>}
                          {manageCategory === 'YEAR' && <th className="p-4 border-b">Thuộc Dòng</th>}
                          <th className="p-4 border-b w-24">Trạng thái</th>
                          <th className="p-4 border-b w-24 text-right">Thao tác</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                       {filteredManageItems.length > 0 ? filteredManageItems.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                             <td className="p-4 font-medium text-gray-800">{item.name}</td>
                             {(manageCategory === 'MODEL' || manageCategory === 'COLOR') && <td className="p-4 text-gray-600 font-mono">{item.code || '---'}</td>}
                             {manageCategory === 'BRAND' && (
                                <td className="p-4">
                                   {item.logoUrl ? <img src={item.logoUrl} alt="logo" className="h-8 w-auto object-contain" /> : <span className="text-gray-400 text-xs">No Logo</span>}
                                </td>
                             )}
                             {(manageCategory === 'MODEL' || manageCategory === 'YEAR') && (
                                <td className="p-4 text-gray-600">
                                   {getParentName(item.parentId)}
                                </td>
                             )}
                             <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                   {item.status}
                                </span>
                             </td>
                             <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                   {canEdit && (
                                     <button onClick={() => handleOpenEditModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                       <Edit2 size={16} />
                                     </button>
                                   )}
                                   {canDelete && (
                                     <button onClick={() => handleDeleteItem(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                       <Trash2 size={16} />
                                     </button>
                                   )}
                                </div>
                             </td>
                          </tr>
                       )) : (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-500">Không có dữ liệu</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        )}
      </div>

      {/* === MODAL === */}
      {isModalOpen && (
         <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-fade-in max-h-[90vh] flex flex-col">
               <div className="flex justify-between items-center p-4 border-b">
                  <h3 className="font-bold text-gray-800">
                     {editingItem ? 'Sửa' : 'Thêm'} {manageCategory === 'BRAND' ? 'Hãng' : manageCategory === 'MODEL' ? 'Dòng' : manageCategory === 'YEAR' ? 'Đời' : 'Màu'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
               </div>
               
               {/* ----------------- EDIT FORM (SINGLE ITEM) ----------------- */}
               {editingItem && (
                 <form onSubmit={handleUpdateItem} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Tên <span className="text-red-500">*</span></label>
                       <input 
                          required 
                          className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                          value={editingItem.name || ''}
                          onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                       />
                    </div>

                    {/* Code Field: Only for MODEL, COLOR */}
                    {['MODEL', 'COLOR'].includes(manageCategory) && (
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mã (Code)</label>
                          <input 
                             className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                             value={editingItem.code || ''}
                             onChange={e => setEditingItem({...editingItem, code: e.target.value})}
                          />
                       </div>
                    )}

                    {/* Logo Field for Brand */}
                    {manageCategory === 'BRAND' && (
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                          <input 
                             className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                             value={editingItem.logoUrl || ''}
                             onChange={e => setEditingItem({...editingItem, logoUrl: e.target.value})}
                             placeholder="https://..."
                          />
                       </div>
                    )}

                    {/* Parent Select for Model (Brand) */}
                    {manageCategory === 'MODEL' && (
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Thuộc Hãng <span className="text-red-500">*</span></label>
                          <select 
                             required
                             className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                             value={editingItem.parentId || ''}
                             onChange={e => setEditingItem({...editingItem, parentId: e.target.value})}
                          >
                             <option value="">-- Chọn Hãng --</option>
                             {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                       </div>
                    )}

                    {/* Parent Select for Year (Model) */}
                    {manageCategory === 'YEAR' && (
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Thuộc Dòng Xe <span className="text-red-500">*</span></label>
                          <select 
                             required
                             className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                             value={editingItem.parentId || ''}
                             onChange={e => setEditingItem({...editingItem, parentId: e.target.value})}
                          >
                             <option value="">-- Chọn Dòng Xe --</option>
                             {allActiveModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({getParentName(m.parentId)})</option>
                             ))}
                          </select>
                       </div>
                    )}

                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                       <select 
                          className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                          value={editingItem.status || 'Active'}
                          onChange={e => setEditingItem({...editingItem, status: e.target.value as 'Active' | 'Inactive'})}
                       >
                          <option value="Active">Hoạt động</option>
                          <option value="Inactive">Ẩn</option>
                       </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                       <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                       <button 
                          type="submit" 
                          disabled={isSaving}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2"
                       >
                          {isSaving && <Loader2 className="animate-spin" size={16}/>} Lưu
                       </button>
                    </div>
                 </form>
               )}

               {/* ----------------- ADD FORM (BATCH MODE) ----------------- */}
               {!editingItem && (
                 <form onSubmit={handleSaveBatch} className="p-6 flex flex-col h-full overflow-hidden">
                    
                    {/* GLOBAL PARENT SELECTORS */}
                    {manageCategory === 'MODEL' && (
                    <div className="space-y-3 mb-4 shrink-0 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {/* For MODEL: Select Global Brand */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Hãng Xe (Áp dụng cho tất cả)</label>
                          <select 
                            required
                            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            value={globalBrandId}
                            onChange={e => setGlobalBrandId(e.target.value)}
                          >
                             <option value="">-- Chọn Hãng --</option>
                             {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                    </div>
                    )}

                    {/* DYNAMIC LIST */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-4">
                       {batchRows.map((row, index) => (
                         <div key={row.id} className="flex gap-2 items-center">
                            <span className="text-xs text-gray-400 font-mono w-4">{index + 1}.</span>
                            
                            {/* Name Input (All categories) */}
                            <div className="flex-1">
                               <input 
                                 placeholder="Tên..." 
                                 className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                 value={row.name}
                                 onChange={e => updateBatchRow(row.id, 'name', e.target.value)}
                               />
                            </div>

                            {/* Code Input (Only MODEL, COLOR) */}
                            {['MODEL', 'COLOR'].includes(manageCategory) && (
                               <div className="w-1/3">
                                  <input 
                                    placeholder="Mã (Code)..." 
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={row.code}
                                    onChange={e => updateBatchRow(row.id, 'code', e.target.value)}
                                  />
                               </div>
                            )}

                            {/* Logo Input (Only BRAND) */}
                            {manageCategory === 'BRAND' && (
                               <div className="w-1/3">
                                  <input 
                                    placeholder="Logo URL..." 
                                    className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={row.logoUrl}
                                    onChange={e => updateBatchRow(row.id, 'logoUrl', e.target.value)}
                                  />
                               </div>
                            )}

                            {/* Delete Row Button */}
                            <button 
                              type="button" 
                              onClick={() => removeBatchRow(row.id)}
                              className="p-2 text-gray-400 hover:text-red-500"
                              disabled={batchRows.length === 1}
                            >
                               <Trash2 size={16} />
                            </button>
                            
                            {/* Quick Add Button */}
                            <button 
                              type="button" 
                              onClick={addBatchRow}
                              className="p-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors"
                              title="Thêm dòng"
                            >
                               <Plus size={16} />
                            </button>
                         </div>
                       ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-gray-100 flex justify-end items-center gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center gap-2"
                        >
                            {isSaving && <Loader2 className="animate-spin" size={16}/>} Lưu tất cả
                        </button>
                    </div>
                 </form>
               )}
            </div>
         </div>
      )}
    </div>
  );
};

export default Tasco;
