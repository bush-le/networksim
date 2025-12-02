import { GraphData, Node, Link, AlgorithmResult } from '../types';

// Helper to get adjacency list
const getAdjacencyList = (graph: GraphData) => {
  const adj: Record<string, { node: string; weight: number; capacity?: number }[]> = {};
  graph.nodes.forEach(n => adj[n.id] = []);
  
  graph.links.forEach(l => {
    adj[l.source].push({ node: l.target, weight: l.weight, capacity: l.capacity || l.weight });
    if (!graph.isDirected) {
      adj[l.target].push({ node: l.source, weight: l.weight, capacity: l.capacity || l.weight });
    }
  });
  return adj;
};

// Helper to get Node Label
const getLabel = (graph: GraphData, id: string): string => {
  const node = graph.nodes.find(n => n.id === id);
  return node ? node.label : id;
};

// 3. Find Shortest Path (Dijkstra)
export const runDijkstra = (graph: GraphData, startId: string, endId: string): AlgorithmResult => {
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const queue: string[] = [];
  const visited: string[] = [];
  const logs: string[] = [];

  graph.nodes.forEach(n => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
    queue.push(n.id);
  });

  distances[startId] = 0;
  logs.push(`Khởi tạo: Khoảng cách đến ${getLabel(graph, startId)} là 0, còn lại là vô cực.`);

  while (queue.length > 0) {
    queue.sort((a, b) => distances[a] - distances[b]);
    const u = queue.shift()!;
    visited.push(u);

    if (u === endId) break;
    if (distances[u] === Infinity) break;

    const adj = getAdjacencyList(graph);
    adj[u]?.forEach(neighbor => {
      const alt = distances[u] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = u;
        logs.push(`Cập nhật: ${getLabel(graph, neighbor.node)} qua ${getLabel(graph, u)} có khoảng cách ${alt}`);
      }
    });
  }

  const path: string[] = [];
  let current: string | null = endId;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  if (distances[endId] === Infinity) {
    return { logs: [...logs, "Không tìm thấy đường đi."], visited };
  }

  const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
  return { path, visited, logs: [...logs, `Đường đi ngắn nhất: ${pathLabels} (Tổng trọng số: ${distances[endId]})`] };
};

// 4. BFS
export const runBFS = (graph: GraphData, startId: string): AlgorithmResult => {
  const visited: string[] = [];
  const queue: string[] = [startId];
  const visitedSet = new Set<string>();
  const logs: string[] = [];
  const traversedEdges: Link[] = [];

  visitedSet.add(startId);
  logs.push(`Bắt đầu BFS từ ${getLabel(graph, startId)}`);

  const adj = getAdjacencyList(graph);

  while (queue.length > 0) {
    const u = queue.shift()!;
    visited.push(u);
    logs.push(`Đã duyệt: ${getLabel(graph, u)}`);

    adj[u]?.forEach(neighbor => {
      if (!visitedSet.has(neighbor.node)) {
        visitedSet.add(neighbor.node);
        queue.push(neighbor.node);
        // Record the edge used to discover this node
        traversedEdges.push({ source: u, target: neighbor.node, weight: neighbor.weight });
      }
    });
  }

  return { visited, logs, traversedEdges };
};

// 4. DFS
export const runDFS = (graph: GraphData, startId: string): AlgorithmResult => {
  const visited: string[] = [];
  // Stack now stores { current_node, parent_node } to track edges
  const stack: { id: string; from: string | null }[] = [{ id: startId, from: null }];
  const visitedSet = new Set<string>();
  const logs: string[] = [];
  const traversedEdges: Link[] = [];

  logs.push(`Bắt đầu DFS từ ${getLabel(graph, startId)}`);

  const adj = getAdjacencyList(graph);

  while (stack.length > 0) {
    const { id: u, from } = stack.pop()!;
    
    if (!visitedSet.has(u)) {
      visitedSet.add(u);
      visited.push(u);
      logs.push(`Đã duyệt: ${getLabel(graph, u)}`);

      if (from) {
        traversedEdges.push({ source: from, target: u, weight: 0 }); // Weight doesn't matter for visual highlight
      }

      // Push reverse to preserve order logic usually expected in DFS visualization
      const neighbors = adj[u] ? [...adj[u]].reverse() : [];
      neighbors.forEach(neighbor => {
        if (!visitedSet.has(neighbor.node)) {
          stack.push({ id: neighbor.node, from: u });
        }
      });
    }
  }

  return { visited, logs, traversedEdges };
};

// 5. Bipartite Check
export const checkBipartite = (graph: GraphData): AlgorithmResult => {
  const colors: Record<string, number> = {}; // 0 or 1
  const setA: string[] = [];
  const setB: string[] = [];
  const logs: string[] = [];
  const adj = getAdjacencyList(graph);
  let isBipartite = true;

  for (const node of graph.nodes) {
    if (colors[node.id] !== undefined) continue;

    const queue = [node.id];
    colors[node.id] = 0;
    setA.push(node.id);

    while (queue.length > 0) {
      const u = queue.shift()!;
      
      adj[u]?.forEach(v => {
        if (colors[v.node] === undefined) {
          colors[v.node] = 1 - colors[u];
          if (colors[v.node] === 0) setA.push(v.node);
          else setB.push(v.node);
          queue.push(v.node);
        } else if (colors[v.node] === colors[u]) {
          isBipartite = false;
          logs.push(`Xung đột màu tại cạnh ${getLabel(graph, u)} - ${getLabel(graph, v.node)}`);
        }
      });
      if (!isBipartite) break;
    }
    if (!isBipartite) break;
  }

  const setALabels = setA.map(id => getLabel(graph, id)).join(', ');
  const setBLabels = setB.map(id => getLabel(graph, id)).join(', ');

  return {
    isBipartite,
    bipartiteSets: isBipartite ? { setA, setB } : undefined,
    logs: isBipartite 
      ? ["Đồ thị là đồ thị 2 phía (Bipartite).", `Tập A: ${setALabels}`, `Tập B: ${setBLabels}`]
      : [...logs, "Đồ thị KHÔNG phải là đồ thị 2 phía."]
  };
};

// 7.1 Prim (MST)
export const runPrim = (graph: GraphData): AlgorithmResult => {
  if (graph.isDirected) return { logs: ["Thuật toán Prim thường áp dụng cho đồ thị vô hướng."] };
  
  const parent: Record<string, string | null> = {};
  const key: Record<string, number> = {};
  const mstSet: Set<string> = new Set();
  const logs: string[] = [];
  const mstLinks: Link[] = [];

  graph.nodes.forEach(n => key[n.id] = Infinity);
  const startNode = graph.nodes[0].id;
  key[startNode] = 0;
  parent[startNode] = null;

  const adj = getAdjacencyList(graph);

  for (let i = 0; i < graph.nodes.length; i++) {
    let u = -1;
    // Find min key vertex not in mstSet
    let min = Infinity;
    graph.nodes.forEach(n => {
      if (!mstSet.has(n.id) && key[n.id] < min) {
        min = key[n.id];
        u = graph.nodes.indexOf(n);
      }
    });

    if (u === -1) break;
    const uId = graph.nodes[u].id;
    mstSet.add(uId);

    if (parent[uId] !== null) {
      mstLinks.push({ source: parent[uId]!, target: uId, weight: key[uId] });
      logs.push(`Thêm cạnh ${getLabel(graph, parent[uId]!)} - ${getLabel(graph, uId)} vào cây khung.`);
    }

    adj[uId]?.forEach(v => {
      if (!mstSet.has(v.node) && v.weight < key[v.node]) {
        parent[v.node] = uId;
        key[v.node] = v.weight;
      }
    });
  }

  return { mstLinks, logs: ["Hoàn thành thuật toán Prim.", ...logs] };
};

// 7.2 Kruskal (MST)
export const runKruskal = (graph: GraphData): AlgorithmResult => {
  if (graph.isDirected) return { logs: ["Thuật toán Kruskal áp dụng cho đồ thị vô hướng."] };

  const logs: string[] = [];
  const mstLinks: Link[] = [];
  const sortedLinks = [...graph.links].sort((a, b) => a.weight - b.weight);
  
  const parent: Record<string, string> = {};
  graph.nodes.forEach(n => parent[n.id] = n.id);

  const find = (i: string): string => {
    if (parent[i] === i) return i;
    return find(parent[i]);
  };

  const union = (i: string, j: string) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
      return true;
    }
    return false;
  };

  for (const link of sortedLinks) {
    if (union(link.source, link.target)) {
      mstLinks.push(link);
      logs.push(`Chọn cạnh ${getLabel(graph, link.source)} - ${getLabel(graph, link.target)} (trọng số ${link.weight})`);
    }
  }

  return { mstLinks, logs: ["Hoàn thành thuật toán Kruskal.", ...logs] };
};

// 7.3 Ford-Fulkerson (Max Flow)
export const runFordFulkerson = (graph: GraphData, s: string, t: string): AlgorithmResult => {
  const logs: string[] = [];
  const rGraph: Record<string, number> = {};
  
  graph.links.forEach(l => {
    rGraph[`${l.source}->${l.target}`] = l.capacity || l.weight;
    if (!graph.isDirected) {
       rGraph[`${l.target}->${l.source}`] = l.capacity || l.weight;
    } else {
       if (rGraph[`${l.target}->${l.source}`] === undefined) {
          rGraph[`${l.target}->${l.source}`] = 0;
       }
    }
  });

  const parent: Record<string, string> = {};
  let maxFlow = 0;

  const bfs = (): boolean => {
    const visited = new Set<string>();
    const queue = [s];
    visited.add(s);
    
    for (const key in parent) delete parent[key];

    while (queue.length > 0) {
      const u = queue.shift()!;
      
      for (const node of graph.nodes) {
        const v = node.id;
        const cap = rGraph[`${u}->${v}`];
        if (!visited.has(v) && cap > 0) {
          queue.push(v);
          parent[v] = u;
          visited.add(v);
          if (v === t) return true;
        }
      }
    }
    return false;
  };

  while (bfs()) {
    let pathFlow = Infinity;
    let v = t;
    
    const path: string[] = [t];
    while (v !== s) {
      const u = parent[v];
      path.unshift(u);
      pathFlow = Math.min(pathFlow, rGraph[`${u}->${v}`]);
      v = u;
    }
    const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
    logs.push(`Tìm thấy đường tăng luồng: ${pathLabels} với luồng ${pathFlow}`);

    v = t;
    while (v !== s) {
      const u = parent[v];
      rGraph[`${u}->${v}`] -= pathFlow;
      rGraph[`${v}->${u}`] += pathFlow;
      v = u;
    }
    maxFlow += pathFlow;
  }

  const flowDetails: Record<string, number> = {};
  graph.links.forEach(l => {
      const originalCap = l.capacity || l.weight;
      const residual = rGraph[`${l.source}->${l.target}`];
      flowDetails[`${l.source}->${l.target}`] = Math.max(0, originalCap - residual);
  });

  return { maxFlow, flowDetails, logs: [...logs, `Luồng cực đại (Max Flow): ${maxFlow}`] };
};

// --- EULERIAN HELPERS ---

const getDegrees = (graph: GraphData) => {
  const inDegree: Record<string, number> = {};
  const outDegree: Record<string, number> = {};
  const degree: Record<string, number> = {};

  graph.nodes.forEach(n => {
    inDegree[n.id] = 0;
    outDegree[n.id] = 0;
    degree[n.id] = 0;
  });

  graph.links.forEach(l => {
    if (graph.isDirected) {
      outDegree[l.source]++;
      inDegree[l.target]++;
    } else {
      degree[l.source]++;
      degree[l.target]++;
    }
  });

  return { inDegree, outDegree, degree };
};

// 7.4 Fleury's Algorithm
export const runFleury = (graph: GraphData): AlgorithmResult => {
  const logs: string[] = [];
  const { degree, inDegree, outDegree } = getDegrees(graph);
  let startNode = graph.nodes[0].id;
  let oddCount = 0;

  // 1. Kiểm tra điều kiện tồn tại Euler Path/Circuit
  if (!graph.isDirected) {
    for (const id in degree) {
      if (degree[id] % 2 !== 0) {
        oddCount++;
        startNode = id; // Bắt đầu từ đỉnh bậc lẻ nếu có
      }
    }
    if (oddCount > 2) {
      return { logs: ["Fleury: Không tồn tại đường đi Euler (số đỉnh bậc lẻ > 2)."] };
    }
  } else {
    // Đồ thị có hướng (logic đơn giản hóa cho demo)
    // Cần kiểm tra inDegree == outDegree cho circuit, hoặc chênh lệch 1 cho path
  }

  logs.push(oddCount === 0 ? "Fleury: Đồ thị có Chu trình Euler." : "Fleury: Đồ thị có Đường đi Euler.");
  logs.push(`Bắt đầu từ đỉnh: ${getLabel(graph, startNode)}`);

  // 2. Chuẩn bị dữ liệu mutable (Deep copy danh sách cạnh)
  let adj: Record<string, string[]> = {};
  graph.nodes.forEach(n => adj[n.id] = []);
  let edgeCount = 0;

  graph.links.forEach(l => {
    adj[l.source].push(l.target);
    edgeCount++;
    if (!graph.isDirected) {
      adj[l.target].push(l.source);
      edgeCount++;
    }
  });

  // Helper: Đếm số đỉnh đến được (DFS) để kiểm tra cầu
  const countReachable = (u: string, currentAdj: Record<string, string[]>): number => {
    const visited = new Set<string>();
    const stack = [u];
    visited.add(u);
    let count = 0;
    while (stack.length) {
      const node = stack.pop()!;
      count++;
      currentAdj[node]?.forEach(v => {
        if (!visited.has(v)) {
          visited.add(v);
          stack.push(v);
        }
      });
    }
    return count;
  };

  // Helper: Xóa cạnh u-v
  const removeEdge = (u: string, v: string) => {
    adj[u] = adj[u].filter(n => n !== v);
    if (!graph.isDirected) {
      adj[v] = adj[v].filter(n => n !== u);
    }
  };

  // Helper: Kiểm tra cạnh cầu
  const isValidNextEdge = (u: string, v: string): boolean => {
    if (adj[u].length === 1) return true; // Chỉ còn 1 đường, bắt buộc đi

    const count1 = countReachable(u, adj);
    
    // Tạm xóa cạnh
    removeEdge(u, v);
    const count2 = countReachable(u, adj);
    
    // Thêm lại cạnh (backtrack để restore trạng thái nếu check xong)
    adj[u].push(v);
    if (!graph.isDirected) adj[v].push(u);

    return count1 <= count2; // Nếu số đỉnh đến được không giảm -> không phải cầu
  };

  const path: string[] = [startNode];
  let u = startNode;
  
  // Giới hạn lặp để tránh treo trình duyệt nếu lỗi
  const maxSteps = graph.links.length + 2; 
  let step = 0;

  // Thực thi Fleury
  while (adj[u] && adj[u].length > 0 && step < maxSteps * 2) {
    step++;
    const neighbors = adj[u];
    let chosenV: string | null = null;

    // Ưu tiên chọn cạnh không phải cầu
    for (const v of neighbors) {
      if (isValidNextEdge(u, v)) {
        chosenV = v;
        break;
      }
    }
    
    // Nếu tất cả là cầu (hoặc chỉ còn 1 cạnh), chọn đại diện
    if (!chosenV && neighbors.length > 0) chosenV = neighbors[0];

    if (chosenV) {
      logs.push(`Đi từ ${getLabel(graph, u)} đến ${getLabel(graph, chosenV)}`);
      path.push(chosenV);
      removeEdge(u, chosenV);
      u = chosenV;
    } else {
      break;
    }
  }

  const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
  return { path, visited: path, logs: [...logs, `Kết quả Fleury: ${pathLabels}`] };
};

// 7.5 Hierholzer's Algorithm
export const runHierholzer = (graph: GraphData): AlgorithmResult => {
  const logs: string[] = [];
  const { degree, inDegree, outDegree } = getDegrees(graph);
  let startNode = graph.nodes[0].id;
  
  // Hierholzer thường tìm Chu trình (Circuit). Nếu tìm đường đi (Path), cần thêm cạnh ảo nối start-end.
  
  let oddCount = 0;
  if (!graph.isDirected) {
    for (const id in degree) {
      if (degree[id] % 2 !== 0) {
        oddCount++;
        startNode = id;
      }
    }
    if (oddCount > 2) return { logs: ["Hierholzer: Không tồn tại đường đi Euler (số đỉnh bậc lẻ > 2)."] };
  }
  
  logs.push(`Hierholzer: Bắt đầu thuật toán từ ${getLabel(graph, startNode)}`);

  // Copy adj mutable
  let adj: Record<string, string[]> = {};
  graph.nodes.forEach(n => adj[n.id] = []);
  let edgeCount = 0;
  graph.links.forEach(l => {
    adj[l.source].push(l.target);
    edgeCount++;
    if (!graph.isDirected) {
      adj[l.target].push(l.source);
      edgeCount++;
    }
  });

  const stack: string[] = [];
  const circuit: string[] = [];
  
  stack.push(startNode);

  while (stack.length > 0) {
    const u = stack[stack.length - 1]; // Peek
    
    if (adj[u] && adj[u].length > 0) {
      const v = adj[u].pop()!; // Lấy 1 cạnh và xóa khỏi danh sách kề
      
      // Xóa chiều ngược lại nếu vô hướng
      if (!graph.isDirected) {
        const idx = adj[v].indexOf(u);
        if (idx > -1) adj[v].splice(idx, 1);
      }
      
      stack.push(v); // Push vertex to stack
      logs.push(`Push ${getLabel(graph, v)} vào stack`);
    } else {
      const popped = stack.pop()!;
      circuit.push(popped); // Backtrack
      logs.push(`Backtrack: thêm ${getLabel(graph, popped)} vào mạch`);
    }
  }

  const resultPath = circuit.reverse(); // Đảo ngược để có thứ tự đúng
  const pathLabels = resultPath.map(id => getLabel(graph, id)).join(' -> ');

  return { path: resultPath, visited: resultPath, logs: [...logs, `Kết quả Hierholzer: ${pathLabels}`] };
};
