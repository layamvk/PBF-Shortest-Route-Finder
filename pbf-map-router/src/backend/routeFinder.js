function buildGraph(nodes, ways) {
  console.log('🔗 Building graph...');
  const startTime = Date.now();
  const graph = {};

  let edgeCount = 0;
  const processedNodes = new Set();

  ways.forEach((way, idx) => {
    if (idx % 10000 === 0 && idx > 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Processing way ${idx.toLocaleString()}/${ways.length.toLocaleString()}... (${elapsed}s)`);
    }

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromId = way.nodes[i];
      const toId = way.nodes[i + 1];
      
      const from = fromId.toString();
      const to = toId.toString();

      if (nodes[from] && nodes[to]) {
        if (!graph[from]) graph[from] = [];
        if (!graph[to]) graph[to] = [];

        const dist = calculateDistance(nodes[from], nodes[to]);

        graph[from].push({ to, dist });
        graph[to].push({ to: from, dist });
        edgeCount += 2;
        
        processedNodes.add(from);
        processedNodes.add(to);
      }
    }
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Graph ready! ${edgeCount.toLocaleString()} edges, ${processedNodes.size.toLocaleString()} connected nodes (${elapsed}s)`);
  return graph;
}

function calculateDistance(node1, node2) {
  const R = 6371; 
  const dLat = (node2.lat - node1.lat) * Math.PI / 180;
  const dLon = (node2.lon - node1.lon) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(node1.lat * Math.PI / 180) * Math.cos(node2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function dijkstraPath(graph, start, end, withSteps = false) {
  return dijkstraPathJS(graph, start, end, withSteps);
}

function dijkstraPathJS(graph, start, end, withSteps = false) {
  const distances = {};
  const previous = {};
  const visited = new Set();
  const explored = [];
  const allVisitedEdges = [];
  const waveFront = [];
  const updated = [];

  Object.keys(graph).forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  distances[start] = 0;

  const heap = new MinPriorityQueue();
  heap.enqueue(start, 0);

  let iterations = 0;
  let destinationFound = false;
  let destinationFoundAt = 0;
  const maxExplorationAfterDestination = 50;

  while (!heap.isEmpty()) {
    iterations++;
    const { element: current } = heap.dequeue();

    if (visited.has(current)) continue;
    visited.add(current);

    if (withSteps) {
      explored.push({
        node: current,
        distance: distances[current],
        iteration: iterations
      });
      
      if (graph[current] && allVisitedEdges.length < 100000) {
        const sampleRate = Math.max(1, Math.floor(graph[current].length / 10));
        graph[current].forEach((neighbor, idx) => {
          if (idx % sampleRate === 0 || allVisitedEdges.length < 50000) {
            allVisitedEdges.push({
              from: current,
              to: neighbor.to,
              iteration: iterations,
              distance: distances[current] + neighbor.dist
            });
          }
        });
      }
    }

    if (current === end && !destinationFound) {
      destinationFound = true;
      destinationFoundAt = iterations;
      console.log(`✅ Route found at iteration ${iterations}! Continuing exploration...`);
    }
    
    if (destinationFound && iterations > destinationFoundAt + maxExplorationAfterDestination * 2) {
      console.log(`🌊 Exploration complete after ${iterations} iterations (${allVisitedEdges.length} edges tracked)`);
      break;
    }

    if (!graph[current]) continue;

    graph[current].forEach(neighbor => {
      const alt = distances[current] + neighbor.dist;
      
      if (alt < distances[neighbor.to]) {
        distances[neighbor.to] = alt;
        previous[neighbor.to] = current;
        heap.enqueue(neighbor.to, alt);
        
        if (withSteps) {
          updated.push({
            from: current,
            to: neighbor.to,
            distance: alt,
            iteration: iterations
          });
        }
      }
    });
    
    if (withSteps) {
      const waveNodes = [];
      graph[current] && graph[current].forEach(neighbor => {
        waveNodes.push({
          from: current,
          to: neighbor.to,
          distance: distances[current] + neighbor.dist
        });
      });
      waveFront.push({
        iteration: iterations,
        centerNode: current,
        edges: waveNodes
      });
    }
  }

  const path = [];
  let current = end;
  
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path: path.length > 1 && distances[end] !== Infinity ? path : null,
    distance: distances[end],
    explored: withSteps ? explored : undefined,
    updated: withSteps ? updated : undefined,
    allVisitedEdges: withSteps ? allVisitedEdges : undefined,
    waveFront: withSteps ? waveFront : undefined,
    iterations: iterations
  };
}

class MinPriorityQueue {
  constructor() {
    this.heap = [];
  }

  enqueue(element, priority) {
    this.heap.push({ element, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._sinkDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (element.priority >= parent.priority) break;
      this.heap[index] = parent;
      this.heap[parentIndex] = element;
      index = parentIndex;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      let leftChildIndex = 2 * index + 1;
      let rightChildIndex = 2 * index + 2;
      let swap = null;

      if (leftChildIndex < length) {
        if (this.heap[leftChildIndex].priority < element.priority) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        if (
          (swap === null && this.heap[rightChildIndex].priority < element.priority) ||
          (swap !== null && this.heap[rightChildIndex].priority < this.heap[leftChildIndex].priority)
        ) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      index = swap;
    }
  }
}

module.exports = { dijkstraPath, buildGraph };