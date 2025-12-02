
import { GoogleGenAI } from "@google/genai";
import { Order, OrderStatus } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeBusinessData = async (orders: Order[]) => {
  if (!apiKey) return "Vui lòng cấu hình API Key để sử dụng tính năng AI.";

  const recentOrders = orders.slice(0, 20);
  const dataSummary = JSON.stringify(recentOrders.map(o => ({
    id: o.id,
    total: o.totalAmount,
    status: o.status,
    date: o.createdAt
  })));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Dưới đây là dữ liệu các đơn hàng gần đây của một cửa hàng bán lẻ tại Việt Nam: ${dataSummary}. 
      Hãy phân tích ngắn gọn trong 3 gạch đầu dòng về tình hình kinh doanh hiện tại và đưa ra 1 lời khuyên cụ thể để cải thiện doanh thu. 
      Trả lời bằng tiếng Việt chuyên nghiệp.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Không thể phân tích dữ liệu lúc này. Vui lòng thử lại sau.";
  }
};

export const suggestOrderAction = async (order: Order) => {
  if (!apiKey) return "Chưa có API Key.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Phân tích đơn hàng sau: ${JSON.stringify(order)}.
      Nếu trạng thái là '${OrderStatus.PENDING}' hoặc '${OrderStatus.PROCESSING}', hãy gợi ý xem có rủi ro nào không (ví dụ: giá trị quá lớn, hoặc thông tin thiếu).
      Nếu trạng thái là '${OrderStatus.CANCELLED}', hãy gợi ý cách giữ chân khách hàng.
      Trả lời ngắn gọn 1 câu.`,
    });
    return response.text;
  } catch (error) {
    console.error(error);
    return "Lỗi phân tích.";
  }
};

export const extractOrderFromImage = async (base64Data: string, mimeType: string): Promise<Partial<Order>[] | null> => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `Bạn là trợ lý AI nhập liệu đơn hàng. Nhiệm vụ: trích xuất thông tin từ ảnh phiếu in đơn hàng (có thể là 1 đơn hoặc danh sách nhiều đơn) để điền vào hệ thống.
            
            Hãy trả về output là JSON Object có cấu trúc:
            { "orders": [ { ...order_details... } ] }

            YÊU CẦU ĐẶC BIỆT VỀ SẢN PHẨM (RẤT QUAN TRỌNG):
            1. Một đơn hàng có thể chứa NHIỀU sản phẩm. Hãy đọc kỹ phần "Nội dung hàng", "Tên sản phẩm", hoặc danh sách hàng hóa.
            2. Nếu thấy danh sách đánh số (1., 2., 3...) hoặc gạch đầu dòng, hãy tách chúng thành từng item riêng biệt trong mảng 'items'.
            3. Nếu ảnh ghi tổng số lượng (ví dụ "Tổng SL: 3") nhưng chỉ liệt kê gộp, hãy cố gắng tách ra.
            4. Đọc chính xác Số lượng (SL) của từng món.
            
            Chi tiết các trường trong mỗi order:
            - id: Mã vận đơn hoặc Mã đơn hàng (ưu tiên Mã vận đơn nếu có).
            - trackingCode: Mã vận đơn (thường dưới mã vạch).
            - carrier: Đơn vị vận chuyển (Viettel Post, SPX, GHTK, J&T...).
            - customerName: Tên người nhận.
            - customerPhone: SĐT người nhận.
            - address: Địa chỉ người nhận.
            - platform: "Shopee", "Lazada", "TikTok", "Zalo", "Facebook" (nhìn logo). Mặc định "Shopee".
            - totalAmount: Tổng tiền thu người nhận (COD).
            - createdAt: Ngày đặt hàng "HH:mm dd-MM".
            - note: Nếu thấy "Hỏa tốc", "Express" -> "Đơn hỏa tốc". Ngược lại "Đơn thường".
            - items: Mảng chứa các sản phẩm. { productName: "Tên đầy đủ", quantity: 1, price: 0 }.
            
            QUY TẮC CHUẨN HÓA TÊN SẢN PHẨM:
            - Nếu tên chứa "f012" -> "Flamingo F012"
            - Nếu tên chứa "f002" -> "Flamingo F002"
            - Nếu tên chứa "f011" -> "Flamingo F011 + [Mùi hương]"
            - Nếu chứa "PVC" -> "[Hãng] [Dòng] [Đời] - Diamond [Màu]"
            - Nếu chứa "cao su cao cấp" -> "[Hãng] [Dòng] [Đời] - Gold [Màu]"
            - Nếu chứa "TPE" -> "[Hãng] [Dòng] [Đời] - TPE"
            
            Trả về JSON chuẩn không kèm markdown.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);

    // --- Post Processing for Delivery Deadline ---
    if (result.orders && Array.isArray(result.orders)) {
        const now = new Date();
        const getDayMonth = (d: Date) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}-${month}`;
        }
        
        const todayStr = getDayMonth(now);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = getDayMonth(yesterday);

        result.orders.forEach((o: Partial<Order>) => {
           o.deliveryDeadline = 'Trước 23h59p'; // Default

           if (o.createdAt) {
               let datePart = '';
               const trimmed = o.createdAt.trim();
               if (trimmed.includes(' ')) {
                   datePart = trimmed.split(' ').pop() || '';
               } else {
                   datePart = trimmed;
               }
               datePart = datePart.replace(/\//g, '-');
               
               if (datePart === todayStr) {
                   o.deliveryDeadline = 'Trước 23h59p';
               } else if (datePart === yesterdayStr) {
                   o.deliveryDeadline = 'Trước 11h59p';
               }
           }
        });
    }

    return result.orders || [];
  } catch (error) {
    console.error("Error extracting order from image:", error);
    return null;
  }
};
