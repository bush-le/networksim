import React, { useState, useEffect, useCallback } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { GraphRepresentations } from './components/GraphRepresentations';
import { GraphData, AlgorithmType, AlgorithmResult, Node } from './types';
import { SAMPLE_GRAPH_DATA } from './constants';
import * as Algos from './services/graphAlgorithms';
import { analyzeGraphSecurity } from './services/geminiService';
import { 
  Network, Save, FolderOpen, RefreshCw, 
  ShieldCheck, BrainCircuit, Activity, MousePointer, 
  PlusCircle, ArrowRight, Trash2, Play, GitBranch,
  Route, Waves, ScanLine, Grid3X3, List, AlignJustify, BoxSelect
} from 'lucide-react';

// --- ALGORITHM GROUPS DEFINITION ---
interface AlgoOption {
  label: string;
  type: AlgorithmType;
}

interface AlgoGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  options: AlgoOption[];
}

const ALGO_GROUPS: AlgoGroup[] = [
  {
    id: 'routing',
    title: 'Định tuyến (Routing)',
    icon: Route,
    options: [
      { label: 'Dijkstra (Tìm đường ngắn nhất)', type: AlgorithmType.DIJKSTRA }
    ]
  },
  {
    id: 'traversal',
    title: 'Duyệt Đồ Thị (Traversal)',
    icon: ScanLine,
    options: [
      { label: 'BFS (Mô phỏng Broadcast)', type: AlgorithmType.BFS },
      { label: 'DFS (Kiểm tra kết nối sâu)', type: AlgorithmType.DFS }
    ]
  },
  {
    id: 'mst',
    title: 'Cây Khung (MST)',
    icon: GitBranch,
    options: [
      { label: 'Prim (Mạng tối thiểu)', type: AlgorithmType.PRIM },
      { label: 'Kruskal (Mạng tối thiểu)', type: AlgorithmType.KRUSKAL }
    ]
  },
  {
    id: 'flow',
    title: 'Luồng Mạng (Network Flow)',
    icon: Waves,
    options: [
      { label: 'Ford-Fulkerson (Max Flow)', type: AlgorithmType.FORD_FULKERSON }
    ]
  },
  {
    id: 'euler',
    title: 'Phủ Kín (Euler Path)',
    icon: Activity,
    options: [
      { label: 'Fleury', type: AlgorithmType.FLEURY },
      { label: 'Hierholzer', type: AlgorithmType.HIERHOLZER }
    ]
  },
  {
    id: 'analysis',
    title: 'Phân Tích (Analysis)',
    icon: Network,
    options: [
      { label: 'Kiểm tra Bipartite (Phân vùng)', type: AlgorithmType.CHECK_BIPARTITE }
    ]
  }
];

// --- SUB-COMPONENT FOR ALGO CARD ---
const AlgoGroupCard: React.FC<{
  group: AlgoGroup;
  onRun: (type: AlgorithmType) => void;
}> = ({ group, onRun }) => {
  const [selectedType, setSelectedType] = useState<AlgorithmType>(group.options[0].type);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-zinc-400 font-bold text-xs uppercase">
        <group.icon className="w-3 h-3" /> {group.title}
      </div>
      
      {group.options.length > 1 ? (
        <div className="flex flex-col gap-2">
          <select 
            className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded p-1.5 focus:border-blue-500 outline-none"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AlgorithmType)}
          >
            {group.options.map(opt => (
              <option key={opt.type} value={opt.type}>{opt.label}</option>
            ))}
          </select>
          <button 
            onClick={() => onRun(selectedType)}
            className="w-full py-1.5 bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-300 rounded text-xs transition-colors flex items-center justify-center gap-2 font-medium border border-zinc-700 hover:border-blue-500"
          >
            <Play className="w-3 h-3" /> Chạy thuật toán
          </button>
        </div>
      ) : (
        <button 
          onClick={() => onRun(group.options[0].type)}
          className="w-full py-1.5 bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-300 rounded text-xs transition-colors flex items-center justify-center gap-2 font-medium border border-zinc-700 hover:border-blue-500"
        >
          <Play className="w-3 h-3" /> {group.options[0].label}
        </button>
      )}
    </div>
  );
};

type ViewMode = 'graph' | 'matrix' | 'adj_list' | 'edge_list';

const App: React.FC = () => {
  // State
  const [graph, setGraph] = useState<GraphData>(SAMPLE_GRAPH_DATA);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  
  const [mode, setMode] = useState<'select' | 'add_node' | 'add_link' | 'set_start' | 'set_end'>('select');
  const [nodeType, setNodeType] = useState<Node['type']>('router');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{source: string, target: string} | null>(null);
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [endNodeId, setEndNodeId] = useState<string | null>(null);
  const [algoResult, setAlgoResult] = useState<AlgorithmResult | null>(null);
  const [aiReport, setAiReport] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Wrapper to ensure Algo results are cleared when graph changes
  const handleGraphUpdate = (newGraph: GraphData) => {
    setGraph(newGraph);
    if (algoResult) {
      setAlgoResult(null); // Clear outdated results
    }
  };

  // Delete Logic
  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      // Delete Node & connected Links
      const newNodes = graph.nodes.filter(n => n.id !== selectedNodeId);
      const newLinks = graph.links.filter(l => l.source !== selectedNodeId && l.target !== selectedNodeId);
      
      handleGraphUpdate({ ...graph, nodes: newNodes, links: newLinks });
      setSelectedNodeId(null);
      
      // Clear special nodes if deleted
      if (startNodeId === selectedNodeId) setStartNodeId(null);
      if (endNodeId === selectedNodeId) setEndNodeId(null);

    } else if (selectedLink) {
      // Delete Link
      const newLinks = graph.links.filter(l => {
        // Check match for both directed and undirected logic
        const matchDirected = l.source === selectedLink.source && l.target === selectedLink.target;
        const matchUndirected = !graph.isDirected && l.source === selectedLink.target && l.target === selectedLink.source;
        return !(matchDirected || matchUndirected);
      });
      
      handleGraphUpdate({ ...graph, links: newLinks });
      setSelectedLink(null);
    }
  }, [graph, selectedNodeId, selectedLink, startNodeId, endNodeId]);

  // Keyboard Shortcut for Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  // Handlers
  const handleSave = () => {
    const dataStr = JSON.stringify(graph);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'network_graph.json';
    link.click();
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loadedGraph = JSON.parse(ev.target?.result as string);
          setGraph(loadedGraph);
          setAlgoResult(null);
          setStartNodeId(null);
          setEndNodeId(null);
          setSelectedLink(null);
          setSelectedNodeId(null);
        } catch (err) {
          alert('File JSON không hợp lệ');
        }
      };
      reader.readAsText(file);
    }
  };

  const runAlgorithm = (type: AlgorithmType) => {
    // Force switch to graph view to see results
    setViewMode('graph'); 
    setAlgoResult(null);
    let result: AlgorithmResult | null = null;

    try {
      switch (type) {
        case AlgorithmType.BFS:
          if (!startNodeId) return alert("Vui lòng chọn nút bắt đầu trên bản đồ!");
          result = Algos.runBFS(graph, startNodeId);
          break;
        case AlgorithmType.DFS:
          if (!startNodeId) return alert("Vui lòng chọn nút bắt đầu trên bản đồ!");
          result = Algos.runDFS(graph, startNodeId);
          break;
        case AlgorithmType.DIJKSTRA:
          if (!startNodeId || !endNodeId) return alert("Vui lòng chọn nút bắt đầu và kết thúc!");
          result = Algos.runDijkstra(graph, startNodeId, endNodeId);
          break;
        case AlgorithmType.CHECK_BIPARTITE:
          result = Algos.checkBipartite(graph);
          break;
        case AlgorithmType.PRIM:
          result = Algos.runPrim(graph);
          break;
        case AlgorithmType.KRUSKAL:
          result = Algos.runKruskal(graph);
          break;
        case AlgorithmType.FORD_FULKERSON:
          if (!startNodeId || !endNodeId) return alert("Vui lòng chọn nguồn (Start) và đích (End)!");
          result = Algos.runFordFulkerson(graph, startNodeId, endNodeId);
          break;
        case AlgorithmType.FLEURY: 
          result = Algos.runFleury(graph);
          break;
        case AlgorithmType.HIERHOLZER:
          result = Algos.runHierholzer(graph);
          break;
        default:
          break;
      }
      setAlgoResult(result);
    } catch (e: any) {
      alert("Lỗi thuật toán: " + e.message);
    }
  };

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport("Đang phân tích...");
    const report = await analyzeGraphSecurity(graph);
    setAiReport(report);
    setIsAiLoading(false);
  };

  const getLabel = (id: string | null) => {
    if (!id) return 'Chưa chọn';
    const node = graph.nodes.find(n => n.id === id);
    return node ? node.label : id;
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <Network className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent hidden sm:block">
            NetworkSim Pro
          </h1>
        </div>
        
        {/* View Mode Switcher */}
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
           <button 
             onClick={() => setViewMode('graph')}
             className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'graph' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <BoxSelect className="w-4 h-4" /> Đồ thị
           </button>
           <div className="w-px h-4 bg-zinc-800 mx-1"></div>
           <button 
             onClick={() => setViewMode('matrix')}
             className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'matrix' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <Grid3X3 className="w-4 h-4" /> Ma trận
           </button>
           <button 
             onClick={() => setViewMode('adj_list')}
             className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'adj_list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <List className="w-4 h-4" /> DS Kề
           </button>
           <button 
             onClick={() => setViewMode('edge_list')}
             className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'edge_list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <AlignJustify className="w-4 h-4" /> DS Cạnh
           </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleSave} className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Lưu đồ thị">
            <Save className="w-5 h-5" />
          </button>
          <label className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer" title="Mở file">
            <FolderOpen className="w-5 h-5" />
            <input type="file" className="hidden" accept=".json" onChange={handleLoad} />
          </label>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar Left: Tools & Algos */}
        <aside className="w-80 bg-zinc-900/30 border-r border-zinc-800 p-4 overflow-y-auto flex flex-col gap-6 scrollbar-thin">
          
          {/* Edit Tools */}
          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <MousePointer className="w-3 h-3" /> Công cụ vẽ
            </h3>
            
            <div className="flex items-center justify-between mb-3">
               <span className="text-xs text-zinc-400">Kiểu đồ thị:</span>
               <button 
                 onClick={() => handleGraphUpdate({...graph, isDirected: !graph.isDirected})} 
                 className={`px-3 py-1 rounded text-xs font-bold border ${graph.isDirected ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}
               >
                 {graph.isDirected ? 'Có hướng' : 'Vô hướng'}
               </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
               <button 
                onClick={() => setMode('select')}
                className={`p-2 rounded flex flex-col items-center gap-1 text-xs ${mode === 'select' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
               >
                 <MousePointer className="w-4 h-4" /> Chọn
               </button>
               <button 
                onClick={() => setMode('add_link')}
                className={`p-2 rounded flex flex-col items-center gap-1 text-xs ${mode === 'add_link' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
               >
                 <ArrowRight className="w-4 h-4" /> Nối Cạnh
               </button>
               <button 
                 onClick={() => { handleGraphUpdate(SAMPLE_GRAPH_DATA); setStartNodeId(null); setEndNodeId(null); setSelectedLink(null); setSelectedNodeId(null); }}
                 className="p-2 rounded flex flex-col items-center gap-1 text-xs bg-zinc-800 text-zinc-400 hover:bg-red-900/30 hover:text-red-400"
               >
                 <RefreshCw className="w-4 h-4" /> Reset
               </button>
            </div>
            
            <div className="mt-2 grid grid-cols-2 gap-2">
               {['router', 'switch', 'pc', 'server'].map((t) => (
                 <button
                  key={t}
                  onClick={() => { setMode('add_node'); setNodeType(t as any); }}
                  className={`p-2 rounded text-xs flex items-center gap-2 capitalize border ${mode === 'add_node' && nodeType === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}
                 >
                   <PlusCircle className="w-3 h-3" /> {t}
                 </button>
               ))}
            </div>

            {/* Delete Button */}
            <div className="mt-3">
              <button
                onClick={deleteSelected}
                disabled={!selectedNodeId && !selectedLink}
                className="w-full p-2 rounded flex items-center justify-center gap-2 text-xs font-bold border border-red-900/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Xóa đang chọn (Del)
              </button>
            </div>
          </section>

          {/* Algorithms */}
          <section>
             <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <BrainCircuit className="w-3 h-3" /> Thuật toán
            </h3>
            
            <div className="space-y-4">
              {/* Node Selection UI */}
              <div className="flex flex-col gap-2 text-sm bg-zinc-900/50 p-3 rounded border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">Điểm bắt đầu:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold truncate max-w-[80px] ${startNodeId ? 'text-green-400' : 'text-zinc-600'}`}>
                      {getLabel(startNodeId)}
                    </span>
                    <button 
                      onClick={() => setMode(mode === 'set_start' ? 'select' : 'set_start')}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${mode === 'set_start' ? 'bg-green-600 text-white border-green-500' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}
                    >
                      {mode === 'set_start' ? 'Đang chọn...' : 'Chọn'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 text-xs">Điểm kết thúc:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold truncate max-w-[80px] ${endNodeId ? 'text-red-400' : 'text-zinc-600'}`}>
                      {getLabel(endNodeId)}
                    </span>
                    <button 
                      onClick={() => setMode(mode === 'set_end' ? 'select' : 'set_end')}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${mode === 'set_end' ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}
                    >
                      {mode === 'set_end' ? 'Đang chọn...' : 'Chọn'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Grouped Algorithms */}
              <div className="flex flex-col gap-3">
                {ALGO_GROUPS.map(group => (
                  <AlgoGroupCard 
                    key={group.id} 
                    group={group} 
                    onRun={runAlgorithm} 
                  />
                ))}
              </div>
            </div>
          </section>
          
          {/* AI Section */}
           <section>
             <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> AI Analysis
            </h3>
            <button 
              onClick={handleAiAnalysis}
              disabled={isAiLoading}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isAiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              Đánh giá an ninh mạng
            </button>
          </section>

        </aside>

        {/* Center Canvas */}
        <div className="flex-1 p-4 relative flex flex-col overflow-hidden">
          {viewMode === 'graph' ? (
             <GraphCanvas 
                graph={graph} 
                setGraph={handleGraphUpdate} 
                algorithmResult={algoResult} 
                mode={mode}
                setMode={setMode}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
                selectedLink={selectedLink}
                setSelectedLink={setSelectedLink}
                nodeTypeToAdd={nodeType}
                startNodeId={startNodeId}
                endNodeId={endNodeId}
                setStartNodeId={setStartNodeId}
                setEndNodeId={setEndNodeId}
              />
          ) : (
             <GraphRepresentations graph={graph} viewMode={viewMode} />
          )}
        </div>

        {/* Right Info Panel */}
        <aside className="w-80 bg-zinc-900/30 border-l border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
             <h3 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
              <Activity className="w-3 h-3" /> Kết quả & Logs
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Logs */}
            {algoResult ? (
              <div className="space-y-2">
                {algoResult.logs.map((log, idx) => (
                  <div key={idx} className="text-xs text-zinc-400 border-l-2 border-zinc-700 pl-2 py-1">
                    {log}
                  </div>
                ))}
                {algoResult.maxFlow !== undefined && (
                   <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded text-green-400 font-bold text-center">
                     Max Flow: {algoResult.maxFlow}
                   </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-600 text-sm text-center mt-10 italic">
                Chạy thuật toán để xem kết quả chi tiết
              </div>
            )}

            {/* AI Report */}
            {aiReport && (
              <div className="mt-6 pt-4 border-t border-zinc-800">
                <h4 className="text-sm font-bold text-purple-400 mb-2">Báo cáo AI Gemini</h4>
                <div className="text-xs text-zinc-300 prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                  {aiReport}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;