
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { GraphData, Node, Link, AlgorithmResult } from '../types';
import { DEFAULT_NODE_RADIUS, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import { Check, X, Router, Server, Monitor, Network, Trash2, Settings } from 'lucide-react';

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
  edgeLabelMode: 'weight' | 'capacity';
}

interface WeightModalState {
  isOpen: boolean;
  type: 'add' | 'edit';
  sourceId: string;
  targetId: string;
  currentWeight: number;
  currentCapacity: number;
  linkRef?: Link;
}

interface NodeModalState {
  isOpen: boolean;
  nodeId: string;
  currentLabel: string;
  currentType: Node['type'];
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ 
  graph, setGraph, algorithmResult, mode, setMode, 
  selectedNodeId, setSelectedNodeId, selectedLink, setSelectedLink,
  nodeTypeToAdd, startNodeId, endNodeId, setStartNodeId, setEndNodeId,
  edgeLabelMode
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [tempLinkSource, setTempLinkSource] = useState<string | null>(null);
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  
  // Modals
  const [weightModal, setWeightModal] = useState<WeightModalState | null>(null);
  const [nodeModal, setNodeModal] = useState<NodeModalState | null>(null);
  
  // Refs
  const weightInputRef = useRef<HTMLInputElement>(null);
  const capacityInputRef = useRef<HTMLInputElement>(null);
  const nodeLabelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (weightModal && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [weightModal]);

  useEffect(() => {
    if (nodeModal && nodeLabelInputRef.current) {
      nodeLabelInputRef.current.focus();
      nodeLabelInputRef.current.select();
    }
  }, [nodeModal]);

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

  const getLinkStyle = (l: Link) => {
    const s = l.source;
    const t = l.target;
    const matches = (u: string, v: string) => 
      (s === u && t === v) || (!graph.isDirected && s === v && t === u);

    if (selectedLink && matches(selectedLink.source, selectedLink.target)) {
      return { color: '#ef4444', width: 3, markerId: 'arrow-red' };
    }

    if (algorithmResult?.steps && algorithmResult.steps.length > 0) {
       const currentStep = algorithmResult.steps[0];
       if (currentStep.currentLinkId && matches(currentStep.currentLinkId.source, currentStep.currentLinkId.target)) {
         return { color: '#fbbf24', width: 5, markerId: 'arrow-amber' };
       }
    }

    if (algorithmResult?.path) {
      const path = algorithmResult.path;
      const isEuler = algorithmResult.logs.some(log => log.includes('Euler') || log.includes('Fleury') || log.includes('Hierholzer'));
      for(let i=0; i<path.length-1; i++) {
        if (matches(path[i], path[i+1])) {
           return isEuler 
             ? { color: '#a855f7', width: 4, markerId: 'arrow-purple' } 
             : { color: '#3b82f6', width: 4, markerId: 'arrow-blue' };
        }
      }
    }

    if (algorithmResult?.mstLinks?.some(mstL => matches(mstL.source, mstL.target))) {
      return { color: '#10b981', width: 4, markerId: 'arrow-green' };
    }

    if (algorithmResult?.flowDetails) {
       const flowForward = algorithmResult.flowDetails[`${s}->${t}`] || 0;
       const flowBackward = algorithmResult.flowDetails[`${t}->${s}`] || 0;
       
       if (flowForward > 0) {
         return { color: '#06b6d4', width: 4, markerId: 'arrow-cyan', reverseArrow: false };
       } else if (flowBackward > 0) {
         return { color: '#06b6d4', width: 4, markerId: 'arrow-cyan-reverse', reverseArrow: true };
       }
    }

    if (algorithmResult?.traversedEdges?.some(trL => matches(trL.source, trL.target))) {
      return { color: '#f59e0b', width: 2, markerId: 'arrow-orange' };
    }

    return { color: '#52525b', width: 2, markerId: 'arrow-gray' };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      if (mode === 'add_node') {
        const { x, y } = getMousePos(e);
        const newId = `n${Date.now()}`;
        const newNode: Node = {
          id: newId, x, y,
          label: `${nodeTypeToAdd} ${graph.nodes.length + 1}`,
          type: nodeTypeToAdd || 'pc'
        };
        const minDist = DEFAULT_NODE_RADIUS * 2 + 10;
        let safeX = x;
        let safeY = y;
        graph.nodes.forEach(n => {
           const dx = safeX - n.x;
           const dy = safeY - n.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           if (dist < minDist) {
              safeX += 20;
              safeY += 20;
           }
        });
        
        setGraph({ ...graph, nodes: [...graph.nodes, {...newNode, x: safeX, y: safeY}] });
      } else {
        setSelectedNodeId(null); setSelectedLink(null); setTempLinkSource(null);
      }
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation(); 
    if (mode === 'select') { setDraggingNodeId(nodeId); setSelectedLink(null); }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && mode === 'select') {
      const { x, y } = getMousePos(e);
      const newNodes = graph.nodes.map(n => ({ ...n }));
      const draggedNode = newNodes.find(n => n.id === draggingNodeId);

      if (draggedNode) {
        draggedNode.x = x;
        draggedNode.y = y;

        const padding = 15;
        const minDistance = (DEFAULT_NODE_RADIUS * 2) + padding;
        const iterations = 3; 
        for (let k = 0; k < iterations; k++) {
          for (let i = 0; i < newNodes.length; i++) {
            for (let j = i + 1; j < newNodes.length; j++) {
              const n1 = newNodes[i];
              const n2 = newNodes[j];
              const dx = n2.x - n1.x;
              const dy = n2.y - n1.y;
              let dist = Math.sqrt(dx * dx + dy * dy);

              if (dist === 0) { dist = 0.01; n2.x += 1; }
              if (dist < minDistance) {
                const overlap = minDistance - dist;
                const ux = dx / dist; 
                const uy = dy / dist; 
                if (n1.id === draggingNodeId) { n2.x += ux * overlap; n2.y += uy * overlap; }
                else if (n2.id === draggingNodeId) { n1.x -= ux * overlap; n1.y -= uy * overlap; }
                else { const half = overlap / 2; n1.x -= ux * half; n1.y -= uy * half; n2.x += ux * half; n2.y += uy * half; }
              }
            }
          }
        }
        newNodes.forEach(n => {
           n.x = Math.max(DEFAULT_NODE_RADIUS + 5, Math.min(CANVAS_WIDTH - DEFAULT_NODE_RADIUS - 5, n.x));
           n.y = Math.max(DEFAULT_NODE_RADIUS + 5, Math.min(CANVAS_HEIGHT - DEFAULT_NODE_RADIUS - 5, n.y));
        });
      }
      setGraph({ ...graph, nodes: newNodes });
    }
  };

  const handleCanvasMouseUp = () => setDraggingNodeId(null);

  const handleNodeClick = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    if (mode === 'select') { setSelectedNodeId(selectedNodeId === node.id ? null : node.id); setSelectedLink(null); }
    else if (mode === 'add_link') {
      if (!tempLinkSource) setTempLinkSource(node.id);
      else {
        if (tempLinkSource !== node.id) {
          const exists = graph.links.some(l => (l.source === tempLinkSource && l.target === node.id) || (!graph.isDirected && l.source === node.id && l.target === tempLinkSource));
          if (!exists) {
            setWeightModal({ isOpen: true, type: 'add', sourceId: tempLinkSource, targetId: node.id, currentWeight: 10, currentCapacity: 100 });
          }
        }
        setTempLinkSource(null);
      }
    } else if (mode === 'set_start') { setStartNodeId(node.id); setMode('select'); }
    else if (mode === 'set_end') { setEndNodeId(node.id); setMode('select'); }
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    e.preventDefault();
    setNodeModal({
      isOpen: true,
      nodeId: node.id,
      currentLabel: node.label,
      currentType: node.type
    });
  };

  const handleNodeSubmit = () => {
    if (!nodeModal || !nodeLabelInputRef.current) return;
    const newLabel = nodeLabelInputRef.current.value.trim() || nodeModal.nodeId;
    
    // Update graph
    const newNodes = graph.nodes.map(n => 
      n.id === nodeModal.nodeId 
        ? { ...n, label: newLabel, type: nodeModal.currentType } 
        : n
    );
    setGraph({ ...graph, nodes: newNodes });
    setNodeModal(null);
  };

  const handleDeleteNodeFromModal = () => {
    if (!nodeModal) return;
    const id = nodeModal.nodeId;
    const newNodes = graph.nodes.filter(n => n.id !== id);
    const newLinks = graph.links.filter(l => l.source !== id && l.target !== id);
    setGraph({ ...graph, nodes: newNodes, links: newLinks });
    
    if (startNodeId === id) setStartNodeId(null);
    if (endNodeId === id) setEndNodeId(null);
    if (selectedNodeId === id) setSelectedNodeId(null);
    
    setNodeModal(null);
  };

  const openEditWeightModal = (l: Link) => {
    setWeightModal({ 
      isOpen: true, 
      type: 'edit', 
      sourceId: l.source, 
      targetId: l.target, 
      currentWeight: l.weight, 
      currentCapacity: l.capacity || 100, 
      linkRef: l 
    });
  };

  const handleWeightSubmit = () => {
    if (!weightModal || !weightInputRef.current || !capacityInputRef.current) return;
    
    const wVal = Number(weightInputRef.current.value);
    const cVal = Number(capacityInputRef.current.value);
    
    const weight = isNaN(wVal) ? 1 : wVal;
    const capacity = isNaN(cVal) ? 100 : cVal;

    if (weightModal.type === 'add') {
      const newLink: Link = { source: weightModal.sourceId, target: weightModal.targetId, weight, capacity };
      setGraph({ ...graph, links: [...graph.links, newLink] });
    } else if (weightModal.type === 'edit') {
       const newLinks = graph.links.map(link => {
          if ((link.source === weightModal.sourceId && link.target === weightModal.targetId) || (!graph.isDirected && link.source === weightModal.targetId && link.target === weightModal.sourceId)) {
            return { ...link, weight, capacity };
          }
          return link;
        });
        setGraph({ ...graph, links: newLinks });
    }
    setWeightModal(null);
  };

  const handleLinkClick = (e: React.MouseEvent, l: Link) => {
    e.preventDefault(); e.stopPropagation(); setSelectedLink({ source: l.source, target: l.target }); setSelectedNodeId(null);
  };
  const handleLinkDoubleClick = (e: React.MouseEvent, l: Link) => {
    e.preventDefault(); e.stopPropagation(); openEditWeightModal(l);
  }
  const handleLinkContextMenu = (e: React.MouseEvent, l: Link) => {
    e.preventDefault(); e.stopPropagation(); openEditWeightModal(l);
  }

  const linksToRender = useMemo(() => {
    return graph.links.map(l => {
      const sourceNode = graph.nodes.find(n => n.id === l.source);
      const targetNode = graph.nodes.find(n => n.id === l.target);
      if (!sourceNode || !targetNode) return null;
      return { ...l, x1: sourceNode.x, y1: sourceNode.y, x2: targetNode.x, y2: targetNode.y, centerX: (sourceNode.x + targetNode.x) / 2, centerY: (sourceNode.y + targetNode.y) / 2 };
    }).filter(l => l !== null) as (Link & { x1: number, y1: number, x2: number, y2: number, centerX: number, centerY: number })[];
  }, [graph]);

  const markers = [
    { id: 'arrow-gray', color: '#52525b' },
    { id: 'arrow-red', color: '#ef4444' },
    { id: 'arrow-amber', color: '#fbbf24' },
    { id: 'arrow-blue', color: '#3b82f6' },
    { id: 'arrow-purple', color: '#a855f7' },
    { id: 'arrow-green', color: '#10b981' },
    { id: 'arrow-cyan', color: '#06b6d4' },
    { id: 'arrow-orange', color: '#f59e0b' },
    { id: 'arrow-hover', color: '#60a5fa' },
    { id: 'arrow-cyan-reverse', color: '#06b6d4', reverse: true }
  ];

  return (
    <div className="w-full h-full relative bg-zinc-900 rounded-lg overflow-hidden shadow-inner border border-zinc-800">
      <svg ref={svgRef} className="w-full h-full cursor-crosshair select-none" onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onClick={handleCanvasClick}>
        <defs>
          {markers.map(m => (
            <marker 
              key={m.id} 
              id={m.id} 
              viewBox="0 -5 10 10" 
              refX={m.reverse ? -(DEFAULT_NODE_RADIUS + 10) : DEFAULT_NODE_RADIUS + 10} 
              refY={0} 
              orient="auto" 
              markerWidth={6} 
              markerHeight={6}
            >
              <path d={m.reverse ? "M 10,-5 L 0,0 L 10,5" : "M 0,-5 L 10 ,0 L 0,5"} fill={m.color} style={{ stroke: 'none' }} />
            </marker>
          ))}
        </defs>

        {linksToRender.map((link, i) => {
          const isHovered = hoveredLinkIndex === i;
          const { color, width, markerId, reverseArrow } = getLinkStyle(link);
          const finalColor = isHovered ? '#60a5fa' : color;
          const finalWidth = isHovered ? width + 2 : width;
          
          let markerEnd = undefined;
          let markerStart = undefined;

          if (graph.isDirected || color === '#06b6d4') {
             if (reverseArrow) {
               markerStart = `url(#${isHovered ? 'arrow-hover' : markerId})`;
             } else {
               markerEnd = `url(#${isHovered ? 'arrow-hover' : markerId})`;
             }
          }
          
          const isSelected = selectedLink && ((link.source === selectedLink.source && link.target === selectedLink.target) || (!graph.isDirected && link.source === selectedLink.target && link.target === selectedLink.source));

          return (
            <g key={`link-${link.source}-${link.target}-${i}`} onMouseEnter={() => setHoveredLinkIndex(i)} onMouseLeave={() => setHoveredLinkIndex(null)} onClick={(e) => handleLinkClick(e, link)} onDoubleClick={(e) => handleLinkDoubleClick(e, link)} onContextMenu={(e) => handleLinkContextMenu(e, link)}>
              <line x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke={finalColor} strokeWidth={finalWidth} strokeDasharray={isSelected ? "5,5" : undefined} markerEnd={markerEnd} markerStart={markerStart} className="transition-all duration-200" />
              <line x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke="rgba(0,0,0,0.001)" strokeWidth={25} style={{ cursor: 'pointer' }} />
            </g>
          );
        })}

        {graph.nodes.map(node => {
          let fillColor = '#27272a';
          let strokeColor = '#52525b';
          let strokeWidth = 2;
          const isCurrentProcessing = algorithmResult?.steps?.[0]?.currentNodeId === node.id;
          if (node.id === startNodeId) { fillColor = '#22c55e'; strokeColor = '#fff'; strokeWidth = 3; }
          else if (node.id === endNodeId) { fillColor = '#ef4444'; strokeColor = '#fff'; strokeWidth = 3; }
          else if (node.id === selectedNodeId) { fillColor = '#fbbf24'; }
          else if (tempLinkSource === node.id) { fillColor = '#f472b6'; }
          else if (isCurrentProcessing) { fillColor = '#eab308'; strokeColor = '#fff'; strokeWidth = 4; } 
          else if (algorithmResult?.visited?.includes(node.id)) { fillColor = '#3b82f6'; }
          else if (algorithmResult?.bipartiteSets?.setA.includes(node.id)) { fillColor = '#f87171'; }
          else if (algorithmResult?.bipartiteSets?.setB.includes(node.id)) { fillColor = '#34d399'; }

          const IconComponent = node.type === 'router' ? Router : node.type === 'switch' ? Network : node.type === 'server' ? Server : Monitor;

          return (
            <g 
              key={node.id} 
              transform={`translate(${node.x},${node.y})`} 
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)} 
              onClick={(e) => handleNodeClick(e, node)} 
              onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
              className="cursor-move transition-transform duration-75" 
              style={{ pointerEvents: 'all' }}
            >
              {isCurrentProcessing && (
                <circle r={DEFAULT_NODE_RADIUS + 8} fill="none" stroke="#eab308" strokeWidth={2} strokeOpacity={0.5} className="animate-ping" />
              )}
              <circle r={DEFAULT_NODE_RADIUS} fill="#18181b" stroke={strokeColor} strokeWidth={strokeWidth} />
              <foreignObject x={-12} y={-12} width={24} height={24} style={{ pointerEvents: 'none' }}>
                <div className="flex items-center justify-center w-full h-full">
                  <IconComponent className="w-full h-full" color={fillColor === '#27272a' ? '#a1a1aa' : fillColor} strokeWidth={2} />
                </div>
              </foreignObject>
              <text dy={-28} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" style={{ textShadow: '0px 1px 2px #000', pointerEvents: 'none' }}>{node.label}</text>
              <text dy={DEFAULT_NODE_RADIUS + 12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" style={{ pointerEvents: 'none' }}>{node.id === startNodeId ? 'NGUỒN' : node.id === endNodeId ? 'ĐÍCH' : ''}</text>
            </g>
          );
        })}

        {linksToRender.map((link, i) => {
          const isHovered = hoveredLinkIndex === i;
          const { color } = getLinkStyle(link);
          const isSelected = selectedLink && ((link.source === selectedLink.source && link.target === selectedLink.target) || (!graph.isDirected && link.source === selectedLink.target && link.target === selectedLink.source));
          
          let displayText = "";
          if (algorithmResult?.flowDetails) {
            const flowForward = algorithmResult.flowDetails[`${link.source}->${link.target}`] || 0;
            const flowBackward = algorithmResult.flowDetails[`${link.target}->${link.source}`] || 0;
            const activeFlow = Math.max(flowForward, flowBackward);
            displayText = `${activeFlow}/${link.capacity || 100}`;
          } else {
            if (edgeLabelMode === 'capacity') {
               displayText = `${link.capacity || 100}M`; 
            } else {
               displayText = link.weight.toString();
            }
          }

          const textWidth = displayText.length * 8 + 10; 
          const badgeColor = isSelected ? '#ef4444' : (isHovered ? '#60a5fa' : color);
          const badgeBg = isSelected ? '#ef4444' : (isHovered ? '#3b82f6' : (color === '#52525b' ? '#27272a' : color));

          return (
            <g key={`badge-${link.source}-${link.target}-${i}`} onMouseEnter={() => setHoveredLinkIndex(i)} onMouseLeave={() => setHoveredLinkIndex(null)} onClick={(e) => handleLinkClick(e, link)} onDoubleClick={(e) => handleLinkDoubleClick(e, link)} onContextMenu={(e) => handleLinkContextMenu(e, link)} className="cursor-pointer hover:scale-110 transition-transform origin-center" style={{ pointerEvents: 'all' }}>
              <rect x={link.centerX - textWidth / 2} y={link.centerY - 10} width={textWidth} height={20} rx={4} fill={badgeBg} stroke={badgeColor} strokeWidth={1} style={{ pointerEvents: 'all' }} />
              <text x={link.centerX} y={link.centerY + 4} textAnchor="middle" fill={'#ffffff'} fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>{displayText}</text>
            </g>
          );
        })}
      </svg>
      
      {/* Dynamic Legend */}
      {algorithmResult && (
        <div className="absolute bottom-6 left-6 pointer-events-none animate-in slide-in-from-bottom-2">
          <div className="bg-black/70 backdrop-blur text-xs p-2 rounded text-zinc-300 border border-zinc-700 shadow-xl flex flex-col gap-1.5">
             <div className="font-bold text-zinc-100 border-b border-zinc-600 pb-1 mb-1">Chú thích (Legend)</div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-white bg-[#22c55e]"></div>
                <span>Nguồn (Start)</span>
             </div>
             {endNodeId && (
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-white bg-[#ef4444]"></div>
                  <span>Đích (End)</span>
               </div>
             )}
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#eab308] animate-pulse"></div>
                <span>Đang xét (Scanning)</span>
             </div>
             {algorithmResult.path && (
               <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-[#3b82f6]"></div>
                  <span>Đường đi (Path)</span>
               </div>
             )}
             {algorithmResult.mstLinks && (
               <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-[#10b981]"></div>
                  <span>Cây khung (MST)</span>
               </div>
             )}
             {algorithmResult.flowDetails && (
               <div className="flex items-center gap-2">
                  <div className="w-8 h-1 bg-[#06b6d4]"></div>
                  <span>Luồng (Flow)</span>
               </div>
             )}
             {algorithmResult.bipartiteSets && (
               <>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f87171]"></div>
                    <span>Zone A (Red)</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#34d399]"></div>
                    <span>Zone B (Green)</span>
                 </div>
               </>
             )}
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {weightModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg shadow-2xl w-80 flex flex-col gap-3 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
               <h3 className="text-sm font-bold text-white">{weightModal.type === 'add' ? 'Thêm Liên Kết Mới' : 'Cấu Hình Liên Kết'}</h3>
               <button onClick={() => setWeightModal(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
             </div>
             <div className="text-xs text-zinc-400 font-mono text-center bg-zinc-950 p-1 rounded">{getNodeLabel(weightModal.sourceId)} ➝ {getNodeLabel(weightModal.targetId)}</div>
             
             <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-300">1. Trọng số (Weight/Metric):</label>
                  <input ref={weightInputRef} type="number" defaultValue={weightModal.currentWeight} className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 font-mono" onKeyDown={(e) => { if (e.key === 'Enter') handleWeightSubmit(); else if(e.key === 'Escape') setWeightModal(null); }} />
                  <p className="text-[10px] text-zinc-500 italic">Dùng cho: OSPF, RIP, Prim, Kruskal (Chi phí, Độ trễ).</p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-300">2. Dung lượng (Capacity/Bandwidth):</label>
                  <input ref={capacityInputRef} type="number" defaultValue={weightModal.currentCapacity} className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 font-mono" onKeyDown={(e) => { if (e.key === 'Enter') handleWeightSubmit(); else if(e.key === 'Escape') setWeightModal(null); }} />
                  <p className="text-[10px] text-zinc-500 italic">Dùng cho: Max Flow (Băng thông Mbps).</p>
                </div>
             </div>

             <div className="flex gap-2 mt-2">
                <button onClick={() => setWeightModal(null)} className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300">Hủy</button>
                <button onClick={handleWeightSubmit} className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> OK</button>
             </div>
          </div>
        </div>
      )}

      {/* Node Edit Modal */}
      {nodeModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg shadow-2xl w-80 flex flex-col gap-3 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
               <h3 className="text-sm font-bold text-white flex items-center gap-2"><Settings className="w-4 h-4" /> Chỉnh sửa Nút</h3>
               <button onClick={() => setNodeModal(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
             </div>
             
             <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-300">Tên thiết bị (Label):</label>
                  <input 
                    ref={nodeLabelInputRef} 
                    type="text" 
                    defaultValue={nodeModal.currentLabel} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-blue-500 text-sm" 
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNodeSubmit(); else if(e.key === 'Escape') setNodeModal(null); }} 
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-300">Loại thiết bị (Type):</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['router', 'switch', 'pc', 'server'].map(type => (
                      <button
                        key={type}
                        onClick={() => setNodeModal({...nodeModal, currentType: type as Node['type']})}
                        className={`flex items-center gap-2 p-2 rounded text-xs capitalize border ${nodeModal.currentType === type ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600'}`}
                      >
                        {type === 'router' && <Router className="w-3 h-3" />}
                        {type === 'switch' && <Network className="w-3 h-3" />}
                        {type === 'pc' && <Monitor className="w-3 h-3" />}
                        {type === 'server' && <Server className="w-3 h-3" />}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
             </div>

             <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-800">
                <button onClick={handleDeleteNodeFromModal} className="px-3 py-1.5 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 text-xs flex items-center justify-center gap-1" title="Xóa nút này">
                  <Trash2 className="w-3 h-3" />
                </button>
                <button onClick={() => setNodeModal(null)} className="flex-1 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300">Hủy</button>
                <button onClick={handleNodeSubmit} className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Lưu</button>
             </div>
          </div>
        </div>
      )}
      
      {/* Tips / Status Overlay */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-black/60 backdrop-blur text-xs p-2 rounded text-zinc-300 border border-zinc-700 shadow-xl">
           <div className="font-bold text-zinc-100 mb-1">Trạng thái: {mode === 'select' ? 'CHỌN (SELECT)' : mode === 'add_node' ? 'THÊM NÚT' : mode === 'add_link' ? 'NỐI DÂY' : 'CHỌN ĐIỂM'}</div>
           {mode === 'select' && (
             <div className="space-y-0.5">
               <div>• Click nút để chọn, Kéo để di chuyển</div>
               <div>• Click cạnh/số để <span className="text-red-400 font-bold">chọn/xóa</span></div>
               <div className="text-blue-300">• Double-click số để sửa trọng số</div>
               <div className="text-purple-300">• Double-click nút để đổi tên/loại</div>
             </div>
           )}
           {mode === 'add_node' && <div>• Click vào vùng trống để thêm thiết bị</div>}
           {mode === 'add_link' && <div>• Click nút Nguồn -&gt; Click nút Đích</div>}
           {mode === 'set_start' && <div className="text-green-400 font-bold">• Click chọn nút NGUỒN (Start)</div>}
           {mode === 'set_end' && <div className="text-red-400 font-bold">• Click chọn nút ĐÍCH (Target)</div>}
           {tempLinkSource && <span className="text-pink-400 block mt-1">Đang chọn đích đến...</span>}
        </div>
      </div>
    </div>
  );
};
