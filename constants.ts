import { GraphData } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const DEFAULT_NODE_RADIUS = 20;

export const SAMPLE_GRAPH_DATA: GraphData = {
  nodes: [
    { id: 'n1', x: 100, y: 100, label: 'Router A', type: 'router' },
    { id: 'n2', x: 300, y: 100, label: 'Switch 1', type: 'switch' },
    { id: 'n3', x: 100, y: 300, label: 'PC 1', type: 'pc' },
    { id: 'n4', x: 300, y: 300, label: 'Server', type: 'server' },
    { id: 'n5', x: 500, y: 200, label: 'Router B', type: 'router' },
  ],
  links: [
    { source: 'n1', target: 'n2', weight: 10 },
    { source: 'n1', target: 'n3', weight: 5 },
    { source: 'n2', target: 'n4', weight: 8 },
    { source: 'n2', target: 'n5', weight: 15 },
    { source: 'n4', target: 'n5', weight: 20 },
  ],
  isDirected: false,
};