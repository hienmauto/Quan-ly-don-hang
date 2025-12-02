
import React, { useState } from 'react';
import { User, Lock, ArrowRight, AlertCircle, ShieldCheck, X, Eye, EyeOff } from 'lucide-react';
import { login } from '../services/authService';
import { User as UserType } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
  onClose?: () => void;
  isModal?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onClose, isModal = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    const user = await login(username, password, rememberMe);
    
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    setIsLoading(false);
  };

  const containerClasses = isModal 
    ? "bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col relative animate-fade-in"
    : "bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col md:flex-row";

  return (
    <div className={isModal ? "fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" : "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4"}>
      <div className={containerClasses} onClick={e => e.stopPropagation()}>
        
        {/* Close Button if Modal */}
        {isModal && onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X size={24} />
          </button>
        )}

        {/* Login Form */}
        <div className="w-full p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-red-600 mb-4">
               <ShieldCheck size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">HIEN M AUTO</h1>
            <p className="text-gray-500 text-sm mt-1">Đăng nhập hệ thống quản lý</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tài khoản</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                Ghi nhớ đăng nhập
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Quên mật khẩu? Liên hệ <span className="text-red-500 font-medium">hienmauto@gmail.com</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
