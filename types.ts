export interface Node {
  id: string;
  x: number;
  y: number;
  label: string; // e.g., "PC1", "Router A"
  type: 'router' | 'switch' | 'pc' | 'server';
}

export interface Link {
  source: string; // ID of source node
  target: string; // ID of target node
  weight: number;
  capacity?: number; // For Max Flow
  flow?: number; // For Max Flow result
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
  isDirected: boolean;
}

export interface AlgorithmResult {
  path?: string[]; // Array of Node IDs
  visited?: string[]; // Array of Node IDs in order
  mstLinks?: Link[]; // For Prim/Kruskal
  traversedEdges?: Link[]; // For BFS/DFS visualization
  maxFlow?: number; // For Ford-Fulkerson
  flowDetails?: Record<string, number>; // edge key -> flow
  logs: string[];
  isBipartite?: boolean;
  bipartiteSets?: { setA: string[], setB: string[] };
  eulerPath?: string[];
}

export enum AlgorithmType {
  NONE = 'NONE',
  BFS = 'BFS',
  DFS = 'DFS',
  DIJKSTRA = 'DIJKSTRA',
  PRIM = 'PRIM',
  KRUSKAL = 'KRUSKAL',
  FORD_FULKERSON = 'FORD_FULKERSON',
  FLEURY = 'FLEURY',
  HIERHOLZER = 'HIERHOLZER',
  CHECK_BIPARTITE = 'CHECK_BIPARTITE'
}