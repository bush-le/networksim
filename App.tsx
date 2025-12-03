
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { GraphRepresentations } from './components/GraphRepresentations';
import { ProjectInfoModal } from './components/ProjectInfoModal';
import { GraphData, AlgorithmType, AlgorithmResult, Node, Link, AlgorithmStep } from './types';
import { SAMPLE_GRAPH_DATA, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import * as Algos from './services/graphAlgorithms';
import { analyzeGraphSecurity } from './services/geminiService';
import { 
  Network, Save, FolderOpen, RefreshCw, 
  ShieldCheck, BrainCircuit, Activity, MousePointer, 
  PlusCircle, ArrowRight, Trash2, Play, GitBranch,
  Route, Waves, ScanLine, Grid3X3, List, AlignJustify, BoxSelect,
  Pause, SkipBack, SkipForward, X, Info, Server, Share2, Layers, Cpu, Monitor, Router as RouterIcon,
  Shuffle, Dices, Settings2, ChevronLeft, ChevronRight, Copy, CheckCircle2
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
    title: 'Giao Thức Định Tuyến (Routing)',
    icon: Route,
    options: [
      { label: 'Mô phỏng OSPF (Dijkstra)', type: AlgorithmType.DIJKSTRA },
      { label: 'Mô phỏng RIP (Bellman-Ford)', type: AlgorithmType.BELLMAN_FORD }
    ]
  },
  {
    id: 'traversal',
    title: 'Dò Quét & Lan Truyền',
    icon: Share2,
    options: [
      { label: 'Mô phỏng Broadcast (BFS)', type: AlgorithmType.BFS },
      { label: 'Kiểm tra Kết nối Sâu (DFS)', type: AlgorithmType.DFS }
    ]
  },
  {
    id: 'mst',
    title: 'Thiết Kế Hạ Tầng & STP',
    icon: GitBranch,
    options: [
      { label: 'Tối ưu Hạ tầng Mạng (Prim)', type: AlgorithmType.PRIM },
      { label: 'Tối ưu Chi phí Cáp (Kruskal)', type: AlgorithmType.KRUSKAL }
    ]
  },
  {
    id: 'flow',
    title: 'Kỹ Thuật Lưu Lượng',
    icon: Waves,
    options: [
      { label: 'Phân tích Băng thông Cực đại (Max Flow)', type: AlgorithmType.FORD_FULKERSON }
    ]
  },
  {
    id: 'euler',
    title: 'Kiểm Tra Độ Tin Cậy',
    icon: Activity,
    options: [
      { label: 'Kiểm tra Phủ kín Liên kết (Fleury)', type: AlgorithmType.FLEURY },
      { label: 'Kiểm tra Mạch vòng (Hierholzer)', type: AlgorithmType.HIERHOLZER }
    ]
  },
  {
    id: 'analysis',
    title: 'Kiến Trúc Mạng',
    icon: Layers,
    options: [
      { label: 'Phân tích Phân vùng Mạng (Bipartite)', type: AlgorithmType.CHECK_BIPARTITE }
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
    <div className="bg-zinc-900/40 border border-zinc-800 rounded p-3 shadow-sm hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-2 mb-2 text-zinc-400 font-bold text-xs uppercase tracking-wider">
        <group.icon className="w-3.5 h-3.5 text-blue-500" /> {group.title}
      </div>
      
      {group.options.length > 1 ? (
        <div className="flex flex-col gap-2">
          <select 
            className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded p-1.5 focus:border-blue-500 outline-none cursor-pointer"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AlgorithmType)}
          >
            {group.options.map(opt => (
              <option key={opt.type} value={opt.type}>{opt.label}</option>
            ))}
          </select>
          <button 
            onClick={() => onRun(selectedType)}
            className="w-full py-1.5 bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-300 rounded text-xs transition-colors flex items-center justify-center gap-2 font-medium border border-zinc-700 hover:border-blue-500 active:scale-95 transform duration-75"
          >
            <Play className="w-3 h-3" /> Chạy Mô Phỏng
          </button>
        </div>
      ) : (
        <button 
          onClick={() => onRun(group.options[0].type)}
          className="w-full py-1.5 bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-300 rounded text-xs transition-colors flex items-center justify-center gap-2 font-medium border border-zinc-700 hover:border-blue-500 active:scale-95 transform duration-75"
        >
          <Play className="w-3 h-3" /> {group.options[0].label}
        </button>
      )}
    </div>
  );
};

// --- HELPER TO GENERATE GRAPH ---
interface TopologyConfig {
  routers: number;
  switches: number;
  pcs: number;
  servers: number;
  randomWeights: boolean;
}

const generateTopology = (config: TopologyConfig): GraphData => {
  const nodes: Node[] = [];
  const links: Link[] = [];
  let idCounter = 1;

  // Helper function to distribute nodes evenly across the width
  const placeLayer = (
    count: number, 
    baseY: number, 
    type: Node['type'], 
    labelPrefix: string
  ): Node[] => {
    const layerNodes: Node[] = [];
    if (count <= 0) return layerNodes;

    const paddingX = 60;
    const availableWidth = CANVAS_WIDTH - (paddingX * 2);
    const stepX = count > 1 ? availableWidth / (count - 1) : 0;
    const startX = count > 1 ? paddingX : CANVAS_WIDTH / 2;

    for (let i = 0; i < count; i++) {
      const x = startX + (stepX * i);
      const y = baseY + (Math.random() * 30 - 15); 
      
      const node: Node = {
        id: `n${idCounter++}`,
        label: `${labelPrefix} ${i + 1}`,
        type: type,
        x: Math.round(x),
        y: Math.round(y)
      };
      nodes.push(node);
      layerNodes.push(node);
    }
    return layerNodes;
  };

  const rInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  
  const getWeight = (min: number, max: number) => {
    if (config.randomWeights) return rInt(1, 50);
    return rInt(min, max);
  };

  // 1. Create Layers
  const routers = placeLayer(config.routers, 100, 'router', 'Router');
  const switches = placeLayer(config.switches, 280, 'switch', 'Switch');

  const totalHosts = config.pcs + config.servers;
  const hosts: Node[] = [];
  
  if (totalHosts > 0) {
    const paddingX = 40;
    const availableWidth = CANVAS_WIDTH - (paddingX * 2);
    const stepX = totalHosts > 1 ? availableWidth / (totalHosts - 1) : 0;
    const startX = totalHosts > 1 ? paddingX : CANVAS_WIDTH / 2;

    let pcCount = 0;
    let serverCount = 0;

    for (let i = 0; i < totalHosts; i++) {
      let type: Node['type'] = 'pc';
      let label = '';
      
      if (serverCount < config.servers && (i % 3 === 0 || pcCount >= config.pcs)) {
        type = 'server';
        serverCount++;
        label = `Server ${serverCount}`;
      } else {
        type = 'pc';
        pcCount++;
        label = `PC ${pcCount}`;
      }

      const x = startX + (stepX * i);
      const y = 480 + (Math.random() * 40 - 20);

      const node: Node = {
        id: `n${idCounter++}`,
        label: label,
        type: type,
        x: Math.round(x),
        y: Math.round(y)
      };
      nodes.push(node);
      hosts.push(node);
    }
  }

  // 2. Create Links
  if (routers.length > 1) {
    for (let i = 0; i < routers.length; i++) {
      if (i < routers.length - 1) {
        links.push({ source: routers[i].id, target: routers[i+1].id, weight: getWeight(10, 30), capacity: 1000 });
      }
    }
    if (routers.length > 2) {
      links.push({ source: routers[routers.length-1].id, target: routers[0].id, weight: getWeight(10, 30), capacity: 1000 });
    }
  }

  switches.forEach((sw) => {
    if (routers.length > 0) {
      const sortedRouters = [...routers].sort((a, b) => Math.abs(a.x - sw.x) - Math.abs(b.x - sw.x));
      links.push({ source: sw.id, target: sortedRouters[0].id, weight: getWeight(5, 15), capacity: 1000 });
      if (sortedRouters.length > 1 && Math.random() > 0.6) {
         links.push({ source: sw.id, target: sortedRouters[1].id, weight: getWeight(10, 20), capacity: 1000 });
      }
    }
  });

  hosts.forEach((host) => {
    if (switches.length > 0) {
      const closestSwitch = switches.reduce((prev, curr) => 
        Math.abs(curr.x - host.x) < Math.abs(prev.x - host.x) ? curr : prev
      );
      links.push({ source: host.id, target: closestSwitch.id, weight: getWeight(2, 5), capacity: 100 });
    } else if (routers.length > 0) {
      const closestRouter = routers.reduce((prev, curr) => 
        Math.abs(curr.x - host.x) < Math.abs(prev.x - host.x) ? curr : prev
      );
      links.push({ source: host.id, target: closestRouter.id, weight: getWeight(5, 10), capacity: 100 });
    }
  });

  return { nodes, links, isDirected: false };
};


type ViewMode = 'graph' | 'matrix' | 'adj_list' | 'edge_list';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initConfig, setInitConfig] = useState<TopologyConfig>({ 
    routers: 2, switches: 2, pcs: 4, servers: 1, randomWeights: false 
  });
  
  const [graph, setGraph] = useState<GraphData>(SAMPLE_GRAPH_DATA); 
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  
  const [mode, setMode] = useState<'select' | 'add_node' | 'add_link' | 'set_start' | 'set_end'>('select');
  const [edgeLabelMode, setEdgeLabelMode] = useState<'weight' | 'capacity'>('weight');
  const [nodeType, setNodeType] = useState<Node['type']>('router');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{source: string, target: string} | null>(null);
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [endNodeId, setEndNodeId] = useState<string | null>(null);
  
  const [finalResult, setFinalResult] = useState<AlgorithmResult | null>(null);
  const [displayedResult, setDisplayedResult] = useState<AlgorithmResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [aiReport, setAiReport] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  
  const [showInfoModal, setShowInfoModal] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedResult?.logs.length]);

  const handleGraphUpdate = (newGraph: GraphData) => {
    setGraph(newGraph);
    if (finalResult) {
      setFinalResult(null); 
      setDisplayedResult(null);
      setIsPlaying(false);
      setStepIndex(0);
    }
  };

  const toggleMode = (targetMode: 'select' | 'add_node' | 'add_link') => {
    if (mode === targetMode) setMode('select');
    else setMode(targetMode);
  };

  const toggleSetPointMode = (targetMode: 'set_start' | 'set_end') => {
    if (mode === targetMode) setMode('select');
    else setMode(targetMode);
  };

  const handleInitialize = (useRandomWeights: boolean) => {
    const config = { ...initConfig, randomWeights: useRandomWeights };
    const newGraph = generateTopology(config);
    setStartNodeId(null);
    setEndNodeId(null);
    setGraph(newGraph);
    setIsInitialized(true);
  };
  
  const handleFullyRandom = () => {
    const rInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomConfig: TopologyConfig = {
      routers: rInt(1, 3),
      switches: rInt(2, 5),
      pcs: rInt(5, 12),
      servers: rInt(1, 3),
      randomWeights: true
    };
    setInitConfig(randomConfig);
    const newGraph = generateTopology(randomConfig);
    setStartNodeId(null);
    setEndNodeId(null);
    setGraph(newGraph);
    setIsInitialized(true);
  };
  
  const handleUseSample = () => {
    setGraph(SAMPLE_GRAPH_DATA);
    setStartNodeId(null);
    setEndNodeId(null);
    setIsInitialized(true);
  }

  const copyLogsToClipboard = () => {
    if (!displayedResult?.logs) return;
    const text = displayedResult.logs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    });
  };

  // --- ANIMATION TIMER ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && finalResult?.steps && stepIndex < finalResult.steps.length) {
      interval = setInterval(() => {
        setStepIndex(prev => {
          if (prev >= (finalResult.steps?.length || 0) - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800); 
    }
    return () => clearInterval(interval);
  }, [isPlaying, finalResult, stepIndex]);

  // Sync Step Index to Displayed Result
  useEffect(() => {
    if (finalResult && finalResult.steps && finalResult.steps.length > 0) {
      const currentStep = finalResult.steps[stepIndex];
      // Build a result object that represents the state up to this step
      const computedResult: AlgorithmResult = {
        logs: finalResult.steps.slice(0, stepIndex + 1).map(s => s.log),
        visited: currentStep.visited,
        path: currentStep.path,
        mstLinks: currentStep.mstLinks,
        traversedEdges: currentStep.traversedEdges,
        flowDetails: currentStep.flowDetails,
        bipartiteSets: currentStep.bipartiteSets, 
        maxFlow: currentStep.flowDetails ? finalResult.maxFlow : undefined, 
        steps: [currentStep] 
      };
      setDisplayedResult(computedResult);
    } else if (finalResult) {
       setDisplayedResult(finalResult);
    }
  }, [stepIndex, finalResult]);

  // Delete Logic
  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      const newNodes = graph.nodes.filter(n => n.id !== selectedNodeId);
      const newLinks = graph.links.filter(l => l.source !== selectedNodeId && l.target !== selectedNodeId);
      handleGraphUpdate({ ...graph, nodes: newNodes, links: newLinks });
      setSelectedNodeId(null);
      if (startNodeId === selectedNodeId) setStartNodeId(null);
      if (endNodeId === selectedNodeId) setEndNodeId(null);
    } else if (selectedLink) {
      const newLinks = graph.links.filter(l => {
        const matchDirected = l.source === selectedLink.source && l.target === selectedLink.target;
        const matchUndirected = !graph.isDirected && l.source === selectedLink.target && l.target === selectedLink.source;
        return !(matchDirected || matchUndirected);
      });
      handleGraphUpdate({ ...graph, links: newLinks });
      setSelectedLink(null);
    }
  }, [graph, selectedNodeId, selectedLink, startNodeId, endNodeId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  const handleSave = () => {
    const dataStr = JSON.stringify(graph);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
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
          setFinalResult(null);
          setDisplayedResult(null);
          setStartNodeId(null);
          setEndNodeId(null);
          setIsInitialized(true); 
        } catch (err) { alert('File JSON không hợp lệ'); }
      };
      reader.readAsText(file);
    }
  };

  const runAlgorithm = (type: AlgorithmType) => {
    setViewMode('graph'); 
    setFinalResult(null);
    setDisplayedResult(null);
    setStepIndex(0);
    setIsPlaying(false);

    let result: AlgorithmResult | null = null;
    try {
      switch (type) {
        case AlgorithmType.BFS:
          if (!startNodeId) return alert("Vui lòng chọn Nút Nguồn để bắt đầu!");
          result = Algos.runBFS(graph, startNodeId);
          break;
        case AlgorithmType.DFS:
          if (!startNodeId) return alert("Vui lòng chọn Nút Nguồn để bắt đầu!");
          result = Algos.runDFS(graph, startNodeId);
          break;
        case AlgorithmType.DIJKSTRA:
          if (!startNodeId) return alert("Vui lòng chọn Nút Nguồn để bắt đầu!");
          result = Algos.runDijkstra(graph, startNodeId, endNodeId || null);
          break;
        case AlgorithmType.BELLMAN_FORD:
          if (!startNodeId) return alert("Vui lòng chọn Nút Nguồn để bắt đầu!");
          result = Algos.runBellmanFord(graph, startNodeId, endNodeId || null);
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
          if (!startNodeId || !endNodeId) return alert("Vui lòng chọn Nút Nguồn và Nút Đích!");
          result = Algos.runFordFulkerson(graph, startNodeId, endNodeId);
          break;
        case AlgorithmType.FLEURY: 
          result = Algos.runFleury(graph);
          break;
        case AlgorithmType.HIERHOLZER:
          result = Algos.runHierholzer(graph);
          break;
        default: break;
      }
      
      if (result) {
        setFinalResult(result);
        if (result.steps && result.steps.length > 0) {
           setIsPlaying(true); 
        } else {
           setDisplayedResult(result); 
        }
      }
    } catch (e: any) {
      alert("Lỗi mô phỏng: " + e.message);
    }
  };

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiReport("Đang phân tích cấu trúc mạng...");
    const report = await analyzeGraphSecurity(graph);
    setAiReport(report);
    setIsAiLoading(false);
  };

  const getLabel = (id: string | null) => graph.nodes.find(n => n.id === id)?.label || 'Chưa chọn';

  if (!isInitialized) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
           <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/30 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
           <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/30 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="z-10 bg-zinc-900/50 backdrop-blur-md border border-zinc-700 p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in duration-300">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
               <Server className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent text-center">
              NetworkSim Pro
            </h1>
            <p className="text-zinc-400 text-sm mt-2 text-center">Hệ thống Mô phỏng & Tối ưu hóa Mạng</p>
          </div>

          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                   <RouterIcon className="w-3 h-3" /> Routers
                 </label>
                 <input 
                   type="number" min="0" max="10"
                   value={initConfig.routers} 
                   onChange={(e) => setInitConfig({...initConfig, routers: Math.max(0, parseInt(e.target.value) || 0)})}
                   className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-center font-bold text-lg focus:border-blue-500 outline-none"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                   <GitBranch className="w-3 h-3" /> Switches
                 </label>
                 <input 
                   type="number" min="0" max="10"
                   value={initConfig.switches} 
                   onChange={(e) => setInitConfig({...initConfig, switches: Math.max(0, parseInt(e.target.value) || 0)})}
                   className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-center font-bold text-lg focus:border-blue-500 outline-none"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                   <Monitor className="w-3 h-3" /> PCs
                 </label>
                 <input 
                   type="number" min="0" max="20"
                   value={initConfig.pcs} 
                   onChange={(e) => setInitConfig({...initConfig, pcs: Math.max(0, parseInt(e.target.value) || 0)})}
                   className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-center font-bold text-lg focus:border-blue-500 outline-none"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1">
                   <Cpu className="w-3 h-3" /> Servers
                 </label>
                 <input 
                   type="number" min="0" max="10"
                   value={initConfig.servers} 
                   onChange={(e) => setInitConfig({...initConfig, servers: Math.max(0, parseInt(e.target.value) || 0)})}
                   className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-center font-bold text-lg focus:border-blue-500 outline-none"
                 />
               </div>
             </div>

             <div className="flex flex-col gap-3 mt-4">
                <button 
                  onClick={() => handleInitialize(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <Settings2 className="w-5 h-5" /> Khởi Tạo Theo Số Đã Chọn
                </button>

                <button 
                  onClick={handleFullyRandom}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <Dices className="w-5 h-5" /> Cấu Trúc Ngẫu Nhiên
                </button>
             </div>
             
             <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-zinc-700"></div>
                <span className="flex-shrink mx-4 text-zinc-600 text-xs uppercase">Hoặc</span>
                <div className="flex-grow border-t border-zinc-700"></div>
             </div>

             <div className="flex gap-3">
               <button onClick={handleUseSample} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-sm text-zinc-300 transition-colors">
                  Dùng Mẫu Có Sẵn
               </button>
               <label className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-sm text-zinc-300 transition-colors cursor-pointer text-center">
                  Mở File JSON
                  <input type="file" className="hidden" accept=".json" onChange={handleLoad} />
               </label>
             </div>
          </div>
        </div>
        <div className="absolute bottom-4 text-zinc-600 text-xs">
           Đồ án Lý thuyết Đồ thị - Mạng máy tính
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      <ProjectInfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />

      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <Server className="w-6 h-6 text-blue-500" />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent hidden sm:block">
              NetworkSim Pro
            </h1>
          </div>
        </div>
        
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button 
             onClick={() => setViewMode('graph')}
             className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'graph' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <BoxSelect className="w-4 h-4" /> Sơ đồ Mạng
           </button>
           <div className="w-px h-4 bg-zinc-800 mx-1"></div>
           <button 
             onClick={() => setViewMode('matrix')}
             className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-all ${viewMode === 'matrix' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <Grid3X3 className="w-4 h-4" /> Ma trận Kề
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
          <button 
             onClick={() => setShowInfoModal(true)} 
             className="p-2 hover:bg-zinc-800 rounded text-purple-400 hover:text-white" title="Thông tin đồ án"
          >
            <Info className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-zinc-800"></div>
          <button onClick={handleSave} className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white" title="Lưu">
            <Save className="w-5 h-5" />
          </button>
          <label className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer" title="Mở">
            <FolderOpen className="w-5 h-5" />
            <input type="file" className="hidden" accept=".json" onChange={handleLoad} />
          </label>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-zinc-900/30 border-r border-zinc-800 p-4 overflow-y-auto flex flex-col gap-6 scrollbar-thin">
           <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <MousePointer className="w-3 h-3" /> Công cụ Vẽ
            </h3>
            
            <div className="flex items-center justify-between mb-3">
               <span className="text-xs text-zinc-400">Loại Đồ thị:</span>
               <button 
                 onClick={() => handleGraphUpdate({...graph, isDirected: !graph.isDirected})} 
                 className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${graph.isDirected ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}
               >
                 {graph.isDirected ? 'Có hướng (Directed)' : 'Vô hướng (Undirected)'}
               </button>
            </div>

            <div className="flex items-center justify-between mb-3 bg-zinc-950 p-1 rounded border border-zinc-800">
               <button
                 onClick={() => setEdgeLabelMode('weight')}
                 className={`flex-1 py-1 text-[10px] uppercase font-bold rounded transition-colors ${edgeLabelMode === 'weight' ? 'bg-blue-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                 title="Hiển thị Trọng số (Metric/Cost)"
               >
                 Weight (Metric)
               </button>
               <button
                 onClick={() => setEdgeLabelMode('capacity')}
                 className={`flex-1 py-1 text-[10px] uppercase font-bold rounded transition-colors ${edgeLabelMode === 'capacity' ? 'bg-cyan-600 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                 title="Hiển thị Dung lượng (Bandwidth)"
               >
                 Capacity (BW)
               </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
               <button 
                onClick={() => toggleMode('select')}
                className={`p-2 rounded flex flex-col items-center gap-1 text-xs transition-colors ${mode === 'select' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
               >
                 <MousePointer className="w-4 h-4" /> Chọn
               </button>
               <button 
                onClick={() => toggleMode('add_link')}
                className={`p-2 rounded flex flex-col items-center gap-1 text-xs transition-colors ${mode === 'add_link' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
               >
                 <ArrowRight className="w-4 h-4" /> Nối Cạnh
               </button>
               <button 
                 onClick={() => { setIsInitialized(false); setGraph(SAMPLE_GRAPH_DATA); setStartNodeId(null); setEndNodeId(null); }}
                 className="p-2 rounded flex flex-col items-center gap-1 text-xs bg-zinc-800 text-zinc-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
               >
                 <RefreshCw className="w-4 h-4" /> Tạo Mới
               </button>
            </div>
            
            <div className="mt-2 grid grid-cols-2 gap-2">
               {['router', 'switch', 'pc', 'server'].map((t) => (
                 <button
                  key={t}
                  onClick={() => { setMode('add_node'); setNodeType(t as any); }}
                  className={`p-2 rounded text-xs flex items-center gap-2 capitalize border transition-colors ${mode === 'add_node' && nodeType === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
                 >
                   <PlusCircle className="w-3 h-3" /> {t}
                 </button>
               ))}
            </div>

            <div className="mt-3">
              <button
                onClick={deleteSelected}
                disabled={!selectedNodeId && !selectedLink}
                className="w-full p-2 rounded flex items-center justify-center gap-2 text-xs font-bold border border-red-900/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Xóa Đối Tượng
              </button>
            </div>
          </section>

          <section>
             <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <BrainCircuit className="w-3 h-3" /> Mô phỏng & Phân tích
            </h3>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-2 text-sm bg-zinc-900/50 p-3 rounded border border-zinc-800">
                <div className="flex items-center justify-between h-8">
                  <span className="text-zinc-400 text-xs">Nút Nguồn (Source):</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono text-xs font-bold truncate max-w-[80px] ${startNodeId ? 'text-green-400' : 'text-zinc-600'}`}>
                      {getLabel(startNodeId)}
                    </span>
                    {startNodeId && (
                      <button onClick={() => setStartNodeId(null)} className="text-zinc-500 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={() => toggleSetPointMode('set_start')}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${mode === 'set_start' ? 'bg-green-600 text-white border-green-500' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}
                    >
                      {mode === 'set_start' ? 'Hủy' : 'Chọn'}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between h-8 border-t border-zinc-800/50 pt-2 mt-1">
                  <span className="text-zinc-400 text-xs">Nút Đích (Target):</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono text-xs font-bold truncate max-w-[80px] ${endNodeId ? 'text-red-400' : 'text-zinc-600'}`}>
                      {getLabel(endNodeId)}
                    </span>
                     {endNodeId && (
                      <button onClick={() => setEndNodeId(null)} className="text-zinc-500 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={() => toggleSetPointMode('set_end')}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${mode === 'set_end' ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}
                    >
                      {mode === 'set_end' ? 'Hủy' : 'Chọn'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {ALGO_GROUPS.map(group => (
                  <AlgoGroupCard key={group.id} group={group} onRun={runAlgorithm} />
                ))}
              </div>
            </div>
          </section>
          
          <section>
             <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Đánh giá An ninh AI
            </h3>
            <button 
              onClick={handleAiAnalysis}
              disabled={isAiLoading}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isAiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              Quét Lỗ Hổng Bảo Mật
            </button>
          </section>
        </aside>

        <div className="flex-1 p-4 relative flex flex-col overflow-hidden">
          {viewMode === 'graph' ? (
             <GraphCanvas 
                graph={graph} 
                setGraph={handleGraphUpdate} 
                algorithmResult={displayedResult} 
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
                edgeLabelMode={edgeLabelMode}
              />
          ) : (
             <GraphRepresentations graph={graph} viewMode={viewMode} />
          )}

          {finalResult && finalResult.steps && finalResult.steps.length > 0 && viewMode === 'graph' && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-zinc-900/90 border border-zinc-700 px-4 py-2 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 z-10">
              <button 
                onClick={() => setStepIndex(0)}
                className="text-zinc-400 hover:text-white"
                title="Về đầu"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
                className="text-zinc-400 hover:text-white"
                title="Bước trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30"
                title={isPlaying ? "Tạm dừng" : "Tiếp tục"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button 
                onClick={() => setStepIndex(Math.min(finalResult.steps!.length - 1, stepIndex + 1))}
                className="text-zinc-400 hover:text-white"
                title="Bước kế tiếp"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setStepIndex(finalResult.steps!.length - 1)}
                className="text-zinc-400 hover:text-white"
                title="Đến cuối"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <div className="text-xs font-mono text-zinc-400 w-24 text-center border-l border-zinc-700 pl-4 ml-2">
                Bước {stepIndex + 1}/{finalResult.steps.length}
              </div>
            </div>
          )}
        </div>

        <aside className="w-80 bg-zinc-900/30 border-l border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
             <h3 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
              <Activity className="w-3 h-3" /> Logs & Sự kiện
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={copyLogsToClipboard} 
                className="text-zinc-500 hover:text-white transition-colors"
                title="Copy toàn bộ logs"
              >
                {copiedLogs ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              {displayedResult && (
                 <button onClick={() => { setFinalResult(null); setDisplayedResult(null); }} className="text-xs text-zinc-500 hover:text-white">
                   Xóa
                 </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            
            {displayedResult ? (
              <div className="space-y-2">
                {displayedResult.logs.map((log, idx) => (
                  <div key={idx} className={`text-xs border-l-2 pl-2 py-1 animate-in slide-in-from-left-2 ${idx === displayedResult.logs.length - 1 ? 'border-blue-500 text-white' : 'border-zinc-700 text-zinc-400'}`}>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
                {displayedResult.maxFlow !== undefined && stepIndex === (finalResult?.steps?.length || 0) - 1 && (
                   <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded text-green-400 font-bold text-center animate-in zoom-in">
                     Max Throughput: {displayedResult.maxFlow} Mbps
                   </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-600 text-sm text-center mt-10 italic flex flex-col gap-2">
                <span>Sẵn sàng mô phỏng...</span>
                <span className="text-xs text-zinc-700 not-italic border-t border-zinc-800 pt-2 mt-2">
                  💡 Mẹo: Click đúp vào số trên cạnh để sửa trọng số nhanh.
                </span>
              </div>
            )}

            {aiReport && (
              <div className="mt-6 pt-4 border-t border-zinc-800 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2 mb-2">
                   <BrainCircuit className="w-4 h-4 text-purple-400" />
                   <h4 className="text-sm font-bold text-purple-400">Báo cáo An Ninh Gemini</h4>
                </div>
                <div className="text-xs text-zinc-300 prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed bg-zinc-900/50 p-3 rounded border border-zinc-800">
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
