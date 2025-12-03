
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

export interface AlgorithmStep {
  visited?: string[];
  path?: string[];
  currentNodeId?: string | null; // The node currently being processed
  currentLinkId?: { source: string, target: string } | null; // The link currently being processed
  mstLinks?: Link[];
  traversedEdges?: Link[];
  flowDetails?: Record<string, number>;
  bipartiteSets?: { setA: string[], setB: string[] }; // Added for Bipartite Animation
  log: string; // The specific log for this step
}

export interface AlgorithmResult {
  // Final Results
  path?: string[]; 
  visited?: string[]; 
  mstLinks?: Link[]; 
  traversedEdges?: Link[]; 
  maxFlow?: number; 
  flowDetails?: Record<string, number>; 
  logs: string[];
  isBipartite?: boolean;
  bipartiteSets?: { setA: string[], setB: string[] };
  eulerPath?: string[];
  
  // Animation Data
  steps?: AlgorithmStep[];
}

export enum AlgorithmType {
  NONE = 'NONE',
  BFS = 'BFS',
  DFS = 'DFS',
  DIJKSTRA = 'DIJKSTRA',
  BELLMAN_FORD = 'BELLMAN_FORD',
  PRIM = 'PRIM',
  KRUSKAL = 'KRUSKAL',
  FORD_FULKERSON = 'FORD_FULKERSON',
  FLEURY = 'FLEURY',
  HIERHOLZER = 'HIERHOLZER',
  CHECK_BIPARTITE = 'CHECK_BIPARTITE'
}