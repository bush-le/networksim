// File: src/services/geminiService.ts
import { GraphData } from "../types";

export const analyzeGraphSecurity = async (graph: GraphData): Promise<string> => {
  try {
    // Gọi về API Serverless của chính mình
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ graph }), // Gửi dữ liệu graph lên
    });

    if (!response.ok) {
      throw new Error("Lỗi khi gọi API phân tích");
    }

    const data = await response.json();
    return data.result; // Nhận kết quả text về

  } catch (error) {
    console.error("Client Error:", error);
    return "Lỗi kết nối đến server phân tích.";
  }
};