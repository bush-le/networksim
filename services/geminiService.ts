import { GoogleGenAI } from "@google/genai";
import { GraphData } from "../types";

export const analyzeGraphSecurity = async (graph: GraphData): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Bạn là một chuyên gia an ninh mạng và lý thuyết đồ thị.
      Hãy phân tích cấu trúc mạng máy tính sau đây được biểu diễn dưới dạng đồ thị:
      
      Thông tin các nút (Nodes): ${JSON.stringify(graph.nodes.map(n => ({ id: n.id, label: n.label, type: n.type })))}
      Thông tin các liên kết (Links/Edges): ${JSON.stringify(graph.links.map(l => ({ from: l.source, to: l.target, weight: l.weight })))}
      Loại đồ thị: ${graph.isDirected ? 'Có hướng' : 'Vô hướng'}

      Vui lòng cung cấp một báo cáo ngắn gọn (bằng tiếng Việt) bao gồm:
      1. Đánh giá tính liên thông và khả năng chịu lỗi (Single Points of Failure).
      2. Tối ưu hóa định tuyến: Các nút nào là trung tâm quan trọng?
      3. Đề xuất bảo mật dựa trên cấu trúc (ví dụ: cần thêm Firewall ở đâu, phân đoạn mạng ra sao).
      
      Trả lời định dạng Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Không thể tạo báo cáo phân tích.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Lỗi khi kết nối với AI. Vui lòng kiểm tra API Key.";
  }
};