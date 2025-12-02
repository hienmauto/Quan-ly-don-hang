
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
            text: `Bạn là trợ lý AI nhập liệu đơn hàng. Nhiệm vụ: trích xuất thông tin từ ảnh (có thể là 1 đơn hoặc danh sách nhiều đơn) để điền vào bảng tính Excel.
            
            Hãy trả về output là JSON Object có cấu trúc:
            { "orders": [ { ...order_details... } ] }

            Chi tiết các trường trong mỗi order:
            - id: Mã đơn hàng (nếu không thấy thì tự tạo mã ngẫu nhiên).
            - trackingCode: Mã vận đơn (thường dưới mã vạch).
            - carrier: Đơn vị vận chuyển (SPX, GHTK, Viettel Post, J&T...).
            - customerName: Tên khách hàng.
            - customerPhone: Số điện thoại.
            - address: Địa chỉ giao hàng.
            - platform: Phân tích logo hoặc thông tin trên phiếu gửi hàng để xác định nền tảng. CHỈ TRẢ VỀ MỘT TRONG CÁC GIÁ TRỊ SAU: "Shopee", "Lazada", "TikTok", "Zalo", "Facebook". Nếu không rõ, mặc định là "Shopee".
            - totalAmount: Tổng tiền thu (số nguyên).
            - createdAt: Ngày giờ đặt hàng theo định dạng "HH:mm dd-MM" (ví dụ: 10:22 01-12). Nếu không tìm thấy thông tin ngày giờ, hãy trả về một chuỗi trống.
            - deliveryDeadline: Hạn giao hàng. 
            - note: Phân tích bill, nếu thấy chữ "Hỏa tốc", "Express", "Gấp" thì trả về "Đơn hỏa tốc", ngược lại mặc định trả về "Đơn thường".
            - items: Mảng sản phẩm. { productName: "tên món", quantity: 1, price: 0 }.
            
            QUY TẮC ĐẶT TÊN SẢN PHẨM (productName) - CỰC KỲ QUAN TRỌNG:
            Hãy phân tích kỹ tên sản phẩm trong ảnh để trích xuất: Hãng xe, Dòng xe, Đời xe, Màu sắc, Số lượng (SL), và các mã sản phẩm (như f012, f002...).
            Sau đó format lại tên sản phẩm theo đúng thứ tự ưu tiên các trường hợp sau:
            
            1. Nếu tên gốc chứa "f012" (không phân biệt hoa thường):
               => Format: "Flamingo F012 + (SL: [Số lượng])"
            
            2. Nếu tên gốc chứa "f002" (không phân biệt hoa thường):
               => Format: "Flamingo F002 + (SL: [Số lượng])"
            
            3. Nếu tên gốc chứa "f011" (không phân biệt hoa thường):
               => Format: "Flamingo F011 + [Mùi hương] + (SL: [Số lượng])"
               (Hãy trích xuất mùi hương như hương dâu, hương táo, hương đào, v.v...)

            4. Nếu tên gốc chứa chữ "PVC" (hoặc PVC nguyên sinh):
               => Format: "[Hãng xe] [Dòng xe] [Đời xe] - Diamond [Màu sắc] (SL: [Số lượng])"
               Ví dụ: "Thảm lót sàn Toyota Yaris Hatchback PVC nguyên sinh, đen, 2019" -> "Toyota Yaris Hatchback 2019 - Diamond đen (SL: 1)"

            5. Nếu tên gốc chứa chữ "cao su cao cấp":
               => Format: "[Hãng xe] [Dòng xe] [Đời xe] - Gold [Màu sắc] (SL: [Số lượng])"
               Ví dụ: "Thảm cao su cao cấp Toyota Vios 2020 màu kem" -> "Toyota Vios 2020 - Gold kem (SL: 1)"

            6. Nếu tên gốc chứa chữ "TPE":
               => Format: "[Hãng xe] [Dòng xe] [Đời xe] - TPE (SL: [Số lượng])"
               Ví dụ: "Thảm Lót Sàn Ô Tô TPE Cao Cấp Toyota Corolla Cross 2019-2024" -> "Toyota Corolla Cross 2019-2024 - TPE (SL: 1)"

            Nếu không thuộc các trường hợp trên, hãy giữ nguyên tên gốc hoặc tóm tắt ngắn gọn kèm (SL: số lượng).
            
            Trả về JSON chuẩn, không thêm markdown formatting.`,
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
    // Rule:
    // If createdAt is Today -> deadline: "Trước 23h59p"
    // If createdAt is Yesterday -> deadline: "Trước 11h59p"
    // Else -> default to "Trước 23h59p"
    
    if (result.orders && Array.isArray(result.orders)) {
        const now = new Date();
        
        // Helper to get "dd-MM" from a Date object
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
           // Default value
           o.deliveryDeadline = 'Trước 23h59p';

           if (o.createdAt) {
               // The AI usually returns "HH:mm dd-MM" or just "dd-MM"
               // We extract the "dd-MM" part.
               let datePart = '';
               const trimmed = o.createdAt.trim();
               
               if (trimmed.includes(' ')) {
                   // e.g. "10:22 01-12" -> pop gives "01-12"
                   datePart = trimmed.split(' ').pop() || '';
               } else {
                   datePart = trimmed;
               }
               
               // Normalize potential slashes to hyphens just in case
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
