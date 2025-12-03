import { Order, OrderStatus, OrderItem } from '../types';

const SHEET_ID = '1HARjln1eTmMPJo1WX6n0KHX-UtLst0PPB8LgBy4-5CQ';
const SHEET_GID = '1857148256';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

// --- CONFIG CHO TASCO SHEET ---
const TASCO_SHEET_ID = '17ViwoLY03r7HzopWidYzR1Fl02EYq8Bx2fggaivpkhc';
const TASCO_SHEET_NAME = 'Trang tính1'; // Cập nhật tên sheet chính xác từ screenshot
const TASCO_CSV_URL = `https://docs.google.com/spreadsheets/d/${TASCO_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TASCO_SHEET_NAME)}`;

// URL Script - Đã cập nhật
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_kglUd-3CViKNSoARFydIuJ1lW0SGNI0NjkvkBc9K4AXYVEWcM5N5lm2oil36xLmLkQ/exec'; 

// N8N Webhook URLs
const N8N_ADD_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/them-don';
const N8N_UPDATE_ONE_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/update-nhieu-don';
const N8N_UPDATE_BULK_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/update-nhieu-don';
const N8N_DELETE_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/xoa-don';
const N8N_STATS_WEBHOOK_URL = 'https://n8n.hienmauto.com/webhook/quan-ly-don-hang/don-da-gui';

// --- ORDERS FUNCTIONS ---

export const fetchOrdersFromSheet = async (): Promise<Order[]> => {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch sheet');
    const text = await response.text();
    const orders = parseCSV(text);
    return orders.reverse();
  } catch (error) {
    console.error('Error fetching sheet:', error);
    return [];
  }
};

export const fetchN8NStatsData = async (): Promise<any[]> => {
  try {
    const response = await fetch(N8N_STATS_WEBHOOK_URL);
    if (!response.ok) throw new Error('Failed to fetch stats from N8N');
    const data = await response.json();
    if (Array.isArray(data)) {
      return data;
    }
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

const formatItemsToString = (items: OrderItem[] | undefined): string => {
  if (!items || items.length === 0) return '';
  
  if (items.length === 1) {
    return items[0].productName;
  }
  
  return items.map(i => {
    const nameLower = i.productName.toLowerCase();
    if (nameLower.includes('sl:') || i.quantity <= 1) {
      return i.productName;
    }
    return `${i.productName} (SL: ${i.quantity})`;
  }).join(' + ');
};

const mapOrderToSheetRow = (order: Partial<Order>) => {
  const productString = formatItemsToString(order.items);

  const statusValue = order.status || 'Đã in bill';
  const deliveryValue = order.deliveryDeadline || 'Trước 23h59p';
  const noteValue = order.note || 'Đơn thường';
  const templateValue = order.templateStatus || 'Có mẫu';
  
  let idToSave = order.id || '';
  if (idToSave.startsWith('_gen_')) {
    idToSave = '';
  }
  
  return [
    idToSave,                                           
    order.trackingCode || '',                           
    order.carrier || '',                                
    order.createdAt || getLocalTodayStr(),              
    order.customerName || '',                           
    order.customerPhone || '',                          
    order.address || '',                                
    productString,                                      
    order.platform || 'Shopee',                         
    order.totalAmount || 0,                             
    statusValue,                                        
    deliveryValue,                                      
    noteValue,                                          
    templateValue                                       
  ];
};

const mapOrderToN8NPayload = (order: Partial<Order>) => {
  const productString = formatItemsToString(order.items);
    
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
    const payload = { 
      action: 'add', 
      data: data,
      spreadsheetId: SHEET_ID,
      sheetName: 'Sheet1'
    };

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
    const updates = orders.map(order => ({
      id: order.rowIndex, 
      data: mapOrderToSheetRow(order)
    }));

    const payload = { 
      action: 'updateBatch', 
      data: updates,
      spreadsheetId: SHEET_ID,
      sheetName: 'Sheet1'
    };

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
    const sortedRowIndices = rowIndexes.sort((a, b) => b - a);

    for (const rIndex of sortedRowIndices) {
      const payload = { 
        action: 'delete', 
        id: rIndex,
        spreadsheetId: SHEET_ID,
        sheetName: 'Sheet1'
      };
      
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
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
  if (rows.length < 2) return [];

  const orders: Order[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowStr = rows[i].trim();
    if (!rowStr) continue;
    
    const row = parseRow(rowStr);
    
    const idRaw = row[0];        
    const trackingCode = row[1]; 
    const carrier = row[2];      
    const dateRaw = row[3];      
    const customerName = row[4]; 
    const customerPhone = row[5];
    const address = row[6];      
    const productName = row[7];  
    const platformRaw = row[8];  
    const priceRaw = row[9];     
    const statusRawText = row[10];
    const deliveryDeadline = row[11];
    const note = row[12];        
    const templateStatus = row[13];

    const status = (statusRawText || '').trim() || 'Đã in bill';
    const price = parseCurrency(priceRaw);
    
    const items: OrderItem[] = [{
      productId: 'SHEET_ITEM',
      productName: productName || 'Sản phẩm',
      quantity: 1,
      price: price
    }];

    const sheetRowIndex = i + 1;

    orders.push({
      id: idRaw || `_gen_${sheetRowIndex}`, 
      rowIndex: sheetRowIndex,             
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

// --- TASCO FUNCTIONS ---

export const fetchTascoFromSheet = async (): Promise<any[]> => {
  try {
    const response = await fetch(TASCO_CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch tasco sheet');
    const text = await response.text();
    return parseTascoCSV(text);
  } catch (error) {
    console.error('Error fetching tasco sheet:', error);
    return [];
  }
};

const parseTascoCSV = (text: string): any[] => {
  const rows = text.split('\n');
  if (rows.length < 2) return [];

  const items: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const rowStr = rows[i].trim();
    if (!rowStr) continue;
    const row = parseRow(rowStr);
    
    // Mapping Columns for Tasco:
    // A: ID, B: Name, C: Category, D: ParentId, E: Description, F: LogoUrl, G: Code, H: Status, I: CreatedAt
    items.push({
      id: row[0] || `T${i}`,
      rowIndex: i + 1,
      name: row[1] || '',
      category: row[2] || 'BRAND',
      parentId: row[3] || '',
      description: row[4] || '',
      logoUrl: row[5] || '',
      code: row[6] || '',
      status: (row[7] || 'Active') as 'Active' | 'Inactive',
      createdAt: row[8] || getLocalTodayStr()
    });
  }
  // Reverse to show newest first
  return items.reverse();
};

const mapTascoToSheetRow = (item: any) => {
  return [
    item.id,
    item.name,
    item.category,
    item.parentId || '',
    item.description || '',
    item.logoUrl || '',
    item.code || '',
    item.status || 'Active',
    item.createdAt || getLocalTodayStr()
  ];
};

export const addTascoItemToSheet = async (item: any): Promise<boolean> => {
  try {
    const rowData = mapTascoToSheetRow(item);
    const payload = { 
      action: 'add', 
      sheetName: TASCO_SHEET_NAME, 
      spreadsheetId: TASCO_SHEET_ID, 
      data: [rowData] 
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const addBatchTascoItemsToSheet = async (items: any[]): Promise<boolean> => {
  try {
    const data = items.map(mapTascoToSheetRow);
    const payload = { 
      action: 'add', 
      sheetName: TASCO_SHEET_NAME, 
      spreadsheetId: TASCO_SHEET_ID, 
      data: data 
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const updateTascoItemInSheet = async (item: any): Promise<boolean> => {
  try {
    if (!item.rowIndex) return false;
    const rowData = mapTascoToSheetRow(item);
    
    const payload = { 
      action: 'updateBatch', 
      sheetName: TASCO_SHEET_NAME, 
      spreadsheetId: TASCO_SHEET_ID, 
      data: [{ id: item.rowIndex, data: rowData }]
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const deleteTascoItemFromSheet = async (rowIndex: number): Promise<boolean> => {
  try {
    const payload = { 
      action: 'delete', 
      sheetName: TASCO_SHEET_NAME, 
      spreadsheetId: TASCO_SHEET_ID, 
      id: rowIndex 
    };

    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

// --- SHARED HELPERS ---

export const parseRow = (rowStr: string): string[] => {
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