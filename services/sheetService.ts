
import { Order, OrderStatus, OrderItem } from '../types';

const SHEET_ID = '1HARjln1eTmMPJo1WX6n0KHX-UtLst0PPB8LgBy4-5CQ';
const SHEET_GID = '1857148256';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

// URL Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzH2tLqGf2hTfC2wS4XyJ1yR7x8j3gK6l5n9oP0q1r2s3t4u5v6/exec'; 

// N8N Webhook URLs
const N8N_ADD_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/them-don';
const N8N_UPDATE_ONE_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/update-nhieu-don';
const N8N_UPDATE_BULK_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/update-nhieu-don';
const N8N_DELETE_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/xoa-don';
const N8N_STATS_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/don-da-gui';

export const fetchOrdersFromSheet = async (): Promise<Order[]> => {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch sheet');
    const text = await response.text();
    const orders = parseCSV(text);
    // Return all orders (reversed to show newest first)
    return orders.reverse();
  } catch (error) {
    console.error('Error fetching sheet:', error);
    return [];
  }
};

// Hàm lấy dữ liệu thống kê từ N8N (Đơn đã gửi/Hoàn thành/Trả hàng...)
export const fetchN8NStatsData = async (): Promise<any[]> => {
  try {
    const response = await fetch(N8N_STATS_WEBHOOK_URL);
    if (!response.ok) throw new Error('Failed to fetch stats from N8N');
    const data = await response.json();
    // Giả sử N8N trả về mảng các object đơn hàng (hoặc ít nhất chứa status và ngày)
    if (Array.isArray(data)) {
      return data;
    }
    // Nếu trả về object có chứa key data/orders
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.orders)) return data.orders;
    
    return [];
  } catch (error) {
    console.error('Error fetching N8N stats:', error);
    return [];
  }
};

const getLocalTodayStr = () => {
  const today = new Date();
  const hh = String(today.getHours()).padStart(2, '0');
  const mm = String(today.getMinutes()).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const MM = String(today.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}-${MM}`;
};

const mapOrderToSheetRow = (order: Partial<Order>) => {
  const productString = order.items && order.items.length > 0 
    ? order.items[0].productName 
    : '';

  const statusValue = order.status || 'Đã in bill';
  const deliveryValue = order.deliveryDeadline || 'Trước 23h59p';
  const noteValue = order.note || 'Đơn thường';
  const templateValue = order.templateStatus || 'Có mẫu';
  
  // If ID is internal generated (_gen_), save as empty string
  let idToSave = order.id || '';
  if (idToSave.startsWith('_gen_')) {
    idToSave = '';
  }
  
  return [
    idToSave,                                           // A: Mã đơn hàng (ID)
    order.trackingCode || '',                           // B: Mã vận chuyển
    order.carrier || '',                                // C: Đơn vị vận chuyển
    order.createdAt || getLocalTodayStr(),              // D: Ngày
    order.customerName || '',                           // E: Tên khách
    order.customerPhone || '',                          // F: SĐT khách
    order.address || '',                                // G: Địa chỉ
    productString,                                      // H: Sản phẩm
    order.platform || 'Shopee',                         // I: Nền tảng
    order.totalAmount || 0,                             // J: Giá
    statusValue,                                        // K: Trạng thái
    deliveryValue,                                      // L: Thời gian giao
    noteValue,                                          // M: Note
    templateValue                                       // N: Mẫu
  ];
};

// Helper function to map order to the specific N8N JSON format
const mapOrderToN8NPayload = (order: Partial<Order>) => {
  const productString = order.items && order.items.length > 0 
    ? order.items[0].productName 
    : '';
    
  // If ID is internal generated (_gen_), send as empty string
  let idToSend = order.id || '';
  if (idToSend.startsWith('_gen_')) {
    idToSend = '';
  }

  return {
    "Thời gian giao hàng": order.deliveryDeadline || "Trước 23h59p",
    "Sản phẩm": productString,
    "Tên khách": order.customerName || "",
    "Sđt khách": order.customerPhone || null,
    "Mã vận chuyển": order.trackingCode || null,
    "Nền tảng": (order.platform || "shopee").toLowerCase(),
    "Mẫu": order.templateStatus || "Có mẫu",
    "Mã đơn hàng": idToSend,
    "Ngày": order.createdAt || getLocalTodayStr(),
    "Note": order.note || "",
    "Địa chỉ": order.address || "",
    "Trạng thái": order.status || "Đã in đơn",
    "Đơn vị vận chuyển": order.carrier || "",
    "Giá": order.totalAmount || 0
  };
};

export const addOrdersToSheet = async (orders: Partial<Order>[]): Promise<boolean> => {
  try {
    const data = orders.map(mapOrderToSheetRow);
    const payload = { action: 'add', data: data };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error('Lỗi khi lưu vào Google Sheet:', error);
    return false;
  }
};

export const sendOrdersToWebhook = async (orders: Partial<Order>[]): Promise<boolean> => {
  try {
    const mappedOrders = orders.map(mapOrderToN8NPayload);

    await fetch(N8N_ADD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(mappedOrders),
    });
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi Webhook N8N (Add):', error);
    return true; 
  }
};

export const sendUpdateOrderToWebhook = async (order: Order): Promise<boolean> => {
  try {
    const mappedOrder = mapOrderToN8NPayload(order);
    
    await fetch(N8N_UPDATE_ONE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify([mappedOrder]),
    });
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi Webhook N8N (Update One):', error);
    return true;
  }
};

export const sendBulkUpdateOrdersToWebhook = async (orders: Order[]): Promise<boolean> => {
  try {
    const mappedOrders = orders.map(mapOrderToN8NPayload);

    await fetch(N8N_UPDATE_BULK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(mappedOrders),
    });
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi Webhook N8N (Update Bulk):', error);
    return true;
  }
};

export const sendDeleteOrdersToWebhook = async (orders: Order[]): Promise<boolean> => {
  try {
    const mappedOrders = orders.map(mapOrderToN8NPayload);

    // Using DELETE method as configured in N8N
    await fetch(N8N_DELETE_WEBHOOK_URL, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(mappedOrders),
    });
    
    console.log('Delete webhook dispatched successfully via DELETE method');
    return true;
  } catch (error) {
    console.error('Lỗi khi gửi Webhook N8N (Delete):', error);
    return true;
  }
};

export const updateBatchOrdersInSheet = async (orders: Order[]): Promise<boolean> => {
  try {
    // Gửi rowIndex để Script biết cập nhật dòng nào
    const updates = orders.map(order => ({
      id: order.rowIndex, 
      data: mapOrderToSheetRow(order)
    }));

    const payload = { action: 'updateBatch', data: updates };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error('Lỗi cập nhật hàng loạt:', error);
    return false;
  }
};

export const deleteBatchOrdersFromSheet = async (rowIndexes: number[]): Promise<boolean> => {
  try {
    // Sắp xếp Row Index giảm dần để xóa từ dưới lên trên, tránh lệch dòng
    const sortedRowIndices = rowIndexes.sort((a, b) => b - a);

    for (const rIndex of sortedRowIndices) {
      const payload = { action: 'delete', id: rIndex };
      
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      // Delay nhỏ
      await new Promise(r => setTimeout(r, 100));
    }

    return true;
  } catch (error) {
    console.error('Lỗi xóa hàng loạt:', error);
    return false;
  }
};

const parseCSV = (text: string): Order[] => {
  const rows = text.split('\n');
  if (rows.length < 2) return []; // Dòng 1 là tiêu đề

  const orders: Order[] = [];

  // Bắt đầu từ i=1 (Dòng 2 trong Excel)
  for (let i = 1; i < rows.length; i++) {
    const rowStr = rows[i].trim();
    if (!rowStr) continue;
    
    const row = parseRow(rowStr);
    
    // MAPPING CHÍNH XÁC: Cột A là ID
    const idRaw = row[0];        // A
    const trackingCode = row[1]; // B
    const carrier = row[2];      // C
    const dateRaw = row[3];      // D
    const customerName = row[4]; // E
    const customerPhone = row[5];// F
    const address = row[6];      // G
    const productName = row[7];  // H
    const platformRaw = row[8];  // I
    const priceRaw = row[9];     // J
    const statusRawText = row[10];// K
    const deliveryDeadline = row[11];// L
    const note = row[12];        // M
    const templateStatus = row[13];// N

    // Không ép kiểu enum, lấy nguyên văn
    const status = (statusRawText || '').trim() || 'Đã in bill';
    const price = parseCurrency(priceRaw);
    
    const items: OrderItem[] = [{
      productId: 'SHEET_ITEM',
      productName: productName || 'Sản phẩm',
      quantity: 1,
      price: price
    }];

    // Sheet Row Index = i + 1 (Do header là dòng 1, mảng bắt đầu từ 0)
    const sheetRowIndex = i + 1;

    orders.push({
      // Use _gen_ prefix for internal identification of empty rows
      id: idRaw || `_gen_${sheetRowIndex}`, 
      rowIndex: sheetRowIndex,             // Lưu số dòng để xóa/sửa
      trackingCode: trackingCode || '',
      carrier: carrier || '',
      customerName: customerName || 'Khách lẻ',
      customerPhone: customerPhone || '',
      address: address || '',
      status: status as OrderStatus,
      items: items,
      totalAmount: price,
      createdAt: dateRaw ? formatDate(dateRaw) : getLocalTodayStr(),
      paymentMethod: 'COD',
      platform: mapPlatform(platformRaw),
      note: note || '',
      deliveryDeadline: deliveryDeadline || 'Trước 23h59p',
      templateStatus: templateStatus || 'Có mẫu'
    });
  }

  return orders;
};

const parseRow = (rowStr: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (inQuote && rowStr[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
};

const parseCurrency = (str: string | undefined): number => {
  if (!str) return 0;
  return parseInt(str.replace(/\D/g, '')) || 0;
};

const formatDate = (str: string): string => {
  return str.replace(/['"]/g, ''); 
};

const mapPlatform = (str: string | undefined): any => {
  if (!str) return 'Shopee';
  const s = str.toLowerCase();
  if (s.includes('lazada')) return 'Lazada';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('zalo')) return 'Zalo';
  if (s.includes('facebook') || s.includes('fb')) return 'Facebook';
  return 'Shopee';
};
