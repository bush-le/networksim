import React from 'react';
import { GraphData } from '../types';

interface Props {
  graph: GraphData;
  isOpen: boolean;
  onClose: () => void;
}

export const ConversionModal: React.FC<Props> = ({ graph, isOpen, onClose }) => {
  if (!isOpen) return null;

  // 1. Adjacency Matrix
  const nodeIds = graph.nodes.map(n => n.id);
  const matrix = nodeIds.map(sourceId => {
    return nodeIds.map(targetId => {
      const link = graph.links.find(l => 
        (l.source === sourceId && l.target === targetId) ||
        (!graph.isDirected && l.source === targetId && l.target === sourceId)
      );
      return link ? link.weight : 0;
    });
  });

  // 2. Adjacency List
  const adjList: Record<string, string[]> = {};
  graph.nodes.forEach(n => adjList[n.label] = []);
  graph.links.forEach(l => {
    const s = graph.nodes.find(n => n.id === l.source)?.label || l.source;
    const t = graph.nodes.find(n => n.id === l.target)?.label || l.target;
    adjList[s].push(`${t}(${l.weight})`);
    if (!graph.isDirected) adjList[t].push(`${s}(${l.weight})`);
  });

  // 3. Edge List
  const edgeList = graph.links.map(l => {
     const s = graph.nodes.find(n => n.id === l.source)?.label || l.source;
     const t = graph.nodes.find(n => n.id === l.target)?.label || l.target;
     return `${s} -> ${t} [w=${l.weight}]`;
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Biểu diễn đồ thị</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Matrix */}
          <div className="bg-zinc-950 p-4 rounded">
            <h3 className="text-blue-400 font-bold mb-2">Ma trận kề (Adjacency Matrix)</h3>
            <div className="overflow-x-auto">
              <table className="table-auto text-xs text-zinc-300 w-full text-center">
                <thead>
                  <tr>
                    <th></th>
                    {graph.nodes.map(n => <th key={n.id} className="p-1">{n.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={i}>
                      <td className="font-bold text-zinc-500 p-1">{graph.nodes[i].label}</td>
                      {row.map((val, j) => (
                        <td key={j} className={`p-1 border border-zinc-800 ${val > 0 ? 'text-green-400' : 'text-zinc-700'}`}>
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Adj List */}
          <div className="bg-zinc-950 p-4 rounded">
            <h3 className="text-purple-400 font-bold mb-2">Danh sách kề (Adjacency List)</h3>
            <div className="text-xs text-zinc-300 font-mono space-y-1">
              {Object.entries(adjList).map(([node, neighbors]) => (
                <div key={node}>
                  <span className="text-yellow-500">{node}</span>: [{neighbors.join(', ')}]
                </div>
              ))}
            </div>
          </div>

          {/* Edge List */}
          <div className="bg-zinc-950 p-4 rounded">
            <h3 className="text-pink-400 font-bold mb-2">Danh sách cạnh (Edge List)</h3>
             <div className="text-xs text-zinc-300 font-mono space-y-1 h-64 overflow-y-auto">
              {edgeList.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};