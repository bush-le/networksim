// File: api/analyze.ts
import { GoogleGenAI } from "@google/genai";

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  // 1. Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Lấy dữ liệu graph từ Frontend gửi lên
    const { graph } = req.body;

    // 3. Code của bạn giữ nguyên logic ở đây
    // Ở đây process.env.API_KEY hoạt động TỐT vì code chạy trên Server
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Bạn là một chuyên gia an ninh mạng và lý thuyết đồ thị.
      Hãy phân tích cấu trúc mạng máy tính sau đây:
      Thông tin các nút: ${JSON.stringify(graph.nodes.map(n => ({ id: n.id, label: n.label, type: n.type })))}
      Thông tin liên kết: ${JSON.stringify(graph.links.map(l => ({ from: l.source, to: l.target, weight: l.weight })))}
      Loại đồ thị: ${graph.isDirected ? 'Có hướng' : 'Vô hướng'}
      
      Yêu cầu báo cáo ngắn gọn (Markdown):
      1. Đánh giá tính liên thông & SPOF.
      2. Tối ưu hóa định tuyến.
      3. Đề xuất bảo mật.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Lưu ý: 2.5 chưa public rộng rãi, nên dùng 1.5 để ổn định
      contents: prompt,
    });

    // 4. Trả kết quả về cho Frontend
    const text = response.text || "Không thể tạo báo cáo.";
    return res.status(200).json({ result: text });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Lỗi Server khi gọi Gemini" });
  }
}