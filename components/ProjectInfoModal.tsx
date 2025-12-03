
import React from 'react';
import { Network, GitBranch, Route, Waves, Activity, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectInfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-950 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Network className="text-blue-500 w-5 h-5" /> 
            Thông tin Đồ Án Mô Phỏng Mạng
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="space-y-2">
             <h3 className="text-xl font-bold text-blue-400">Đề tài: Tối ưu hóa định tuyến & An ninh mạng</h3>
             <p className="text-zinc-400 text-sm italic border-l-2 border-blue-500 pl-3">
               "Ứng dụng Lý thuyết đồ thị trong Mô phỏng hệ thống mạng máy tính"
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-zinc-950 p-4 rounded border border-zinc-800">
                <h4 className="font-bold text-white mb-2 text-sm uppercase">1. Ánh xạ (Mapping)</h4>
                <ul className="space-y-2 text-sm text-zinc-300">
                   <li className="flex justify-between border-b border-zinc-800 pb-1">
                      <span>Nút (Node)</span>
                      <span className="text-blue-400 font-mono">Router, Switch, PC, Server</span>
                   </li>
                   <li className="flex justify-between border-b border-zinc-800 pb-1">
                      <span>Cạnh (Link)</span>
                      <span className="text-blue-400 font-mono">Cáp quang, Cáp đồng, WiFi</span>
                   </li>
                   <li className="flex justify-between border-b border-zinc-800 pb-1">
                      <span>Trọng số (Weight)</span>
                      <span className="text-blue-400 font-mono">Độ trễ (Latency) hoặc Chi phí (Cost)</span>
                   </li>
                   <li className="flex justify-between">
                      <span>Dung lượng (Capacity)</span>
                      <span className="text-blue-400 font-mono">Băng thông (Bandwidth - Mbps)</span>
                   </li>
                </ul>
             </div>

             <div className="bg-zinc-950 p-4 rounded border border-zinc-800">
                <h4 className="font-bold text-white mb-2 text-sm uppercase">2. Giải thích Thuật toán</h4>
                <ul className="space-y-3 text-sm text-zinc-300">
                   <li className="flex items-start gap-2">
                      <Route className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-green-400">OSPF & RIP (Dijkstra/Bellman-Ford)</strong>
                        <p className="text-xs text-zinc-500">Mô phỏng các giao thức định tuyến trạng thái liên kết (Link-State) và vecto khoảng cách (Distance-Vector) để tìm đường đi tối ưu cho gói tin.</p>
                      </div>
                   </li>
                   <li className="flex items-start gap-2">
                      <GitBranch className="w-4 h-4 text-purple-500 mt-0.5" />
                      <div>
                        <strong className="text-purple-400">Thiết kế Hạ tầng (Prim/Kruskal)</strong>
                        <p className="text-xs text-zinc-500">Xây dựng mạng trục (Backbone) với chi phí thấp nhất hoặc mô phỏng giao thức STP để chống vòng lặp (loop).</p>
                      </div>
                   </li>
                   <li className="flex items-start gap-2">
                      <Waves className="w-4 h-4 text-cyan-500 mt-0.5" />
                      <div>
                        <strong className="text-cyan-400">Kỹ thuật Lưu lượng (Ford-Fulkerson)</strong>
                        <p className="text-xs text-zinc-500">Tính toán thông lượng cực đại (Max Throughput) của hệ thống để xác định khả năng chịu tải và phát hiện điểm nghẽn.</p>
                      </div>
                   </li>
                   <li className="flex items-start gap-2">
                      <Activity className="w-4 h-4 text-yellow-500 mt-0.5" />
                      <div>
                        <strong className="text-yellow-400">Kiểm tra Độ tin cậy (Euler)</strong>
                        <p className="text-xs text-zinc-500">Đảm bảo khả năng đi qua tất cả các liên kết vật lý để phục vụ công tác bảo trì hoặc giám sát toàn mạng.</p>
                      </div>
                   </li>
                </ul>
             </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded">
             <h4 className="font-bold text-blue-300 mb-2 text-sm uppercase">3. Đánh giá An ninh (AI)</h4>
             <p className="text-sm text-zinc-300">
               Hệ thống tích hợp <strong>Google Gemini AI</strong> để phân tích Sơ đồ mạng, phát hiện các điểm yếu đơn lẻ (Single Point of Failure) và đề xuất vị trí đặt Firewall/IDS tối ưu.
             </p>
          </div>
          
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
           <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm transition-colors">
             Đóng
           </button>
        </div>
      </div>
    </div>
  );
};