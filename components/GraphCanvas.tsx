import React, { useRef, useState, useMemo, useEffect } from 'react';
import { GraphData, Node, Link, AlgorithmResult } from '../types';
import { DEFAULT_NODE_RADIUS } from '../constants';
import { Check, X } from 'lucide-react';

interface GraphCanvasProps {
  graph: GraphData;
  setGraph: (g: GraphData) => void;
  algorithmResult: AlgorithmResult | null;
  mode: 'select' | 'add_node' | 'add_link' | 'set_start' | 'set_end';
  setMode: (mode: 'select' | 'add_node' | 'add_link' | 'set_start' | 'set_end') => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedLink: { source: string; target: string } | null;
  setSelectedLink: (link: { source: string; target: string } | null) => void;
  nodeTypeToAdd: Node['type'];
  startNodeId: string | null;
  endNodeId: string | null;
  setStartNodeId: (id: string | null) => void;
  setEndNodeId: (id: string | null) => void;
}

interface WeightModalState {
  isOpen: boolean;
  type: 'add' | 'edit';
  sourceId: string;
  targetId: string;
  currentWeight: number;
  linkRef?: Link; // For editing
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ 
  graph, setGraph, algorithmResult, mode, setMode, 
  selectedNodeId, setSelectedNodeId, selectedLink, setSelectedLink,
  nodeTypeToAdd, startNodeId, endNodeId, setStartNodeId, setEndNodeId
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [tempLinkSource, setTempLinkSource] = useState<string | null>(null);
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);

  // Custom Modal State
  const [weightModal, setWeightModal] = useState<WeightModalState | null>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (weightModal && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [weightModal]);

  // --- HELPER: Coordinate Maths ---
  const getMousePos = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const getNodeLabel = (id: string) => graph.nodes.find(n => n.id === id)?.label || id;

  const getLinkColor = (l: Link) => {
    const s = l.source;
    const t = l.target;

    // Check if selected
    const isSelected = selectedLink && (
      (l.source === selectedLink.source && l.target === selectedLink.target) || 
      (!graph.isDirected && l.source === selectedLink.target && l.target === selectedLink.source)
    );
    if (isSelected) return '#ef4444'; // Red for selected

    // 1. MST Links
    if (algorithmResult?.mstLinks?.some(mstL => 
      (mstL.source === s && mstL.target === t) || 
      (!graph.isDirected && mstL.source === t && mstL.target === s)
    )) return '#ef4444'; 

    // 2. Traversed Edges (BFS/DFS)
    if (algorithmResult?.traversedEdges?.some(trL => 
      (trL.source === s && trL.target === t) || 
      (!graph.isDirected && trL.source === t && trL.target === s)
    )) return '#f59e0b'; // Amber

    // 3. Path
    if (algorithmResult?.path) {
       const path = algorithmResult.path;
       for(let i=0; i<path.length-1; i++) {
          if ((s === path[i] && t === path[i+1]) ||
              (!graph.isDirected && s === path[i+1] && t === path[i])) {
                return '#3b82f6'; // Blue
              }
       }
    }

    // 4. Flow
    if (algorithmResult?.flowDetails) {
      const flow = algorithmResult.flowDetails[`${s}->${t}`];
      if (flow && flow > 0) return '#10b981'; // Green
    }

    return '#52525b'; // Zinc-600
  };

  const getLinkWidth = (l: Link) => {
     if (algorithmResult?.flowDetails) {
       const flow = algorithmResult.flowDetails[`${l.source}->${l.target}`];
       if (flow && flow > 0) return 4;
     }
     return 2;
  };

  // --- HANDLERS ---

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking directly on the SVG background
    if (e.target === svgRef.current) {
      if (mode === 'add_node') {
        const { x, y } = getMousePos(e);
        const newId = `n${Date.now()}`;
        const newNode: Node = {
          id: newId,
          x,
          y,
          label: `${nodeTypeToAdd} ${graph.nodes.length + 1}`,
          type: nodeTypeToAdd || 'pc'
        };
        setGraph({ ...graph, nodes: [...graph.nodes, newNode] });
      } else {
        setSelectedNodeId(null);
        setSelectedLink(null);
        setTempLinkSource(null);
      }
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation(); 
    if (mode === 'select') {
      setDraggingNodeId(nodeId);
      setSelectedLink(null); // Deselect link when selecting node
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && mode === 'select') {
      const { x, y } = getMousePos(e);
      setGraph({
        ...graph,
        nodes: graph.nodes.map(n => n.id === draggingNodeId ? { ...n, x, y } : n)
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleNodeClick = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    
    if (mode === 'select') {
      setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
      setSelectedLink(null);
    } else if (mode === 'add_link') {
      if (!tempLinkSource) {
        setTempLinkSource(node.id);
      } else {
        if (tempLinkSource !== node.id) {
          // Check duplicate
          const exists = graph.links.some(l => 
            (l.source === tempLinkSource && l.target === node.id) ||
            (!graph.isDirected && l.source === node.id && l.target === tempLinkSource)
          );
          if (!exists) {
            // OPEN CUSTOM MODAL INSTEAD OF PROMPT
            setWeightModal({
              isOpen: true,
              type: 'add',
              sourceId: tempLinkSource,
              targetId: node.id,
              currentWeight: 1
            });
          }
        }
        setTempLinkSource(null);
      }
    } else if (mode === 'set_start') {
      setStartNodeId(node.id);
      setMode('select');
    } else if (mode === 'set_end') {
      setEndNodeId(node.id);
      setMode('select');
    }
  };

  const openEditWeightModal = (l: Link) => {
    setWeightModal({
      isOpen: true,
      type: 'edit',
      sourceId: l.source,
      targetId: l.target,
      currentWeight: l.weight,
      linkRef: l
    });
  };

  const handleWeightSubmit = () => {
    if (!weightModal || !weightInputRef.current) return;
    
    const val = Number(weightInputRef.current.value);
    const validWeight = isNaN(val) ? 1 : val;

    if (weightModal.type === 'add') {
      const newLink: Link = { 
        source: weightModal.sourceId, 
        target: weightModal.targetId, 
        weight: validWeight, 
        capacity: validWeight 
      };
      setGraph({ ...graph, links: [...graph.links, newLink] });
    } else if (weightModal.type === 'edit') {
       const newLinks = graph.links.map(link => {
          // Match logic
          if (
            (link.source === weightModal.sourceId && link.target === weightModal.targetId) || 
            (!graph.isDirected && link.source === weightModal.targetId && link.target === weightModal.sourceId)
          ) {
            return { ...link, weight: validWeight, capacity: validWeight };
          }
          return link;
        });
        setGraph({ ...graph, links: newLinks });
    }

    setWeightModal(null);
  };

  // SINGLE CLICK: Select
  const handleLinkClick = (e: React.MouseEvent, l: Link) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLink({ source: l.source, target: l.target });
    setSelectedNodeId(null);
  };

  // DOUBLE CLICK: Edit
  const handleLinkDoubleClick = (e: React.MouseEvent, l: Link) => {
    e.preventDefault();
    e.stopPropagation();
    openEditWeightModal(l);
  }

  const handleLinkContextMenu = (e: React.MouseEvent, l: Link) => {
    e.preventDefault();
    e.stopPropagation();
    openEditWeightModal(l);
  }

  // --- RENDER PREPARATION ---

  // Prepare links with coordinates
  const linksToRender = useMemo(() => {
    return graph.links.map(l => {
      const sourceNode = graph.nodes.find(n => n.id === l.source);
      const targetNode = graph.nodes.find(n => n.id === l.target);
      if (!sourceNode || !targetNode) return null;
      return {
        ...l,
        x1: sourceNode.x,
        y1: sourceNode.y,
        x2: targetNode.x,
        y2: targetNode.y,
        centerX: (sourceNode.x + targetNode.x) / 2,
        centerY: (sourceNode.y + targetNode.y) / 2
      };
    }).filter(l => l !== null) as (Link & { x1: number, y1: number, x2: number, y2: number, centerX: number, centerY: number })[];
  }, [graph]);

  return (
    <div className="w-full h-full relative bg-zinc-900 rounded-lg overflow-hidden shadow-inner border border-zinc-800">
      <svg 
        ref={svgRef} 
        className="w-full h-full cursor-crosshair select-none"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
      >
        <defs>
          <marker
            id="arrowhead"
            viewBox="-0 -5 10 10"
            refX={DEFAULT_NODE_RADIUS + 10}
            refY={0}
            orient="auto"
            markerWidth={6}
            markerHeight={6}
          >
            <path d="M 0,-5 L 10 ,0 L 0,5" fill="#9ca3af" style={{ stroke: 'none' }} />
          </marker>
        </defs>

        {/* LAYER 1: LINES & HIT AREAS (Bottom) */}
        {linksToRender.map((link, i) => {
          const color = getLinkColor(link);
          const width = getLinkWidth(link);
          const isHovered = hoveredLinkIndex === i;
          
          // Check selection for styling (dashed or glow)
          const isSelected = selectedLink && (
             (link.source === selectedLink.source && link.target === selectedLink.target) || 
             (!graph.isDirected && link.source === selectedLink.target && link.target === selectedLink.source)
          );

          return (
            <g 
              key={`link-${link.source}-${link.target}-${i}`} 
              onMouseEnter={() => setHoveredLinkIndex(i)}
              onMouseLeave={() => setHoveredLinkIndex(null)}
              onClick={(e) => handleLinkClick(e, link)}
              onDoubleClick={(e) => handleLinkDoubleClick(e, link)}
              onContextMenu={(e) => handleLinkContextMenu(e, link)}
            >
              {/* Visual Line */}
              <line
                x1={link.x1} y1={link.y1}
                x2={link.x2} y2={link.y2}
                stroke={isSelected ? '#ef4444' : (isHovered ? '#60a5fa' : color)}
                strokeWidth={isHovered || isSelected ? width + 2 : width}
                strokeDasharray={isSelected ? "5,5" : undefined}
                markerEnd={graph.isDirected ? 'url(#arrowhead)' : undefined}
                className="transition-all duration-200"
              />
              
              {/* Invisible Hit Area (Thick) */}
              <line
                x1={link.x1} y1={link.y1}
                x2={link.x2} y2={link.y2}
                stroke="rgba(0,0,0,0.001)"
                strokeWidth={25}
                style={{ cursor: 'pointer' }}
              />
            </g>
          );
        })}

        {/* LAYER 2: NODES (Middle) */}
        {graph.nodes.map(node => {
          let fillColor = '#27272a'; // Zinc 800
          if (node.id === startNodeId) fillColor = '#22c55e';
          else if (node.id === endNodeId) fillColor = '#ef4444';
          else if (node.id === selectedNodeId) fillColor = '#fbbf24';
          else if (tempLinkSource === node.id) fillColor = '#f472b6';
          else if (algorithmResult?.visited?.includes(node.id)) fillColor = '#3b82f6';
          else if (algorithmResult?.bipartiteSets?.setA.includes(node.id)) fillColor = '#f87171';
          else if (algorithmResult?.bipartiteSets?.setB.includes(node.id)) fillColor = '#34d399';

          const isStartOrEnd = node.id === startNodeId || node.id === endNodeId;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onClick={(e) => handleNodeClick(e, node)}
              className="cursor-move transition-transform duration-75"
              style={{ pointerEvents: 'all' }}
            >
              <circle
                r={DEFAULT_NODE_RADIUS}
                fill={fillColor}
                stroke={isStartOrEnd ? '#fff' : '#52525b'}
                strokeWidth={isStartOrEnd ? 3 : 2}
              />
              <text
                dy={-25}
                textAnchor="middle"
                fill="white"
                fontSize="12"
                fontWeight="bold"
                style={{ textShadow: '0px 1px 2px #000', pointerEvents: 'none' }}
              >
                {node.label}
              </text>
              <text
                dy={5}
                textAnchor="middle"
                fill="rgba(255,255,255,0.8)"
                fontSize="10"
                style={{ pointerEvents: 'none' }}
              >
                {node.id === startNodeId ? 'START' : node.id === endNodeId ? 'END' : node.type.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* LAYER 3: WEIGHT BADGES (Top - Always Clickable) */}
        {linksToRender.map((link, i) => {
          const isHovered = hoveredLinkIndex === i;
          const isSelected = selectedLink && (
             (link.source === selectedLink.source && link.target === selectedLink.target) || 
             (!graph.isDirected && link.source === selectedLink.target && link.target === selectedLink.source)
          );

          const displayText = algorithmResult?.flowDetails && algorithmResult.flowDetails[`${link.source}->${link.target}`] !== undefined 
                  ? `${algorithmResult.flowDetails[`${link.source}->${link.target}`]}/${link.capacity || link.weight}`
                  : link.weight.toString();
          
          const textWidth = displayText.length * 8 + 10; 

          return (
            <g 
              key={`badge-${link.source}-${link.target}-${i}`}
              onMouseEnter={() => setHoveredLinkIndex(i)}
              onMouseLeave={() => setHoveredLinkIndex(null)}
              onClick={(e) => handleLinkClick(e, link)}
              onDoubleClick={(e) => handleLinkDoubleClick(e, link)}
              onContextMenu={(e) => handleLinkContextMenu(e, link)}
              className="cursor-pointer hover:scale-110 transition-transform origin-center"
              style={{ pointerEvents: 'all' }}
            >
              {/* Badge Background */}
              <rect 
                x={link.centerX - textWidth / 2}
                y={link.centerY - 10}
                width={textWidth}
                height={20}
                rx={4}
                fill={isSelected ? '#ef4444' : (isHovered ? '#3b82f6' : '#27272a')}
                stroke={isHovered ? '#60a5fa' : '#52525b'}
                strokeWidth={1}
                style={{ pointerEvents: 'all' }}
              />
              
              {/* Weight Label */}
              <text
                x={link.centerX}
                y={link.centerY + 4}
                textAnchor="middle"
                fill={isHovered || isSelected ? '#ffffff' : '#e4e4e7'}
                fontSize="12"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }} 
              >
                {displayText}
              </text>
            </g>
          );
        })}
      </svg>

      {/* CUSTOM WEIGHT MODAL OVERLAY */}
      {weightModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg shadow-2xl w-64 flex flex-col gap-3 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
               <h3 className="text-sm font-bold text-white">
                 {weightModal.type === 'add' ? 'Thêm Cạnh Mới' : 'Sửa Trọng Số'}
               </h3>
               <button onClick={() => setWeightModal(null)} className="text-zinc-500 hover:text-white">
                 <X className="w-4 h-4" />
               </button>
             </div>
             
             <div className="text-xs text-zinc-400">
               {getNodeLabel(weightModal.sourceId)} ➝ {getNodeLabel(weightModal.targetId)}
             </div>

             <div className="flex flex-col gap-1">
               <label className="text-xs font-medium text-zinc-300">Trọng số (Weight):</label>
               <input 
                 ref={weightInputRef}
                 type="number" 
                 defaultValue={weightModal.currentWeight}
                 className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                 onKeyDown={(e) => { if (e.key === 'Enter') handleWeightSubmit(); else if(e.key === 'Escape') setWeightModal(null); }}
               />
             </div>

             <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setWeightModal(null)}
                  className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleWeightSubmit}
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" /> OK
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur text-xs p-2 rounded text-zinc-300 border border-zinc-700 shadow-xl">
           <div className="font-bold text-zinc-100 mb-1">Trạng thái: {mode.toUpperCase().replace('_', ' ')}</div>
           {mode === 'select' && <div>• Click nút để chọn, Kéo để di chuyển<br/>• Click cạnh/số để <span className="text-red-400 font-bold">chọn/xóa</span><br/>• Double-click số để <span className="text-blue-400 font-bold">sửa trọng số</span></div>}
           {mode === 'add_node' && <div>• Click bảng trắng để thêm nút</div>}
           {mode === 'add_link' && <div>• Chọn nút nguồn -&gt; Chọn nút đích</div>}
           {mode === 'set_start' && <div className="text-green-400 font-bold">• Click chọn nút BẮT ĐẦU</div>}
           {mode === 'set_end' && <div className="text-red-400 font-bold">• Click chọn nút KẾT THÚC</div>}
           {tempLinkSource && <span className="text-pink-400 block mt-1">Đang chọn đích...</span>}
        </div>
      </div>
    </div>
  );
};
