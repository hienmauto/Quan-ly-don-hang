import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { DollarSign, ShoppingBag, Truck, AlertCircle, Sparkles } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { analyzeBusinessData } from '../services/geminiService';

interface DashboardProps {
  orders: Order[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#EF4444'];

const Dashboard: React.FC<DashboardProps> = ({ orders }) => {
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Get today's date string (YYYY-MM-DD) in local time to match stored format
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Calculate Stats
  // Filter orders to only include those created today for the revenue calculation
  const totalRevenue = orders
    .filter(order => order.createdAt === todayStr)
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING).length;
  
  // Note: avgOrderValue calculation logic here might need adjustment if it was used, 
  // but it is currently not rendered in the UI below.

  // Chart Data Preparation
  const statusData = Object.values(OrderStatus).map(status => ({
    name: status,
    value: orders.filter(o => o.status === status).length
  }));

  // Mock monthly data (in a real app, calculate from orders)
  const monthlyData = [
    { name: 'T1', revenue: 15000000 },
    { name: 'T2', revenue: 23000000 },
    { name: 'T3', revenue: 18000000 },
    { name: 'T4', revenue: 32000000 },
    { name: 'T5', revenue: 28000000 },
    { name: 'T6', revenue: totalRevenue > 35000000 ? totalRevenue : 35000000 },
  ];

  const handleGetInsight = async () => {
    setIsLoadingAi(true);
    const insight = await analyzeBusinessData(orders);
    setAiInsight(insight || 'Không có dữ liệu.');
    setIsLoadingAi(false);
  };

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Doanh Thu Hôm Nay</p>
            <p className="text-2xl font-bold text-gray-800">{totalRevenue.toLocaleString('vi-VN')} ₫</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <DollarSign size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tổng Đơn Hàng</p>
            <p className="text-2xl font-bold text-gray-800">{totalOrders}</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full text-purple-600">
            <ShoppingBag size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Chờ Xử Lý</p>
            <p className="text-2xl font-bold text-orange-600">{pendingOrders}</p>
          </div>
          <div className="p-3 bg-orange-100 rounded-full text-orange-600">
            <AlertCircle size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Đã Giao Thành Công</p>
            <p className="text-2xl font-bold text-emerald-600">
              {orders.filter(o => o.status === OrderStatus.DELIVERED).length}
            </p>
          </div>
          <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
            <Truck size={24} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Doanh Thu Theo Tháng</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value/1000000}M`} />
                <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN') + ' ₫'} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Trạng Thái Đơn Hàng</h3>
          <div className="h-80 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
             {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length]}}></span>
                  {entry.name} ({entry.value})
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;