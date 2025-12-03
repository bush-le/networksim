
import { GraphData, Node, Link, AlgorithmResult, AlgorithmStep } from '../types';

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

// Helper to reconstruct path from Previous map
const reconstructPath = (previous: Record<string, string | null>, endId: string): string[] => {
  const path: string[] = [];
  let current: string | null = endId;
  const visited = new Set<string>();
  
  while (current) {
    if (visited.has(current)) break; // Prevent infinite loop
    visited.add(current);
    path.unshift(current);
    current = previous[current];
  }
  return path;
};

// Helper to get edges from Previous map for visualization
const getEdgesFromPrevious = (graph: GraphData, previous: Record<string, string | null>): Link[] => {
  const edges: Link[] = [];
  graph.nodes.forEach(n => {
    const p = previous[n.id];
    if (p) {
       // Find original link weight if possible
       const link = graph.links.find(l => 
          (l.source === p && l.target === n.id) || (!graph.isDirected && l.source === n.id && l.target === p)
       );
       edges.push({ source: p, target: n.id, weight: link ? link.weight : 0 });
    }
  });
  return edges;
};

// --- ALGORITHMS WITH STEP RECORDING ---

// 3. Find Shortest Path (Dijkstra - OSPF Simulation)
export const runDijkstra = (graph: GraphData, startId: string, endId?: string | null): AlgorithmResult => {
  const logs: string[] = [];
  const steps: AlgorithmStep[] = [];

  // 1. Validate Negative Weights
  const hasNegativeWeight = graph.links.some(l => l.weight < 0);
  if (hasNegativeWeight) {
    const errorLog = "LỖI OSPF: Phát hiện Metric âm. OSPF không hỗ trợ trọng số âm. Vui lòng chuyển sang giao thức RIP (Bellman-Ford).";
    logs.push(errorLog);
    return { logs, steps: [{ log: errorLog }] };
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const queue: string[] = [];
  const visited: string[] = [];

  graph.nodes.forEach(n => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
    queue.push(n.id);
  });

  distances[startId] = 0;
  const initLog = endId 
    ? `OSPF Init: Tính toán bảng định tuyến từ ${getLabel(graph, startId)} đến ${getLabel(graph, endId)}.`
    : `OSPF Init: Quảng bá LSA, tìm đường đi ngắn nhất từ ${getLabel(graph, startId)} đến toàn mạng.`;
    
  logs.push(initLog);
  steps.push({ log: initLog, visited: [], currentNodeId: startId });

  while (queue.length > 0) {
    queue.sort((a, b) => distances[a] - distances[b]);
    const u = queue.shift()!;
    
    if (distances[u] === Infinity) break;

    visited.push(u);

    const visitLog = `Xử lý Router: ${getLabel(graph, u)} (Metric tích lũy: ${distances[u]})`;
    logs.push(visitLog);
    steps.push({ 
      log: visitLog, 
      visited: [...visited], 
      currentNodeId: u,
      traversedEdges: getEdgesFromPrevious(graph, previous) // Show current SPF tree
    });

    if (endId && u === endId) {
      logs.push(`Đã đến đích ${getLabel(graph, endId)}. Kết thúc định tuyến.`);
      break;
    }

    const adj = getAdjacencyList(graph);
    adj[u]?.forEach(neighbor => {
      const alt = distances[u] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = u;
        
        const updateLog = `  -> Cập nhật Route: ${getLabel(graph, neighbor.node)} qua ${getLabel(graph, u)} (Metric: ${alt})`;
        logs.push(updateLog);
        steps.push({ 
          log: updateLog, 
          visited: [...visited], 
          currentNodeId: u,
          currentLinkId: { source: u, target: neighbor.node },
          traversedEdges: getEdgesFromPrevious(graph, previous)
        });
      }
    });
  }

  if (endId) {
    if (distances[endId] === Infinity) {
      const failLog = "LỖI: Host đích không phản hồi (Destination Unreachable). Mạng bị ngắt quãng.";
      logs.push(failLog);
      return { logs, visited, steps };
    }
    const path = reconstructPath(previous, endId);
    const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
    const successLog = `Định tuyến thành công: ${pathLabels} (Tổng Metric: ${distances[endId]})`;
    logs.push(successLog);
    steps.push({ log: successLog, visited: [...visited], path: [...path] });
    return { path, visited, logs, steps };
  } else {
    // All Pairs (SPT)
    const mstLinks: Link[] = [];
    const finalDistancesLog: string[] = [];
    const unreachable: string[] = [];
    
    graph.nodes.forEach(n => {
      if (previous[n.id]) {
        const p = previous[n.id]!;
        const link = graph.links.find(l => 
          (l.source === p && l.target === n.id) || (!graph.isDirected && l.source === n.id && l.target === p)
        );
        mstLinks.push({ source: p, target: n.id, weight: link ? link.weight : 0 });
      }
      if (distances[n.id] !== Infinity) {
        finalDistancesLog.push(`Net ${getLabel(graph, n.id)}: Metric ${distances[n.id]}`);
      } else {
        unreachable.push(getLabel(graph, n.id));
      }
    });

    logs.push("=== Bảng Định Tuyến OSPF ===");
    logs.push(...finalDistancesLog);
    if (unreachable.length > 0) {
      logs.push(`CẢNH BÁO: Các subnet không thông mạng (Unreachable): ${unreachable.join(', ')}`);
    }
    
    steps.push({ 
      log: "Hoàn thành OSPF. Hiển thị Cây đường đi ngắn nhất (Shortest Path Tree).", 
      visited: [...visited], 
      mstLinks: [...mstLinks] 
    });

    return { mstLinks, visited, logs, steps };
  }
};

// 3.1 Bellman-Ford (RIP Simulation)
export const runBellmanFord = (graph: GraphData, startId: string, endId?: string | null): AlgorithmResult => {
  const logs: string[] = [];
  const steps: AlgorithmStep[] = [];

  if (!graph.isDirected && graph.links.some(l => l.weight < 0)) {
     const err = "LỖI RIP: Liên kết vô hướng có metric âm sẽ tạo chu trình âm (Routing Loop). Không thể hội tụ.";
     logs.push(err);
     return { logs, steps: [{ log: err }] };
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const V = graph.nodes.length;
  
  graph.nodes.forEach(n => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
  });
  distances[startId] = 0;

  const initLog = `RIP Start: Khởi tạo bảng định tuyến (Distance Vector). Nguồn: ${getLabel(graph, startId)}`;
  logs.push(initLog);
  steps.push({ log: initLog, currentNodeId: startId });

  const allEdges: { u: string, v: string, w: number }[] = [];
  graph.links.forEach(l => {
    allEdges.push({ u: l.source, v: l.target, w: l.weight });
    if (!graph.isDirected) {
      allEdges.push({ u: l.target, v: l.source, w: l.weight });
    }
  });

  let somethingChanged = false;
  // Relax V-1 times
  for (let i = 1; i < V; i++) {
    somethingChanged = false;
    const iterLog = `Update Round ${i}/${V-1}: Quảng bá thông tin định tuyến...`;
    logs.push(iterLog);
    // Visual step for round start
    steps.push({ 
       log: iterLog, 
       visited: Object.keys(distances).filter(k => distances[k] !== Infinity),
       traversedEdges: getEdgesFromPrevious(graph, previous)
    });

    for (const edge of allEdges) {
      if (distances[edge.u] !== Infinity && distances[edge.u] + edge.w < distances[edge.v]) {
        distances[edge.v] = distances[edge.u] + edge.w;
        previous[edge.v] = edge.u;
        somethingChanged = true;

        const updateLog = `  -> Cập nhật: ${getLabel(graph, edge.v)} đi qua ${getLabel(graph, edge.u)} (Metric: ${distances[edge.v]})`;
        logs.push(updateLog);
        steps.push({
           log: updateLog,
           currentNodeId: edge.v,
           currentLinkId: { source: edge.u, target: edge.v },
           visited: Object.keys(distances).filter(k => distances[k] !== Infinity),
           traversedEdges: getEdgesFromPrevious(graph, previous)
        });
      }
    }
    if (!somethingChanged) {
      logs.push("Mạng đã hội tụ (Network Converged).");
      break;
    }
  }

  logs.push("Kiểm tra Routing Loop (Chu trình âm)...");
  for (const edge of allEdges) {
    if (distances[edge.u] !== Infinity && distances[edge.u] + edge.w < distances[edge.v]) {
      const cycleLog = "CRITICAL ERROR: Phát hiện chu trình âm (Negative Cycle). Giao thức không thể định tuyến!";
      logs.push(cycleLog);
      steps.push({ 
        log: cycleLog, 
        currentLinkId: { source: edge.u, target: edge.v } 
      });
      return { logs, steps };
    }
  }

  if (endId) {
    if (distances[endId] === Infinity) {
      const failLog = "Destination Unreachable.";
      logs.push(failLog);
      return { logs, steps };
    }
    const path = reconstructPath(previous, endId);
    const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
    const successLog = `Định tuyến RIP: ${pathLabels} (Metric: ${distances[endId]})`;
    logs.push(successLog);
    steps.push({ log: successLog, path: [...path], visited: path });
    return { path, visited: path, logs, steps };
  } else {
    const mstLinks = getEdgesFromPrevious(graph, previous);
    const finalDistancesLog: string[] = [];
    graph.nodes.forEach(n => {
      if (distances[n.id] !== Infinity) {
        finalDistancesLog.push(`${getLabel(graph, n.id)}: ${distances[n.id]}`);
      }
    });
    logs.push(...finalDistancesLog);
    steps.push({ log: "Hoàn tất RIP.", mstLinks });
    return { mstLinks, logs, steps };
  }
};

// 4. BFS (Broadcast Simulation)
export const runBFS = (graph: GraphData, startId: string): AlgorithmResult => {
  const visited: string[] = [];
  const queue: string[] = [startId];
  const visitedSet = new Set<string>();
  const logs: string[] = [];
  const traversedEdges: Link[] = [];
  const steps: AlgorithmStep[] = [];

  visitedSet.add(startId);
  const startLog = `Broadcast Init: Bắt đầu quảng bá gói tin từ nút nguồn ${getLabel(graph, startId)}`;
  logs.push(startLog);
  steps.push({ log: startLog, visited: [...visited], currentNodeId: startId });

  const adj = getAdjacencyList(graph);

  while (queue.length > 0) {
    const u = queue.shift()!;
    // Ensure 'visited' contains unique items if needed, but array push is fine for order
    // Check if u is already in visited list to avoid duplicates in visual array
    if (!visited.includes(u)) visited.push(u);
    
    const visitLog = `Gói tin đã đến: ${getLabel(graph, u)}`;
    logs.push(visitLog);
    steps.push({ 
      log: visitLog, 
      visited: [...visited], // PASS CUMULATIVE VISITED
      currentNodeId: u, 
      traversedEdges: [...traversedEdges] 
    });

    adj[u]?.forEach(neighbor => {
      if (!visitedSet.has(neighbor.node)) {
        visitedSet.add(neighbor.node);
        queue.push(neighbor.node);
        traversedEdges.push({ source: u, target: neighbor.node, weight: neighbor.weight });
        
        const discoverLog = `  -> Forwarding (Chuyển tiếp) đến: ${getLabel(graph, neighbor.node)}`;
        logs.push(discoverLog);
        steps.push({ 
          log: discoverLog, 
          visited: [...visited], // KEEP VISITED CONSISTENT
          currentNodeId: u,
          traversedEdges: [...traversedEdges],
          currentLinkId: { source: u, target: neighbor.node }
        });
      }
    });
  }

  return { visited, logs, traversedEdges, steps };
};

// 4. DFS (Deep Trace Simulation)
export const runDFS = (graph: GraphData, startId: string): AlgorithmResult => {
  const visited: string[] = [];
  const stack: { id: string; from: string | null }[] = [{ id: startId, from: null }];
  const visitedSet = new Set<string>();
  const logs: string[] = [];
  const traversedEdges: Link[] = [];
  const steps: AlgorithmStep[] = [];

  const startLog = `Deep Trace: Bắt đầu dò quét sâu (Depth-First) từ ${getLabel(graph, startId)}`;
  logs.push(startLog);
  steps.push({ log: startLog, visited: [], currentNodeId: startId });

  const adj = getAdjacencyList(graph);

  while (stack.length > 0) {
    const { id: u, from } = stack.pop()!;
    
    if (!visitedSet.has(u)) {
      visitedSet.add(u);
      visited.push(u);
      
      if (from) {
        traversedEdges.push({ source: from, target: u, weight: 0 });
      }

      const visitLog = `Dò quét Node: ${getLabel(graph, u)}`;
      logs.push(visitLog);
      steps.push({ 
        log: visitLog, 
        visited: [...visited], // PERSIST VISITED
        currentNodeId: u, 
        traversedEdges: [...traversedEdges],
        currentLinkId: from ? { source: from, target: u } : null
      });

      const neighbors = adj[u] ? [...adj[u]].reverse() : [];
      neighbors.forEach(neighbor => {
        if (!visitedSet.has(neighbor.node)) {
          stack.push({ id: neighbor.node, from: u });
        }
      });
    }
  }

  return { visited, logs, traversedEdges, steps };
};

// 7.1 Prim (MST)
export const runPrim = (graph: GraphData): AlgorithmResult => {
  if (graph.isDirected) return { logs: ["Prim Error: Chỉ áp dụng cho thiết kế mạng Backbone vô hướng."] };
  
  const parent: Record<string, string | null> = {};
  const key: Record<string, number> = {};
  const mstSet: Set<string> = new Set();
  const visitedNodes: string[] = []; // Track nodes for coloring
  const logs: string[] = [];
  const mstLinks: Link[] = [];
  const steps: AlgorithmStep[] = [];
  let totalCost = 0;

  graph.nodes.forEach(n => key[n.id] = Infinity);
  const startNode = graph.nodes[0].id;
  key[startNode] = 0;
  parent[startNode] = null;

  const adj = getAdjacencyList(graph);
  
  const startLog = `Design Init: Bắt đầu xây dựng Backbone từ Core ${getLabel(graph, startNode)}`;
  logs.push(startLog);
  steps.push({ log: startLog, mstLinks: [], currentNodeId: startNode, visited: [] });

  for (let i = 0; i < graph.nodes.length; i++) {
    let u = -1;
    let min = Infinity;
    graph.nodes.forEach(n => {
      if (!mstSet.has(n.id) && key[n.id] < min) {
        min = key[n.id];
        u = graph.nodes.indexOf(n);
      }
    });

    if (u === -1) break; // Disconnected graph
    const uId = graph.nodes[u].id;
    mstSet.add(uId);
    visitedNodes.push(uId); // Mark node as 'secured' in the backbone

    if (parent[uId] !== null) {
      mstLinks.push({ source: parent[uId]!, target: uId, weight: key[uId] });
      totalCost += key[uId];

      const addLog = `Triển khai cáp: ${getLabel(graph, parent[uId]!)} <==> ${getLabel(graph, uId)} (Cost: ${key[uId]})`;
      logs.push(addLog);
      
      steps.push({ 
        log: addLog, 
        mstLinks: [...mstLinks],
        visited: [...visitedNodes], // Update visited for coloring
        currentNodeId: uId,
        currentLinkId: null 
      });
    } else {
       const selectLog = `Active Node: ${getLabel(graph, uId)}`;
       logs.push(selectLog);
       steps.push({ 
         log: selectLog, 
         mstLinks: [...mstLinks], 
         visited: [...visitedNodes], // Update visited for coloring
         currentNodeId: uId 
        });
    }

    adj[uId]?.forEach(v => {
      if (!mstSet.has(v.node) && v.weight < key[v.node]) {
        parent[v.node] = uId;
        key[v.node] = v.weight;
      }
    });
  }

  // Connectivity Check
  if (mstSet.size < graph.nodes.length) {
    const warning = "CẢNH BÁO: Mạng không liên thông (Disconnected). Kết quả là Rừng khung nhỏ nhất (MSF).";
    logs.push(warning);
  } else {
    logs.push("Hoàn tất thiết kế Backbone (MST Complete).");
  }

  const finalLog = `TỔNG CHI PHÍ TRIỂN KHAI (Total Cost): ${totalCost}`;
  logs.push(finalLog);
  steps.push({ log: finalLog, mstLinks: [...mstLinks], visited: [...visitedNodes] });

  return { mstLinks, logs, steps, visited: visitedNodes };
};

// 7.2 Kruskal (MST)
export const runKruskal = (graph: GraphData): AlgorithmResult => {
  if (graph.isDirected) return { logs: ["Kruskal Error: Chỉ áp dụng cho mô hình mạng vô hướng."] };

  const logs: string[] = [];
  const mstLinks: Link[] = [];
  const steps: AlgorithmStep[] = [];
  const visitedSet = new Set<string>(); // To track nodes connected by MST edges
  let totalCost = 0;

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

  const startLog = "Link Cost Audit: Sắp xếp danh sách liên kết theo chi phí tăng dần.";
  logs.push(startLog);
  steps.push({ log: startLog, mstLinks: [], visited: [] });

  let edgesCount = 0;
  for (const link of sortedLinks) {
    // STEP 1: Visualization - Checking the link (AMBER)
    const checkLog = `Đánh giá liên kết: ${getLabel(graph, link.source)} - ${getLabel(graph, link.target)} (Cost: ${link.weight})`;
    logs.push(checkLog);
    steps.push({ 
      log: checkLog, 
      mstLinks: [...mstLinks], 
      visited: Array.from(visitedSet),
      currentLinkId: {source: link.source, target: link.target} // Sets visual to Amber
    });

    // STEP 2: Logic - Union Find
    if (union(link.source, link.target)) {
      mstLinks.push(link);
      totalCost += link.weight;
      edgesCount++;
      
      // Add nodes to visited set for coloring
      visitedSet.add(link.source);
      visitedSet.add(link.target);

      const addLog = `  -> CHẤP NHẬN: Thêm vào cấu trúc mạng.`;
      logs.push(addLog);
      
      // STEP 3: Visualization - Accepted (GREEN)
      steps.push({ 
        log: addLog, 
        mstLinks: [...mstLinks], 
        visited: Array.from(visitedSet), // Update visited
        currentLinkId: null 
      });
    } else {
      const skipLog = "  -> TỪ CHỐI: Phát hiện vòng lặp (Redundant Loop).";
      logs.push(skipLog);
      
      // STEP 3: Visualization - Rejected
      steps.push({ 
        log: skipLog, 
        mstLinks: [...mstLinks],
        visited: Array.from(visitedSet),
        currentLinkId: null
      });
    }
  }

  if (edgesCount < graph.nodes.length - 1) {
    logs.push("LƯU Ý: Đồ thị không liên thông. Kết quả là Rừng khung (Minimum Spanning Forest).");
  } else {
    logs.push("Hoàn tất tối ưu hóa chi phí cáp mạng (MST).");
  }

  const finalLog = `TỔNG CHI PHÍ HẠ TẦNG (Total Cost): ${totalCost}`;
  logs.push(finalLog);
  steps.push({ log: finalLog, mstLinks: [...mstLinks], visited: Array.from(visitedSet) });

  return { mstLinks, logs, steps, visited: Array.from(visitedSet) };
};

// 7.3 Ford-Fulkerson (Max Flow - Edmonds-Karp with Animation)
export const runFordFulkerson = (graph: GraphData, s: string, t: string): AlgorithmResult => {
  const logs: string[] = [];
  const steps: AlgorithmStep[] = [];
  const rGraph: Record<string, number> = {};
  
  // 1. Initialize Residual Graph
  graph.links.forEach(l => {
    // Forward capacity
    rGraph[`${l.source}->${l.target}`] = l.capacity || l.weight;
    // Reverse capacity (0 for directed, equal for undirected)
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

  // Helper to construct display flow details
  const getFlowDetails = () => {
    const details: Record<string, number> = {};
    graph.links.forEach(l => {
        const cap = l.capacity || l.weight;
        
        // For visual, we want to know FLOW on the link
        // Flow = Capacity - Residual
        const forwardResid = rGraph[`${l.source}->${l.target}`];
        const backwardResid = rGraph[`${l.target}->${l.source}`];

        if (graph.isDirected) {
           details[`${l.source}->${l.target}`] = Math.max(0, cap - forwardResid);
        } else {
           // Undirected: Determine actual flow direction
           if (forwardResid < cap) {
              details[`${l.source}->${l.target}`] = cap - forwardResid; // Flow S->T
              details[`${l.target}->${l.source}`] = 0;
           } else if (backwardResid < cap) {
              details[`${l.target}->${l.source}`] = cap - backwardResid; // Flow T->S
              details[`${l.source}->${l.target}`] = 0;
           } else {
              details[`${l.source}->${l.target}`] = 0;
           }
        }
    });
    return details;
  }

  const initLog = `Traffic Engineer: Bắt đầu phân tích luồng. Nguồn: ${getLabel(graph, s)} -> Đích: ${getLabel(graph, t)}`;
  logs.push(initLog);
  steps.push({ log: initLog, flowDetails: getFlowDetails() });

  // BFS to find augmenting path in residual graph
  const bfs = (): boolean => {
    const visited = new Set<string>();
    const queue = [s];
    visited.add(s);
    for (const key in parent) delete parent[key];

    // Log BFS start
    const scanLog = "Scanning: Quét đường dẫn khả dụng (BFS)...";
    logs.push(scanLog);
    steps.push({ 
       log: scanLog, 
       visited: [s], 
       currentNodeId: s,
       flowDetails: getFlowDetails() 
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      
      // Iterate all nodes to find neighbors in Residual Graph
      for (const node of graph.nodes) {
        const v = node.id;
        const residualCap = rGraph[`${u}->${v}`];
        
        if (!visited.has(v) && residualCap !== undefined && residualCap > 0) {
          queue.push(v);
          parent[v] = u;
          visited.add(v);
          
          // Animate step
          steps.push({
             log: `  -> Duyệt: ${getLabel(graph, v)} (Dư: ${residualCap})`,
             visited: Array.from(visited),
             currentNodeId: v,
             currentLinkId: { source: u, target: v },
             flowDetails: getFlowDetails()
          });

          if (v === t) return true;
        }
      }
    }
    return false;
  };

  while (bfs()) {
    // Calculate path flow (bottleneck)
    let pathFlow = Infinity;
    let v = t;
    const path: string[] = [t];
    
    while (v !== s) {
      const u = parent[v];
      path.unshift(u);
      pathFlow = Math.min(pathFlow, rGraph[`${u}->${v}`]);
      v = u;
    }
    
    // VISUAL STEP 1: Highlight the augmenting path found
    const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
    const foundLog = `Tìm thấy đường dẫn: ${pathLabels}. Đang tính cổ chai (Bottleneck)...`;
    logs.push(foundLog);
    steps.push({ 
       log: foundLog, 
       path: [...path], 
       flowDetails: getFlowDetails(),
       currentNodeId: null 
    });

    // VISUAL STEP 2: Show Bottleneck Calculation
    const bottleLog = `  -> Bottleneck Capacity = ${pathFlow} Mbps. Chuẩn bị tăng luồng.`;
    logs.push(bottleLog);
    steps.push({
       log: bottleLog,
       path: [...path],
       flowDetails: getFlowDetails()
    });

    // Update residual capacities
    v = t;
    while (v !== s) {
      const u = parent[v];
      rGraph[`${u}->${v}`] -= pathFlow;
      rGraph[`${v}->${u}`] += pathFlow;
      v = u;
    }
    maxFlow += pathFlow;

    // VISUAL STEP 3: Update Flow Display (Arrows turn Cyan)
    const updateLog = `Cập nhật băng thông: +${pathFlow} Mbps vào hệ thống.`;
    logs.push(updateLog);
    steps.push({
       log: updateLog,
       path: [...path], 
       flowDetails: getFlowDetails() // Show new numbers
    });
  }

  // Final Step: Log Saturation
  const saturationLog = "Không còn đường tăng luồng khả dụng (Saturation Point).";
  logs.push(saturationLog);
  steps.push({ log: saturationLog, flowDetails: getFlowDetails() });

  const finalFlowDetails = getFlowDetails();
  const resultLog = `HOÀN TẤT PHÂN TÍCH. TỔNG BĂNG THÔNG CỰC ĐẠI: ${maxFlow} Mbps`;
  logs.push(resultLog);
  steps.push({ log: resultLog, flowDetails: finalFlowDetails });

  return { maxFlow, flowDetails: finalFlowDetails, logs, steps };
};

// ... (KEEP EXISTING EULERIAN HELPERS: getDegrees)
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

// ... (KEEP EXISTING FLEURY)
export const runFleury = (graph: GraphData): AlgorithmResult => {
  const logs: string[] = [];
  const steps: AlgorithmStep[] = [];
  const { degree, inDegree, outDegree } = getDegrees(graph);
  let startNode = graph.nodes[0].id;

  // Euler Check Logic
  if (graph.isDirected) {
      let startNodes = 0;
      let endNodes = 0;
      let balancedNodes = 0;
      let sNode = null;

      for (const n of graph.nodes) {
          const outD = outDegree[n.id];
          const inD = inDegree[n.id];
          if (outD === inD) {
              balancedNodes++;
          } else if (outD === inD + 1) {
              startNodes++;
              sNode = n.id;
          } else if (inD === outD + 1) {
              endNodes++;
          } else {
              // Fail condition
              return { logs: ["Fleury Error: Cấu trúc có hướng không cân bằng (Unbalanced). Không tồn tại đường đi Euler."], steps: [] };
          }
      }

      if (startNodes === 0 && endNodes === 0) {
          // Circuit
          startNode = graph.nodes[0].id;
          logs.push("Network Audit: Đồ thị có hướng đảm bảo Chu trình Euler (Closed Circuit).");
      } else if (startNodes === 1 && endNodes === 1) {
          // Path
          startNode = sNode!;
          logs.push("Network Audit: Đồ thị có hướng đảm bảo Đường đi Euler (Open Path).");
      } else {
          return { logs: ["Fleury Error: Số lượng nút Bắt đầu/Kết thúc không hợp lệ cho đường đi Euler."], steps: [] };
      }
  } else {
      // Undirected
      let oddCount = 0;
      let oddNode = null;
      for (const id in degree) {
        if (degree[id] % 2 !== 0) {
          oddCount++;
          oddNode = id;
        }
      }
      if (oddCount === 0) {
         logs.push("Network Audit: Đồ thị vô hướng đảm bảo Chu trình Euler.");
         startNode = graph.nodes[0].id;
      } else if (oddCount === 2) {
         logs.push("Network Audit: Đồ thị vô hướng đảm bảo Đường đi Euler.");
         startNode = oddNode!;
      } else {
         return { logs: ["Fleury Error: Mạng có > 2 nút bậc lẻ. Không tồn tại đường đi phủ kín."], steps: [] };
      }
  }

  const initLog = "Audit Init: Bắt đầu kiểm tra phủ kín (Fleury).";
  logs.push(initLog);
  steps.push({ log: initLog, visited: [], currentNodeId: startNode });

  // Prepare adjacency list for modification
  let adj: Record<string, string[]> = {};
  graph.nodes.forEach(n => adj[n.id] = []);
  graph.links.forEach(l => {
    adj[l.source].push(l.target);
    if (!graph.isDirected) adj[l.target].push(l.source);
  });

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

  const removeEdge = (u: string, v: string) => {
    adj[u] = adj[u].filter(n => n !== v);
    if (!graph.isDirected) adj[v] = adj[v].filter(n => n !== u);
  };

  const isValidNextEdge = (u: string, v: string): boolean => {
    if (adj[u].length === 1) return true;
    const count1 = countReachable(u, adj);
    removeEdge(u, v);
    const count2 = countReachable(u, adj);
    adj[u].push(v);
    if (!graph.isDirected) adj[v].push(u);
    return count1 <= count2;
  };

  const path: string[] = [startNode];
  let u = startNode;
  const maxSteps = graph.links.length + 2; 
  let step = 0;

  while (adj[u] && adj[u].length > 0 && step < maxSteps * 2) {
    step++;
    const neighbors = adj[u];
    let chosenV: string | null = null;

    for (const v of neighbors) {
      if (isValidNextEdge(u, v)) {
        chosenV = v;
        break;
      }
    }
    // Fallback if bridge is only option
    if (!chosenV && neighbors.length > 0) chosenV = neighbors[0];

    if (chosenV) {
      const stepLog = `Audit Step: Đi qua ${getLabel(graph, u)} -> ${getLabel(graph, chosenV)}`;
      logs.push(stepLog);
      
      removeEdge(u, chosenV);
      const currentPath = [...path, chosenV];
      steps.push({ 
        log: stepLog, 
        path: currentPath, 
        currentNodeId: chosenV,
        currentLinkId: { source: u, target: chosenV }
      });
      
      path.push(chosenV);
      u = chosenV;
    } else {
      break;
    }
  }

  const pathLabels = path.map(id => getLabel(graph, id)).join(' -> ');
  const finalLog = `Kết quả Fleury: ${pathLabels}`;
  logs.push(finalLog);
  steps.push({ log: finalLog, path: [...path], visited: [...path] });

  return { path, visited: path, logs, steps };
};

// ... (KEEP EXISTING HIERHOLZER)
export const runHierholzer = (graph: GraphData): AlgorithmResult => {
  const logs: string[] = [];
  const steps: AlgorithmStep[] = [];
  const { degree, inDegree, outDegree } = getDegrees(graph);
  let startNode = graph.nodes[0].id;
  
  // Euler Check Logic (Identical to Fleury)
  if (graph.isDirected) {
      let startNodes = 0;
      let endNodes = 0;
      let sNode = null;
      for (const n of graph.nodes) {
          const outD = outDegree[n.id];
          const inD = inDegree[n.id];
          if (outD === inD) {}
          else if (outD === inD + 1) { startNodes++; sNode = n.id; }
          else if (inD === outD + 1) { endNodes++; }
          else return { logs: ["Hierholzer Error: Đồ thị không thỏa mãn điều kiện Euler."], steps: [] };
      }
      if (startNodes === 1) startNode = sNode!;
      else if (startNodes === 0) startNode = graph.nodes[0].id;
      else return { logs: ["Hierholzer Error: Không tồn tại đường đi."], steps: [] };
  } else {
      let oddCount = 0;
      let oddNode = null;
      for (const id in degree) {
        if (degree[id] % 2 !== 0) { oddCount++; oddNode = id; }
      }
      if (oddCount === 2) startNode = oddNode!;
      else if (oddCount !== 0) return { logs: ["Hierholzer Error: Số bậc lẻ không hợp lệ."], steps: [] };
  }
  
  const startLog = `Circuit Audit: Bắt đầu dò tìm mạch vòng từ ${getLabel(graph, startNode)}`;
  logs.push(startLog);
  steps.push({ log: startLog, visited: [], currentNodeId: startNode });

  let adj: Record<string, string[]> = {};
  graph.nodes.forEach(n => adj[n.id] = []);
  graph.links.forEach(l => {
    adj[l.source].push(l.target);
    if (!graph.isDirected) adj[l.target].push(l.source);
  });

  const stack: string[] = [startNode];
  const circuit: string[] = [];
  stack.push(startNode);

  while (stack.length > 0) {
    const u = stack[stack.length - 1];
    
    if (adj[u] && adj[u].length > 0) {
      const v = adj[u].pop()!;
      if (!graph.isDirected) {
        const idx = adj[v].indexOf(u);
        if (idx > -1) adj[v].splice(idx, 1);
      }
      stack.push(v);
      const pushLog = `  -> Forward: ${getLabel(graph, u)} -> ${getLabel(graph, v)}`;
      logs.push(pushLog);
      steps.push({ log: pushLog, currentNodeId: v, currentLinkId: {source: u, target: v} });
    } else {
      const popped = stack.pop()!;
      circuit.push(popped);
      const popLog = `  <- Backtrack: Ghi nhận nút ${getLabel(graph, popped)} vào mạch`;
      logs.push(popLog);
      steps.push({ log: popLog, currentNodeId: popped });
    }
  }
  const resultPath = circuit.reverse();
  const finalLog = `Kết quả Hierholzer: ${resultPath.map(id => getLabel(graph, id)).join(' -> ')}`;
  logs.push(finalLog);
  steps.push({ log: finalLog, path: [...resultPath] });

  return { path: resultPath, visited: resultPath, logs, steps };
};

// ... (KEEP EXISTING BIPARTITE)
export const checkBipartite = (graph: GraphData): AlgorithmResult => {
  const colors: Record<string, number> = {}; // 0 or 1
  const setA: string[] = [];
  const setB: string[] = [];
  const logs: string[] = [];
  const steps: AlgorithmStep[] = [];
  const adj = getAdjacencyList(graph);
  let isBipartite = true;

  logs.push("Segmentation Init: Bắt đầu phân tích phân đoạn mạng (Bipartite Check)...");

  for (const node of graph.nodes) {
    if (colors[node.id] !== undefined) continue;

    const queue = [node.id];
    colors[node.id] = 0;
    setA.push(node.id);
    
    const startLog = `Khởi tạo phân vùng mới từ ${getLabel(graph, node.id)} (Gán vào Zone A).`;
    logs.push(startLog);
    steps.push({ 
       log: startLog, 
       currentNodeId: node.id, 
       bipartiteSets: { setA: [...setA], setB: [...setB] } 
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      const neighbors = adj[u] || [];
      
      for (const neighbor of neighbors) {
        const v = neighbor.node;
        if (colors[v] === undefined) {
          colors[v] = 1 - colors[u];
          if (colors[v] === 0) setA.push(v);
          else setB.push(v);
          
          queue.push(v);
          
          const assignLog = `  -> Gán ${getLabel(graph, v)} vào ${colors[v] === 0 ? 'Zone A' : 'Zone B'}`;
          logs.push(assignLog);
          steps.push({ 
             log: assignLog, 
             currentNodeId: v, 
             currentLinkId: { source: u, target: v },
             bipartiteSets: { setA: [...setA], setB: [...setB] }
          });
        } else if (colors[v] === colors[u]) {
          isBipartite = false;
          const conflictLog = `XUNG ĐỘT: ${getLabel(graph, u)} và ${getLabel(graph, v)} cùng vùng màu! Mạng không thể phân tách.`;
          logs.push(conflictLog);
          steps.push({ 
             log: conflictLog, 
             currentLinkId: { source: u, target: v },
             bipartiteSets: { setA: [...setA], setB: [...setB] }
          });
          break; // Stop BFS for this component
        }
      }
      if (!isBipartite) break;
    }
    if (!isBipartite) break;
  }

  const setALabels = setA.map(id => getLabel(graph, id)).join(', ');
  const setBLabels = setB.map(id => getLabel(graph, id)).join(', ');

  const resultLog = isBipartite 
      ? `THÀNH CÔNG: Mạng có thể phân tách 2 vùng độc lập.\nZone A: ${setALabels}\nZone B: ${setBLabels}`
      : "THẤT BẠI: Cấu trúc mạng đan xen, không thể phân tách thành 2 vùng độc lập.";
  
  logs.push(resultLog);
  steps.push({ 
     log: resultLog, 
     bipartiteSets: { setA: [...setA], setB: [...setB] } 
  });

  return {
    isBipartite,
    bipartiteSets: { setA, setB },
    logs,
    steps
  };
};
