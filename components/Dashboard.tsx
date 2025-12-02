import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend
} from 'recharts';
import { ShoppingBag, Calendar, CheckCircle, RotateCcw, Sparkles, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { analyzeBusinessData } from '../services/geminiService';
import { fetchN8NStatsData } from '../services/sheetService';

interface DashboardProps {
  orders: Order[];
}

const Dashboard: React.FC<DashboardProps> = ({ orders }) => {
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // --- State for Charts (N8N Data) ---
  const [chartStats, setChartStats] = useState({
    yesterday: 0,
    today: 0,
    lastMonthSent: 0,
    thisMonthSent: 0,
    lastMonthReturn: 0,
    thisMonthReturn: 0
  });

  // --- Date Parsing Helper ---
  // Supported formats: "HH:mm dd-MM", "dd-MM", "HH:mm dd/MM", "dd/MM"
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const now = new Date();
    const currentYear = now.getFullYear();

    // Clean up string (trim extra spaces)
    const cleanStr = dateStr.trim();
    
    // Handle format "HH:mm dd-MM" or "dd-MM"
    // Regex to capture day and month
    const match = cleanStr.match(/(\d{1,2})[-/](\d{1,2})/);
    
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);

        if (!day || !month) return null;

        // Logic to determine Year:
        // We assume data is mostly current.
        // If we are in January (Month 0) and we see data for December (Month 12), it's likely last year.
        let year = currentYear;
        if (now.getMonth() === 0 && month === 12) {
             year = currentYear - 1;
        }
        // Conversely, if we are in Dec and see Jan data (unlikely for past data, but possible for future), keep current or handle appropriately.
        // For simple "Total Month" logic, usually we care about the strict month index match.

        return new Date(year, month - 1, day);
    }
    
    // Fallback for standard ISO string
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
    
    return null;
  };

  // --- Realtime Calculation for Top Cards (Sheet Data) ---
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const todayDate = now.getDate();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayDate = yesterday.getDate();
  const yesterdayMonth = yesterday.getMonth();
  const yesterdayYear = yesterday.getFullYear();

  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(now.getMonth() - 1);
  const lastMonthIdx = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  // Variables for Top Cards (Realtime from Sheet)
  let cardTotalToday = 0;
  let cardTotalMonth = 0;
  let cardCompletedMonth = 0;
  let cardReturnedMonth = 0;

  orders.forEach(o => {
      const d = parseDate(o.createdAt);
      if (d) {
          const dYear = d.getFullYear();
          const dMonth = d.getMonth();
          const dDate = d.getDate();
          
          const status = (o.status || '').toLowerCase();

          // Today (Reset every 24h because todayDate changes tomorrow)
          if (dYear === currentYear && dMonth === currentMonth && dDate === todayDate) {
              cardTotalToday++;
          } 

          // This Month
          if (dYear === currentYear && dMonth === currentMonth) {
              cardTotalMonth++;
              if (status.includes('đã gửi') || status.includes('sent') || status.includes('thành công') || status.includes('delivered')) {
                  cardCompletedMonth++;
              }
              if (status.includes('trả') || status.includes('returned') || status.includes('hủy') || status.includes('cancelled')) {
                  cardReturnedMonth++;
              }
          } 
      }
  });

  // --- Fetch and Process N8N Data for Charts ---
  useEffect(() => {
    const fetchChartsData = async () => {
      const n8nData = await fetchN8NStatsData();
      
      let countYesterday = 0;
      let countToday = 0;
      let countLastMonthSent = 0;
      let countThisMonthSent = 0;
      let countLastMonthReturn = 0;
      let countThisMonthReturn = 0;

      n8nData.forEach((item: any) => {
        // Handle various key names that might come from N8N
        const dateStr = item['Ngày'] || item['date'] || item['createdAt'] || item['D'] || '';
        const statusRaw = item['Trạng thái'] || item['status'] || item['K'] || '';
        const status = String(statusRaw).toLowerCase();

        const d = parseDate(dateStr);
        if (d) {
          const dYear = d.getFullYear();
          const dMonth = d.getMonth();
          const dDate = d.getDate();

          // Chart 1: Hiệu suất theo Ngày (All orders based on date)
          // Today
          if (dYear === currentYear && dMonth === currentMonth && dDate === todayDate) {
            countToday++;
          }
          // Yesterday
          if (dYear === yesterdayYear && dMonth === yesterdayMonth && dDate === yesterdayDate) {
            countYesterday++;
          }

          // Chart 2: Tổng Đơn theo Tháng (Status: Đã gửi)
          const isSent = status.includes('đã gửi') || status.includes('sent') || status.includes('thành công') || status.includes('delivered');
          if (isSent) {
            if (dYear === currentYear && dMonth === currentMonth) {
              countThisMonthSent++;
            } else if (dYear === lastMonthYear && dMonth === lastMonthIdx) {
              countLastMonthSent++;
            }
          }

          // Chart 3: Tỷ lệ Hoàn trả (Status: Trả hàng)
          const isReturned = status.includes('trả') || status.includes('returned');
          if (isReturned) {
            if (dYear === currentYear && dMonth === currentMonth) {
              countThisMonthReturn++;
            } else if (dYear === lastMonthYear && dMonth === lastMonthIdx) {
              countLastMonthReturn++;
            }
          }
        }
      });

      setChartStats({
        yesterday: countYesterday,
        today: countToday,
        lastMonthSent: countLastMonthSent,
        thisMonthSent: countThisMonthSent,
        lastMonthReturn: countLastMonthReturn,
        thisMonthReturn: countThisMonthReturn
      });
    };

    fetchChartsData();
  }, []); // Run once on mount

  const handleGetInsight = async () => {
    setIsLoadingAi(true);
    const insight = await analyzeBusinessData(orders);
    setAiInsight(insight || 'Không có dữ liệu.');
    setIsLoadingAi(false);
  };

  // --- Chart Data (Using N8N Stats) ---
  const dayComparisonData = [
    { name: 'Hôm qua', 'Đơn hàng': chartStats.yesterday },
    { name: 'Hôm nay', 'Đơn hàng': chartStats.today },
  ];

  const monthComparisonData = [
    { name: 'Tháng trước', 'Đơn hàng': chartStats.lastMonthSent },
    { name: 'Tháng này', 'Đơn hàng': chartStats.thisMonthSent },
  ];

  const returnComparisonData = [
    { name: 'Tháng trước', 'Hoàn trả': chartStats.lastMonthReturn },
    { name: 'Tháng này', 'Hoàn trả': chartStats.thisMonthReturn },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Tổng Quan Kinh Doanh</h2>
        <button 
          onClick={handleGetInsight}
          disabled={isLoadingAi}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:opacity-90 transition-all disabled:opacity-50"
        >
          <Sparkles size={18} />
          {isLoadingAi ? 'Đang phân tích...' : 'AI Phân Tích'}
        </button>
      </div>

      {aiInsight && (
        <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="text-indigo-600 mt-1 flex-shrink-0" size={20} />
            <div>
              <h3 className="font-semibold text-indigo-800">Góc nhìn AI</h3>
              <p className="text-indigo-700 mt-1 whitespace-pre-line text-sm leading-relaxed">{aiInsight}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards Row (Realtime Sheet Data) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng đơn hôm nay */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative group">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng đơn hôm nay</p>
            <p className="text-2xl font-bold text-gray-800">{cardTotalToday}</p>
            <p className="text-xs text-blue-500 mt-1">Realtime (Reset 24h)</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* Card 2: Tổng đơn tháng */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative group">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng đơn tháng</p>
            <p className="text-2xl font-bold text-gray-800">
               {cardTotalMonth}
            </p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full text-purple-600">
            <Calendar size={24} />
          </div>
        </div>

        {/* Card 3: Tổng đơn hoàn thành */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative group">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng đơn hoàn thành</p>
            <p className="text-2xl font-bold text-emerald-600">
               {cardCompletedMonth}
            </p>
            <p className="text-xs text-emerald-500 mt-1">(Tháng này)</p>
          </div>
          <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
            <CheckCircle size={24} />
          </div>
        </div>

        {/* Card 4: Tổng đơn hoàn trả */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative group">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng đơn hoàn trả</p>
            <p className="text-2xl font-bold text-red-600">
               {cardReturnedMonth}
            </p>
            <p className="text-xs text-red-500 mt-1">(Tháng này)</p>
          </div>
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <RotateCcw size={24} />
          </div>
        </div>
      </div>

      {/* Comparison Charts Section (N8N Data) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Hôm nay vs Hôm qua */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-4">
             <h3 className="text-lg font-semibold text-gray-700">Hiệu suất theo Ngày</h3>
             <p className="text-sm text-gray-500">So sánh tổng đơn Hôm nay và Hôm qua</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="Đơn hàng" radius={[6, 6, 0, 0]} barSize={50}>
                  {dayComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#3b82f6' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-sm">
             {chartStats.today >= chartStats.yesterday ? (
                <span className="text-green-600 flex items-center justify-center gap-1 font-medium"><TrendingUp size={16}/> Tăng trưởng so với hôm qua</span>
             ) : (
                <span className="text-orange-500 flex items-center justify-center gap-1 font-medium"><TrendingDown size={16}/> Thấp hơn hôm qua</span>
             )}
          </div>
        </div>

        {/* Chart 2: Tháng này vs Tháng trước */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-4">
             <h3 className="text-lg font-semibold text-gray-700">Tổng Đơn theo Tháng</h3>
             <p className="text-sm text-gray-500">So sánh Tháng này và Tháng trước (Đã gửi)</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="Đơn hàng" radius={[6, 6, 0, 0]} barSize={50}>
                  {monthComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#8b5cf6' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-sm">
             {chartStats.thisMonthSent >= chartStats.lastMonthSent ? (
                <span className="text-green-600 flex items-center justify-center gap-1 font-medium"><TrendingUp size={16}/> Tăng trưởng tốt</span>
             ) : (
                <span className="text-gray-500 flex items-center justify-center gap-1 font-medium">Đang theo sau tháng trước</span>
             )}
          </div>
        </div>

        {/* Chart 3: Hoàn trả Tháng này vs Tháng trước */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-4">
             <h3 className="text-lg font-semibold text-gray-700">Tỷ lệ Hoàn trả</h3>
             <p className="text-sm text-gray-500">So sánh số đơn hoàn trả theo tháng</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="Hoàn trả" radius={[6, 6, 0, 0]} barSize={50}>
                  {returnComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#ef4444' : '#fb923c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-sm">
             {chartStats.thisMonthReturn > chartStats.lastMonthReturn ? (
                <span className="text-red-500 flex items-center justify-center gap-1 font-medium"><TrendingUp size={16}/> Tỷ lệ hoàn trả tăng</span>
             ) : (
                <span className="text-green-600 flex items-center justify-center gap-1 font-medium"><TrendingDown size={16}/> Kiểm soát hoàn trả tốt</span>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;