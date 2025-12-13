

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart4, Calendar, TrendingUp, TrendingDown, Save, Loader2, AlertCircle, DollarSign, 
  ShoppingCart, RotateCcw, XCircle, Megaphone, Minus, Award, Layers, PieChart, Download,
  Plus, Trash2, X, Edit2, Palette, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { SummaryRecord, Platform } from '../types';
import { fetchSummaryFromSheet, saveSummaryToSheet } from '../services/sheetService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const DEFAULT_PLATFORMS: Platform[] = ['Shopee', 'Lazada', 'TikTok', 'Zalo', 'Facebook'];

const PRESET_COLORS = [
  '#ee4d2d', // Shopee Orange
  '#0f146d', // Lazada Blue
  '#000000', // TikTok Black
  '#1877f2', // Facebook Blue
  '#0068ff', // Zalo Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
];

const Summary: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Manage Platforms List
  const [platforms, setPlatforms] = useState<Platform[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_platforms');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return DEFAULT_PLATFORMS;
        }
      }
    }
    return DEFAULT_PLATFORMS;
  });

  // Manage Platform Colors
  const [platformColors, setPlatformColors] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_platform_colors');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return {};
        }
      }
    }
    return {};
  });

  const [records, setRecords] = useState<SummaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'detail' | 'overview'>('detail'); 
  const [activePlatform, setActivePlatform] = useState<Platform>(platforms[0] || 'Shopee');

  // Delete Platform State
  const [platformToDelete, setPlatformToDelete] = useState<Platform | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Add/Edit Platform Modal State
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null); // null = Add mode, string = Edit mode (old name)
  const [platformForm, setPlatformForm] = useState({ name: '', color: '#000000' });

  // Input state for current selection (Detail Tab)
  const [currentData, setCurrentData] = useState<SummaryRecord>({
    monthKey: selectedMonth,
    platform: activePlatform,
    totalRevenue: 0,
    totalOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
    cancelledAmount: 0,
    returnedAmount: 0,
    adSpend: 0
  });

  // Ref for capturing PDF
  const overviewRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Save platforms to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('app_platforms', JSON.stringify(platforms));
  }, [platforms]);

  // Save colors to localStorage
  useEffect(() => {
    localStorage.setItem('app_platform_colors', JSON.stringify(platformColors));
  }, [platformColors]);

  useEffect(() => {
    // When month or platform changes, find existing data or reset
    const exist = records.find(r => r.monthKey === selectedMonth && r.platform === activePlatform);
    if (exist) {
      setCurrentData(exist);
    } else {
      setCurrentData({
        monthKey: selectedMonth,
        platform: activePlatform,
        totalRevenue: 0,
        totalOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0,
        cancelledAmount: 0,
        returnedAmount: 0,
        adSpend: 0
      });
    }
  }, [selectedMonth, activePlatform, records]);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchSummaryFromSheet();
    setRecords(data);
    setIsLoading(false);
  };

  const handleInputChange = (field: keyof SummaryRecord, value: number) => {
    setCurrentData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Update local records first
    const updatedRecords = [...records];
    const index = updatedRecords.findIndex(r => r.monthKey === selectedMonth && r.platform === activePlatform);
    
    if (index >= 0) {
      updatedRecords[index] = currentData;
    } else {
      updatedRecords.push(currentData);
    }
    
    setRecords(updatedRecords);

    // Save to sheet
    const success = await saveSummaryToSheet([currentData]);
    
    setIsSaving(false);
    if (success) {
      loadData(); 
    } else {
      alert("Lỗi khi lưu dữ liệu!");
    }
  };

  // --- Platform Management Handlers ---
  
  const handleOpenAddPlatform = () => {
    setEditingTarget(null);
    setPlatformForm({ name: '', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] });
    setIsPlatformModalOpen(true);
  };

  const handleOpenEditPlatform = (e: React.MouseEvent, p: Platform) => {
    e.stopPropagation();
    const currentColor = platformColors[p] || getDefaultColor(p);
    setEditingTarget(p);
    setPlatformForm({ name: p, color: currentColor });
    setIsPlatformModalOpen(true);
  };

  const handleSavePlatform = (e: React.FormEvent) => {
    e.preventDefault();
    const name = platformForm.name.trim();
    if (!name) return;

    if (editingTarget) {
      // EDIT MODE
      if (name !== editingTarget && platforms.some(p => p.toLowerCase() === name.toLowerCase())) {
        alert("Tên sàn này đã tồn tại!");
        return;
      }

      // 1. Update Platforms List
      const newPlatforms = platforms.map(p => p === editingTarget ? name : p);
      setPlatforms(newPlatforms);

      // 2. Update Colors Map (Remove old key, add new key)
      const newColors = { ...platformColors };
      delete newColors[editingTarget];
      newColors[name] = platformForm.color;
      setPlatformColors(newColors);

      // 3. Update Records references (So data doesn't disappear)
      const newRecords = records.map(r => r.platform === editingTarget ? { ...r, platform: name } : r);
      setRecords(newRecords);

      // 4. Update Active Platform if it was the one edited
      if (activePlatform === editingTarget) {
        setActivePlatform(name);
      }

    } else {
      // ADD MODE
      if (platforms.some(p => p.toLowerCase() === name.toLowerCase())) {
        alert("Sàn này đã tồn tại!");
        return;
      }
      setPlatforms(prev => [...prev, name]);
      setPlatformColors(prev => ({ ...prev, [name]: platformForm.color }));
      setActivePlatform(name);
    }

    setIsPlatformModalOpen(false);
  };

  const handleInitiateDeletePlatform = (e: React.MouseEvent, p: Platform) => {
    e.stopPropagation();
    setPlatformToDelete(p);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeletePlatform = () => {
    if (!platformToDelete) return;

    const newPlatforms = platforms.filter(item => item !== platformToDelete);
    setPlatforms(newPlatforms);
    
    // Clean up color
    const newColors = { ...platformColors };
    delete newColors[platformToDelete];
    setPlatformColors(newColors);

    // If deleted platform was active, switch to first available
    if (activePlatform === platformToDelete && newPlatforms.length > 0) {
      setActivePlatform(newPlatforms[0]);
    }

    setIsDeleteModalOpen(false);
    setPlatformToDelete(null);
  };

  const handleExportPDF = async () => {
    if (!overviewRef.current) return;
    setIsExporting(true);

    try {
      const element = overviewRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff', 
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const imgHeightInPdf = (imgHeight * pdfWidth) / imgWidth;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeightInPdf);
      pdf.save(`Bao_cao_doanh_thu_${selectedMonth}.pdf`);

    } catch (error) {
      console.error("Lỗi xuất PDF:", error);
      alert("Không thể xuất file PDF. Vui lòng thử lại.");
    }

    setIsExporting(false);
  };

  // --- Helpers for Calculations ---
  
  const calculateCommission = (data: SummaryRecord) => {
    const realRevenue = data.totalRevenue - data.cancelledAmount - data.returnedAmount;
    const netProfit = realRevenue - data.adSpend;
    
    if (netProfit <= 0) return 0;
    const adRate = data.totalRevenue > 0 ? (data.adSpend / data.totalRevenue) * 100 : 0;
    const fixedRate = 5; 
    let commissionRate = 0;
    if (adRate < 20) {
      commissionRate = ((20 - adRate) / 2) + fixedRate;
    } else {
      commissionRate = fixedRate;
    }
    return netProfit * (commissionRate / 100);
  };

  // --- Aggregation Logic (Overview Tab) ---
  const aggregatedData = useMemo(() => {
    const monthlyRecords = records.filter(r => r.monthKey === selectedMonth);
    
    const initial = {
      totalRevenue: 0,
      totalOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
      cancelledAmount: 0,
      returnedAmount: 0,
      adSpend: 0,
      netRevenue: 0,
      totalCommission: 0
    };

    return monthlyRecords.reduce((acc, curr) => {
      const net = curr.totalRevenue - curr.cancelledAmount - curr.returnedAmount - curr.adSpend;
      const commission = calculateCommission(curr);

      return {
        totalRevenue: acc.totalRevenue + curr.totalRevenue,
        totalOrders: acc.totalOrders + curr.totalOrders,
        cancelledOrders: acc.cancelledOrders + curr.cancelledOrders,
        returnedOrders: acc.returnedOrders + curr.returnedOrders,
        cancelledAmount: acc.cancelledAmount + curr.cancelledAmount,
        returnedAmount: acc.returnedAmount + curr.returnedAmount,
        adSpend: acc.adSpend + curr.adSpend,
        netRevenue: acc.netRevenue + net,
        totalCommission: acc.totalCommission + commission
      };
    }, initial);
  }, [records, selectedMonth]);

  // --- Previous Month Aggregation Logic ---
  const prevAggregatedData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 - 1); 
    const prevMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyRecords = records.filter(r => r.monthKey === prevMonthKey);
    
    const initial = {
      totalRevenue: 0,
      totalOrders: 0,
      adSpend: 0,
      netRevenue: 0,
      cancelledOrders: 0,
      returnedOrders: 0
    };

    return monthlyRecords.reduce((acc, curr) => {
      const net = curr.totalRevenue - curr.cancelledAmount - curr.returnedAmount - curr.adSpend;
      return {
        totalRevenue: acc.totalRevenue + curr.totalRevenue,
        totalOrders: acc.totalOrders + curr.totalOrders,
        adSpend: acc.adSpend + curr.adSpend,
        netRevenue: acc.netRevenue + net,
        cancelledOrders: acc.cancelledOrders + curr.cancelledOrders,
        returnedOrders: acc.returnedOrders + curr.returnedOrders,
      };
    }, initial);
  }, [records, selectedMonth]);

  const aggregatedAdRate = aggregatedData.totalRevenue > 0 ? (aggregatedData.adSpend / aggregatedData.totalRevenue) * 100 : 0;
  const prevAdRate = prevAggregatedData.totalRevenue > 0 ? (prevAggregatedData.adSpend / prevAggregatedData.totalRevenue) * 100 : 0;
  
  const currentCancelRate = aggregatedData.totalOrders > 0 ? (aggregatedData.cancelledOrders / aggregatedData.totalOrders) * 100 : 0;
  const prevCancelRate = prevAggregatedData.totalOrders > 0 ? (prevAggregatedData.cancelledOrders / prevAggregatedData.totalOrders) * 100 : 0;

  const currentReturnRate = aggregatedData.totalOrders > 0 ? (aggregatedData.returnedOrders / aggregatedData.totalOrders) * 100 : 0;
  const prevReturnRate = prevAggregatedData.totalOrders > 0 ? (prevAggregatedData.returnedOrders / prevAggregatedData.totalOrders) * 100 : 0;


  // --- Detail Tab Logic ---
  const detailRealRevenue = currentData.totalRevenue - currentData.cancelledAmount - currentData.returnedAmount;
  const detailNetRevenue = detailRealRevenue - currentData.adSpend; 
  
  const detailCommission = calculateCommission(currentData);
  
  const detailCancelRate = currentData.totalOrders > 0 ? (currentData.cancelledOrders / currentData.totalOrders) * 100 : 0;
  const detailReturnRate = currentData.totalOrders > 0 ? (currentData.returnedOrders / currentData.totalOrders) * 100 : 0;
  
  const detailAdRate = currentData.totalRevenue > 0 ? (currentData.adSpend / currentData.totalRevenue) * 100 : 0;

  let currentCommissionPercent = 5;
  if (detailAdRate < 20) {
      currentCommissionPercent = ((20 - detailAdRate) / 2) + 5;
  }

  // --- Comparison Logic ---
  const getPrevMonthData = (platform: Platform | 'ALL') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 - 1); 
    const prevMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (platform === 'ALL') {
       const prevRecords = records.filter(r => r.monthKey === prevMonthKey);
       return prevRecords.reduce((acc, curr) => ({
          totalRevenue: acc.totalRevenue + curr.totalRevenue,
          totalOrders: acc.totalOrders + curr.totalOrders,
          adSpend: acc.adSpend + curr.adSpend,
          cancelledOrders: acc.cancelledOrders + curr.cancelledOrders,
          returnedOrders: acc.returnedOrders + curr.returnedOrders,
       }), { 
         totalRevenue: 0, 
         totalOrders: 0, 
         adSpend: 0, 
         cancelledOrders: 0, 
         returnedOrders: 0 
       });
    }
    
    return records.find(r => r.monthKey === prevMonthKey && r.platform === platform);
  };

  const renderComparisonRate = (currentRate: number, prevDenominator: number, prevNumerator: number, isNegativeBad = true) => {
     if (!prevDenominator || prevDenominator === 0) return <span className="text-gray-400 text-xs ml-2">-</span>;
     const prevRate = (prevNumerator / prevDenominator) * 100;
     const diff = currentRate - prevRate;
     
     if (Math.abs(diff) < 0.01) return <span className="text-gray-400 text-xs ml-2 flex items-center"><Minus size={12}/> 0%</span>;

     const isGood = isNegativeBad ? diff < 0 : diff > 0;
     const colorClass = isGood ? 'text-green-500' : 'text-red-500';
     const Icon = diff > 0 ? TrendingUp : TrendingDown;
     
     return (
       <span className={`${colorClass} text-xs ml-2 flex items-center gap-0.5 font-medium`}>
         <Icon size={12} /> {Math.abs(diff).toFixed(2)}%
       </span>
     );
  };

  const formatCurrency = (val: number) => val.toLocaleString('vi-VN') + ' ₫';

  // Helper to get color (User defined > Default > Fallback)
  const getPlatformColor = (p: Platform) => {
    if (platformColors[p]) return platformColors[p];
    return getDefaultColor(p);
  };

  const getDefaultColor = (p: Platform) => {
    const lowerP = p.toLowerCase();
    if (lowerP.includes('shopee')) return '#ee4d2d';
    if (lowerP.includes('lazada')) return '#0f146d';
    if (lowerP.includes('tiktok')) return '#000000';
    if (lowerP.includes('zalo')) return '#0068ff';
    if (lowerP.includes('facebook') || lowerP.includes('fb')) return '#1877f2';
    return '#94a3b8'; // Default slate
  };

  const getPlatformIcon = (p: Platform) => {
     const color = getPlatformColor(p);
     return (
        <span 
          className="w-6 h-6 rounded-full text-white inline-flex items-center justify-center text-xs font-bold shrink-0 uppercase"
          style={{ backgroundColor: color }}
        >
          {p.charAt(0)}
        </span>
     );
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart4 className="text-red-600" /> Tổng Kết Doanh Thu
          </h2>
          <p className="text-gray-500 text-sm">Quản lý số liệu kinh doanh hàng tháng</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
             <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="month" 
               className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 font-medium text-gray-700"
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(e.target.value)}
             />
          </div>
          {isLoading && <Loader2 className="animate-spin text-red-500" size={24} />}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-2">
         <button
            onClick={() => setActiveTab('detail')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${
               activeTab === 'detail' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
         >
            <Layers size={18} /> Thành Phần (Chi tiết sàn)
            {activeTab === 'detail' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
         </button>
         <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${
               activeTab === 'overview' ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
         >
            <PieChart size={18} /> Tổng Hợp (Toàn bộ)
            {activeTab === 'overview' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600"></span>}
         </button>
      </div>

      {/* ================= DETAIL TAB (Thành phần) ================= */}
      {activeTab === 'detail' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          {/* Left Sidebar: Platforms */}
          <div className="lg:col-span-1 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {platforms.map(p => (
              <div key={p} className="relative group min-w-[140px] lg:min-w-0">
                <button
                  onClick={() => { if(!isSaving) setActivePlatform(p); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium w-full text-left pr-16 ${
                    activePlatform === p 
                      ? 'bg-red-600 text-white shadow-md transform scale-[1.02]' 
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200'
                  }`}
                >
                  {getPlatformIcon(p)}
                  <span className="truncate">{p}</span>
                </button>
                {/* Actions Button (Only Show on Hover) */}
                <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 ${activePlatform === p ? 'text-white' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                   <button 
                    onClick={(e) => handleOpenEditPlatform(e, p)}
                    className={`p-1.5 rounded-full hover:bg-white/20 transition-colors`}
                    title="Sửa sàn"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleInitiateDeletePlatform(e, p)}
                    className={`p-1.5 rounded-full hover:bg-white/20 transition-colors hover:text-red-500`}
                    title="Xóa sàn"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            
            {/* Add Platform Button */}
            <button
              onClick={handleOpenAddPlatform}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 border border-dashed border-blue-200 mt-2 min-w-[120px] lg:min-w-0"
            >
              <Plus size={16} /> Thêm sàn
            </button>
          </div>

          {/* Main Content: Input & Stats */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                Số liệu {activePlatform} - Tháng {selectedMonth.split('-').reverse().join('/')}
              </h3>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Lưu dữ liệu
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ... Inputs ... */}
              <div className="space-y-5">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Nhập liệu</h4>
                  <InputGroup 
                    label="Tổng Doanh Thu" 
                    value={currentData.totalRevenue} 
                    onChange={(v) => handleInputChange('totalRevenue', v)}
                    icon={<DollarSign size={16} className="text-green-600"/>}
                    type="currency"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup 
                      label="Tổng Số Đơn" 
                      value={currentData.totalOrders} 
                      onChange={(v) => handleInputChange('totalOrders', v)}
                      icon={<ShoppingCart size={16} className="text-blue-600"/>}
                    />
                    <InputGroup 
                      label="Chi Phí Ads" 
                      value={currentData.adSpend} 
                      onChange={(v) => handleInputChange('adSpend', v)}
                      icon={<Megaphone size={16} className="text-orange-600"/>}
                      type="currency"
                    />
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup 
                          label="Số Đơn Hủy" 
                          value={currentData.cancelledOrders} 
                          onChange={(v) => handleInputChange('cancelledOrders', v)}
                          icon={<XCircle size={16} className="text-red-600"/>}
                        />
                        <InputGroup 
                          label="Tiền Đơn Hủy" 
                          value={currentData.cancelledAmount} 
                          onChange={(v) => handleInputChange('cancelledAmount', v)}
                          type="currency"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup 
                          label="Số Đơn Hoàn" 
                          value={currentData.returnedOrders} 
                          onChange={(v) => handleInputChange('returnedOrders', v)}
                          icon={<RotateCcw size={16} className="text-purple-600"/>}
                        />
                        <InputGroup 
                          label="Tiền Đơn Hoàn" 
                          value={currentData.returnedAmount} 
                          onChange={(v) => handleInputChange('returnedAmount', v)}
                          type="currency"
                        />
                    </div>
                  </div>
              </div>

              {/* ... Detail Stats ... */}
              <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex justify-between">
                    <span>Phân tích hiệu quả</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard 
                      label="Tỉ lệ Hủy" 
                      value={`${detailCancelRate.toFixed(1)}%`} 
                      color="text-red-600" 
                      bg="bg-red-50"
                      comparison={renderComparisonRate(detailCancelRate, getPrevMonthData(activePlatform)?.totalOrders || 0, getPrevMonthData(activePlatform)?.cancelledOrders || 0, true)}
                    />
                    <StatCard 
                      label="Tỉ lệ Hoàn" 
                      value={`${detailReturnRate.toFixed(1)}%`} 
                      color="text-purple-600" 
                      bg="bg-purple-50"
                      comparison={renderComparisonRate(detailReturnRate, getPrevMonthData(activePlatform)?.totalOrders || 0, getPrevMonthData(activePlatform)?.returnedOrders || 0, true)}
                    />
                  </div>
                  <StatCard 
                    label="Tỉ lệ Chi Phí Quảng Cáo" 
                    value={`${detailAdRate.toFixed(1)}%`} 
                    color="text-orange-600" 
                    bg="bg-orange-50"
                    comparison={renderComparisonRate(detailAdRate, getPrevMonthData(activePlatform)?.totalRevenue || 0, getPrevMonthData(activePlatform)?.adSpend || 0, true)}
                    subtext={`Chi phí: ${formatCurrency(currentData.adSpend)}`}
                  />
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={64} className="text-green-600" />
                    </div>
                    <h5 className="text-gray-600 font-medium mb-1">Doanh Thu Thực Tế</h5>
                    <p className="text-3xl font-bold text-green-700 tracking-tight">
                        {formatCurrency(detailNetRevenue)}
                    </p>
                    <div className="mt-2 flex items-center text-sm">
                        <span className="text-gray-400 text-xs">(Trừ Hủy, Hoàn, Ads)</span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Award size={64} className="text-indigo-600" />
                    </div>
                    <h5 className="text-gray-600 font-medium mb-1">Hoa Hồng (Commission)</h5>
                    <div className="flex items-end gap-2">
                      <p className="text-3xl font-bold text-indigo-700 tracking-tight">
                          {formatCurrency(detailCommission)}
                      </p>
                      <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded mb-1 font-bold">
                        {currentCommissionPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= OVERVIEW TAB (Tổng hợp) ================= */}
      {activeTab === 'overview' && (
         <div className="space-y-6 animate-fade-in pb-10">
            {/* Header Action Row */}
            <div className="flex justify-end">
               <button 
                 onClick={handleExportPDF}
                 disabled={isExporting}
                 className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
               >
                 {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                 Xuất báo cáo PDF
               </button>
            </div>

            {/* Wraps content for PDF capture */}
            <div ref={overviewRef} className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                
                <div className="flex flex-col items-center justify-center mb-8 border-b border-gray-100 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                         <BarChart4 className="text-red-600" size={32} />
                         <h1 className="text-3xl font-bold text-gray-800 uppercase tracking-wider">Báo Cáo Doanh Thu</h1>
                    </div>
                    <p className="text-gray-500 font-medium text-lg">Tháng {selectedMonth.split('-').reverse().join('/')}</p>
                    <p className="text-sm text-gray-400 mt-1">Ngày xuất: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>

                {/* Top Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-gray-500 font-medium text-sm uppercase">Tổng Doanh Thu</p>
                      <p className="text-2xl font-bold text-gray-800 mt-2">{formatCurrency(aggregatedData.totalRevenue)}</p>
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                         <ShoppingCart size={14}/> {aggregatedData.totalOrders} đơn hàng
                      </p>
                   </div>
                   
                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-gray-500 font-medium text-sm uppercase">Chi Phí Ads</p>
                      <p className="text-2xl font-bold text-orange-600 mt-2">{formatCurrency(aggregatedData.adSpend)}</p>
                      <div className="mt-1 flex items-center gap-2">
                         <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                            {aggregatedData.totalRevenue > 0 ? ((aggregatedData.adSpend / aggregatedData.totalRevenue) * 100).toFixed(1) : 0}% Tổng doanh thu
                         </span>
                      </div>
                   </div>

                   <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
                      <p className="text-emerald-700 font-medium text-sm uppercase">Doanh thu thực tế</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-2">{formatCurrency(aggregatedData.netRevenue)}</p>
                      <p className="text-xs text-emerald-600 mt-1 opacity-80">Đã trừ Ads, Hủy, Hoàn</p>
                   </div>

                   <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
                      <p className="text-indigo-700 font-medium text-sm uppercase">Tổng Hoa Hồng</p>
                      <p className="text-2xl font-bold text-indigo-700 mt-2">{formatCurrency(aggregatedData.totalCommission)}</p>
                      <p className="text-xs text-indigo-600 mt-1 opacity-80">Tổng cộng từ các sàn</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                   {/* Efficiency Stats */}
                   <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-1 space-y-6">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><PieChart size={20}/> Hiệu quả vận hành</h3>
                      
                      {/* Ad Rate */}
                      <div>
                         <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-600">Tỷ lệ quảng cáo</span>
                            <span className="text-sm font-bold text-orange-600">
                               {aggregatedAdRate.toFixed(1)}%
                            </span>
                         </div>
                         <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min(aggregatedAdRate, 100)}%` }}></div>
                         </div>
                         <p className="text-xs text-gray-400 mt-1 text-right">{formatCurrency(aggregatedData.adSpend)} (Tính trên tổng doanh thu)</p>
                      </div>

                      {/* Cancel Rate */}
                      <div>
                         <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-600">Tỷ lệ hủy</span>
                            <span className="text-sm font-bold text-red-600">
                               {currentCancelRate.toFixed(1)}%
                            </span>
                         </div>
                         <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full" style={{ width: `${currentCancelRate}%` }}></div>
                         </div>
                         <p className="text-xs text-gray-400 mt-1 text-right">{aggregatedData.cancelledOrders} đơn - {formatCurrency(aggregatedData.cancelledAmount)}</p>
                      </div>

                      {/* Return Rate */}
                      <div>
                         <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-gray-600">Tỷ lệ hoàn</span>
                            <span className="text-sm font-bold text-purple-600">
                               {currentReturnRate.toFixed(1)}%
                            </span>
                         </div>
                         <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${currentReturnRate}%` }}></div>
                         </div>
                         <p className="text-xs text-gray-400 mt-1 text-right">{aggregatedData.returnedOrders} đơn - {formatCurrency(aggregatedData.returnedAmount)}</p>
                      </div>
                   </div>

                   {/* Breakdown Table */}
                   <div className="bg-white rounded-xl border border-gray-200 shadow-sm lg:col-span-2 flex flex-col">
                      <div className="p-4 border-b border-gray-100">
                         <h3 className="font-bold text-gray-800">Chi tiết theo Sàn</h3>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                         <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                               <tr>
                                  <th className="px-4 py-3">Sàn</th>
                                  <th className="px-4 py-3 text-right">Doanh thu</th>
                                  <th className="px-4 py-3 text-right">Ads</th>
                                  <th className="px-4 py-3 text-right">Net Rev</th>
                                  <th className="px-4 py-3 text-right">Commission</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                               {platforms.map(p => {
                                  const rec = records.find(r => r.monthKey === selectedMonth && r.platform === p);
                                  const net = rec ? rec.totalRevenue - rec.cancelledAmount - rec.returnedAmount - rec.adSpend : 0;
                                  const comm = rec ? calculateCommission(rec) : 0;
                                  
                                  if (!rec) return null; 
                                  if (rec.totalRevenue === 0 && rec.adSpend === 0) return null;

                                  return (
                                     <tr key={p} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                                           {getPlatformIcon(p)} {p}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(rec.totalRevenue)}</td>
                                        <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(rec.adSpend)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(net)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatCurrency(comm)}</td>
                                     </tr>
                                  );
                               })}
                               {aggregatedData.totalRevenue === 0 && (
                                  <tr>
                                     <td colSpan={5} className="text-center py-8 text-gray-400">Chưa có dữ liệu cho tháng này</td>
                                  </tr>
                               )}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </div>

                {/* Comparison Charts Row */}
                <div>
                   <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={20}/> So sánh tháng trước</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <ComparisonChart 
                        title="Tổng Doanh Thu" 
                        current={aggregatedData.totalRevenue} 
                        previous={prevAggregatedData.totalRevenue} 
                        color="#10b981" 
                        type="currency"
                      />
                      <ComparisonChart 
                        title="Tổng Số Đơn" 
                        current={aggregatedData.totalOrders} 
                        previous={prevAggregatedData.totalOrders} 
                        color="#3b82f6" 
                        type="number"
                      />
                      <ComparisonChart 
                        title="Doanh Thu Thực Tế" 
                        current={aggregatedData.netRevenue} 
                        previous={prevAggregatedData.netRevenue} 
                        color="#8b5cf6" 
                        type="currency"
                      />
                      <ComparisonChart 
                        title="Tỷ lệ Ads" 
                        current={aggregatedAdRate} 
                        previous={prevAdRate} 
                        color="#f97316" 
                        type="percent"
                        inverse={true}
                      />
                      <ComparisonChart 
                        title="Tỷ lệ Hủy" 
                        current={currentCancelRate} 
                        previous={prevCancelRate} 
                        color="#ef4444" 
                        type="percent"
                        inverse={true}
                      />
                      <ComparisonChart 
                        title="Tỷ lệ Hoàn" 
                        current={currentReturnRate} 
                        previous={prevReturnRate} 
                        color="#d946ef" 
                        type="percent"
                        inverse={true}
                      />
                   </div>
                </div>
            </div>
         </div>
      )}

      {/* Delete Platform Confirmation Modal */}
      {isDeleteModalOpen && platformToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                   <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Xóa sàn?</h3>
              </div>
              
              <p className="text-gray-600 mb-2 leading-relaxed">
                Bạn có chắc chắn muốn xóa sàn <strong>{platformToDelete}</strong> khỏi danh sách chọn?
              </p>
              <p className="text-sm text-gray-500 italic bg-gray-50 p-2 rounded border border-gray-100">
                Lưu ý: Dữ liệu đã lưu của sàn này sẽ không bị xóa khỏi hệ thống, chỉ ẩn khỏi danh sách chọn.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setPlatformToDelete(null); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmDeletePlatform}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Platform Modal */}
      {isPlatformModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-500 p-6 flex justify-between items-start">
                 <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                       {editingTarget ? 'Chỉnh sửa Sàn' : 'Thêm Sàn Mới'}
                    </h3>
                    <p className="text-red-100 text-sm">
                       {editingTarget ? 'Cập nhật thông tin hiển thị' : 'Tạo mới kênh bán hàng'}
                    </p>
                 </div>
                 <button 
                   onClick={() => setIsPlatformModalOpen(false)}
                   className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
                 >
                   <X size={24} />
                 </button>
              </div>

              <form onSubmit={handleSavePlatform}>
                 <div className="p-6 space-y-6">
                    {/* Name Input */}
                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-2">Tên sàn</label>
                       <input 
                         autoFocus
                         placeholder="VD: Website, Offline, Tiki..."
                         className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-medium text-gray-800"
                         value={platformForm.name}
                         onChange={e => setPlatformForm({...platformForm, name: e.target.value})}
                       />
                    </div>

                    {/* Color Picker */}
                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Palette size={16} /> Màu nền Icon
                       </label>
                       
                       <div className="grid grid-cols-5 gap-3 mb-4">
                          {PRESET_COLORS.map(color => (
                             <button
                               key={color}
                               type="button"
                               onClick={() => setPlatformForm({...platformForm, color})}
                               className={`w-10 h-10 rounded-full transition-transform hover:scale-110 relative border-2 ${platformForm.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                               style={{ backgroundColor: color }}
                             >
                                {platformForm.color === color && (
                                   <Check size={16} className="text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                             </button>
                          ))}
                       </div>

                       <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <input 
                             type="color" 
                             value={platformForm.color}
                             onChange={e => setPlatformForm({...platformForm, color: e.target.value})}
                             className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                          />
                          <span className="text-sm font-mono text-gray-500 uppercase">{platformForm.color}</span>
                          <span className="text-xs text-gray-400 ml-auto">Hoặc chọn màu tùy chỉnh</span>
                       </div>
                    </div>
                 </div>

                 {/* Footer */}
                 <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsPlatformModalOpen(false)}
                      className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit"
                      disabled={!platformForm.name.trim()}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingTarget ? 'Lưu thay đổi' : 'Tạo mới'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

// --- Sub Components ---

const ComparisonChart = ({ 
  title, current, previous, color, type = 'currency', inverse = false
}: { 
  title: string, current: number, previous: number, color: string, type?: 'currency' | 'number' | 'percent', inverse?: boolean
}) => {
  
  const formatVal = (val: number) => {
    if (type === 'currency') return (val / 1000000).toFixed(1) + 'M';
    if (type === 'percent') return val.toFixed(1) + '%';
    return val.toString();
  };

  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  // If inverse (e.g. Cancel rate), a decrease (negative change) is GOOD.
  const isGood = inverse ? percentChange <= 0 : percentChange >= 0;
  
  // Icon direction still follows value (Up if > 0)
  const isUp = percentChange > 0;

  const data = [
    { name: 'Tháng trước', value: previous },
    { name: 'Tháng này', value: current },
  ];

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
       <div className="flex justify-between items-start mb-4">
          <div>
             <p className="text-xs font-bold text-gray-500 uppercase">{title}</p>
             <div className="flex items-center gap-2 mt-1">
               {previous > 0 || (type === 'percent' && previous === 0) ? (
                 <span className={`text-xs font-bold flex items-center ${isGood ? 'text-green-600' : 'text-red-500'}`}>
                    {isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} 
                    {Math.abs(percentChange).toFixed(1)}%
                 </span>
               ) : null}
             </div>
          </div>
       </div>
       <div className="h-28 w-full mt-auto">
          <ResponsiveContainer width="100%" height="100%">
             <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" hide />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [
                      type === 'currency' ? value.toLocaleString('vi-VN') + ' ₫' : 
                      type === 'percent' ? value.toFixed(1) + '%' : 
                      value, 
                      ''
                  ]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                   {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#cbd5e1' : color} />
                   ))}
                </Bar>
             </BarChart>
          </ResponsiveContainer>
       </div>
       <div className="flex justify-between mt-2 text-xs text-gray-500 font-medium px-1">
          <span>Tháng trước</span>
          <span>Tháng này</span>
       </div>
    </div>
  );
};

const InputGroup = ({ 
  label, value, onChange, icon, type = 'number' 
}: { 
  label: string, value: number, onChange: (v: number) => void, icon?: React.ReactNode, type?: 'number' | 'currency' 
}) => {
  return (
    <div>
       <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
         {icon} {label}
       </label>
       <div className="relative">
          <input 
            type="text" 
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700 transition-all"
            value={value}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
               const val = e.target.value.replace(/[^0-9]/g, '');
               onChange(Number(val));
            }}
          />
          {type === 'currency' && (
             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">VNĐ</span>
          )}
       </div>
       {type === 'currency' && value > 0 && (
         <p className="text-[10px] text-gray-400 text-right mt-1">{value.toLocaleString('vi-VN')} ₫</p>
       )}
    </div>
  );
};

const StatCard = ({ 
  label, value, color, bg, subtext, comparison 
}: { 
  label: string, value: string, color: string, bg: string, subtext?: string, comparison?: React.ReactNode 
}) => {
  return (
    <div className={`${bg} rounded-xl p-4 border border-transparent`}>
       <p className="text-gray-600 text-xs font-semibold uppercase mb-1">{label}</p>
       <div className="flex items-baseline gap-2">
         <p className={`text-2xl font-bold ${color}`}>{value}</p>
         {comparison}
       </div>
       {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
};

export default Summary;
