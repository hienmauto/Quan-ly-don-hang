import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-lg shadow-2xl border bg-white transition-all duration-500 transform translate-y-0 opacity-100 animate-fade-in ${
      type === 'success' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="text-green-500" size={24} />
      ) : (
        <XCircle className="text-red-500" size={24} />
      )}
      <div className="mr-4">
        <h4 className="font-bold text-gray-800 text-sm">{type === 'success' ? 'Thành công' : 'Thông báo'}</h4>
        <p className="text-sm text-gray-600 font-medium">{message}</p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X size={18} />
      </button>
    </div>
  );
};

export default Toast;