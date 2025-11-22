const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const { parsePBFFile } = require('./pbfParser');
const { dijkstraPath, buildGraph } = require('./routeFinder');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: config.MAX_FILE_SIZE }
});

if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

let currentMapData = { 
  nodes: {}, 
  ways: [], 
  graph: {}
};

let parseInProgress = false;

function cleanupMemory() {
  if (global.gc) {
    global.gc();
    console.log(' Memory cleanup triggered');
  }
}

app.post('/api/load-local-pbf', async (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'No filename provided' });
  }

  if (parseInProgress) {
    return res.status(400).json({ error: 'Parse already in progress' });
  }

  try {
    parseInProgress = true;

    let filePath = path.join(config.UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      const dataDir = path.join(__dirname, '../../data');
      filePath = path.join(dataDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: `File not found: ${filename}` });
      }
    }

    console.log(` Loading: ${filename}`);
    console.log(` Path: ${filePath}`);

    const stats = fs.statSync(filePath);
    console.log(` Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    const parsed = await parsePBFFile(filePath);

    console.log(` Parsed ${Object.keys(parsed.nodes).length} nodes`);

    const graph = buildGraph(parsed.nodes, parsed.ways);

    currentMapData = {
      nodes: parsed.nodes,
      ways: parsed.ways,
      graph: graph
    };

    console.log(' Ready for routing');

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    const nodeValues = Object.values(parsed.nodes);
    if (nodeValues.length > 0) {
      nodeValues.forEach(node => {
        if (node.lat < minLat) minLat = node.lat;
        if (node.lat > maxLat) maxLat = node.lat;
        if (node.lon < minLon) minLon = node.lon;
        if (node.lon > maxLon) maxLon = node.lon;
      });
    }

    parseInProgress = false;

    res.json({
      success: true,
      nodeCount: Object.keys(parsed.nodes).length,
      wayCount: parsed.ways.length,
      message: `Loaded ${filename}`,
      bounds: nodeValues.length > 0 ? {
        minLat: minLat,
        maxLat: maxLat,
        minLon: minLon,
        maxLon: maxLon,
        centerLat: (minLat + maxLat) / 2,
        centerLon: (minLon + maxLon) / 2
      } : null
    });

  } catch (err) {
    parseInProgress = false;
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload-pbf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (parseInProgress) {
    return res.status(400).json({ error: 'Parse already in progress' });
  }

  try {
    parseInProgress = true;
    const filePath = req.file.path;
    
    const parsed = await parsePBFFile(filePath);

    const graph = buildGraph(parsed.nodes, parsed.ways);

    currentMapData = {
      nodes: parsed.nodes,
      ways: parsed.ways,
      graph: graph
    };

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    const nodeValues = Object.values(parsed.nodes);
    if (nodeValues.length > 0) {
      nodeValues.forEach(node => {
        if (node.lat < minLat) minLat = node.lat;
        if (node.lat > maxLat) maxLat = node.lat;
        if (node.lon < minLon) minLon = node.lon;
        if (node.lon > maxLon) maxLon = node.lon;
      });
    }

    fs.unlinkSync(filePath);

    parseInProgress = false;

    res.json({
      success: true,
      nodeCount: Object.keys(parsed.nodes).length,
      wayCount: parsed.ways.length,
      bounds: nodeValues.length > 0 ? {
        minLat: minLat,
        maxLat: maxLat,
        minLon: minLon,
        maxLon: maxLon,
        centerLat: (minLat + maxLat) / 2,
        centerLon: (minLon + maxLon) / 2
      } : null
    });

  } catch (err) {
    parseInProgress = false;
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/list-files', (req, res) => {
  try {
    const files = new Set();
    
    if (fs.existsSync(config.UPLOAD_DIR)) {
      const uploadFiles = fs.readdirSync(config.UPLOAD_DIR)
        .filter(f => f.endsWith('.pbf') || f.endsWith('.osm.pbf'));
      uploadFiles.forEach(f => files.add(f));
    }
    
    const dataDir = path.join(__dirname, '../../data');
    if (fs.existsSync(dataDir)) {
      const dataFiles = fs.readdirSync(dataDir)
        .filter(f => f.endsWith('.pbf') || f.endsWith('.osm.pbf'));
      dataFiles.forEach(f => files.add(f));
    }
    
    res.json({ files: Array.from(files) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/find-route', (req, res) => {
  const { start, end, animate = false } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'No start/end node' });
  }

  if (Object.keys(currentMapData.graph).length === 0) {
    return res.status(400).json({ error: 'No map loaded' });
  }

  try {
    const result = dijkstraPath(currentMapData.graph, start.toString(), end.toString(), animate);

    if (!result.path) {
      return res.json({ error: 'No path found' });
    }

    const pathCoords = result.path.map(nodeId => {
      const node = currentMapData.nodes[nodeId];
      return { id: nodeId, lat: node.lat, lon: node.lon };
    });

    const exploredCoords = animate && result.explored ? result.explored
      .slice(0, 10000)
      .map(exploredNode => {
        const node = currentMapData.nodes[exploredNode.node];
        return node ? { 
          id: exploredNode.node, 
          lat: node.lat, 
          lon: node.lon,
          distance: exploredNode.distance,
          iteration: exploredNode.iteration
        } : null;
      }).filter(n => n !== null) : [];

    const allVisitedEdges = animate && result.allVisitedEdges ? result.allVisitedEdges
      .slice(0, 30000)
      .map(edge => {
        const fromNode = currentMapData.nodes[edge.from];
        const toNode = currentMapData.nodes[edge.to];
        if (fromNode && toNode) {
          return {
            from: { id: edge.from, lat: fromNode.lat, lon: fromNode.lon },
            to: { id: edge.to, lat: toNode.lat, lon: toNode.lon },
            iteration: edge.iteration,
            distance: edge.distance
          };
        }
        return null;
      }).filter(e => e !== null) : [];

    const waveFront = animate && result.waveFront ? result.waveFront.map(wave => {
      const centerNode = currentMapData.nodes[wave.centerNode];
      const edges = wave.edges.map(edge => {
        const fromNode = currentMapData.nodes[edge.from];
        const toNode = currentMapData.nodes[edge.to];
        if (fromNode && toNode) {
          return {
            from: { id: edge.from, lat: fromNode.lat, lon: fromNode.lon },
            to: { id: edge.to, lat: toNode.lat, lon: toNode.lon },
            distance: edge.distance
          };
        }
        return null;
      }).filter(e => e !== null);
      
      return {
        iteration: wave.iteration,
        center: centerNode ? { id: wave.centerNode, lat: centerNode.lat, lon: centerNode.lon } : null,
        edges: edges
      };
    }).filter(w => w.center !== null) : [];

    const updatedEdges = animate && result.updated ? result.updated.map(edge => {
      const fromNode = currentMapData.nodes[edge.from];
      const toNode = currentMapData.nodes[edge.to];
      if (fromNode && toNode) {
        return {
          from: { id: edge.from, lat: fromNode.lat, lon: fromNode.lon },
          to: { id: edge.to, lat: toNode.lat, lon: toNode.lon },
          distance: edge.distance,
          iteration: edge.iteration
        };
      }
      return null;
    }).filter(e => e !== null) : [];

    res.json({
      success: true,
      path: result.path,
      pathCoords: pathCoords,
      distance: result.distance,
      nodeCount: result.path.length,
      explored: exploredCoords,
      updatedEdges: updatedEdges,
      allVisitedEdges: allVisitedEdges,
      waveFront: waveFront,
      iterations: result.iterations
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ways', (req, res) => {
  const limit = parseInt(req.query.limit) || 1000;
  const ways = currentMapData.ways.slice(0, limit);
  
  const waysWithCoords = ways.map(way => {
    const coords = way.nodes
      .map(nodeId => {
        const node = currentMapData.nodes[nodeId.toString()];
        return node ? [node.lat, node.lon] : null;
      })
      .filter(c => c !== null);
    
    return {
      id: way.id,
      coords: coords
    };
  }).filter(way => way.coords.length >= 2);

  res.json({ ways: waysWithCoords });
});

app.get('/api/map-info', (req, res) => {
  res.json({
    nodeCount: Object.keys(currentMapData.nodes).length,
    wayCount: currentMapData.ways.length,
    loaded: Object.keys(currentMapData.nodes).length > 0
  });
});

app.get('/api/nodes', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  const nodes = Object.values(currentMapData.nodes).slice(0, limit);
  res.json(nodes);
});

app.get('/api/node/:id', (req, res) => {
  const nodeId = req.params.id;
  const node = currentMapData.nodes[nodeId];
  
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }
  
  const neighbors = currentMapData.graph[nodeId] || [];
  
  res.json({
    ...node,
    neighborCount: neighbors.length,
    neighbors: neighbors.slice(0, 10).map(n => ({
      nodeId: n.to,
      distance: n.dist
    }))
  });
});

app.post('/api/search-nodes', (req, res) => {
  const { minLat, maxLat, minLon, maxLon, limit = 100 } = req.body;
  
  if (!minLat || !maxLat || !minLon || !maxLon) {
    return res.status(400).json({ error: 'Bounds required' });
  }
  
  const nodes = Object.values(currentMapData.nodes)
    .filter(node => 
      node.lat >= minLat && node.lat <= maxLat &&
      node.lon >= minLon && node.lon <= maxLon
    )
    .slice(0, limit);
  
  res.json(nodes);
});

const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`\nServer running on http://localhost:${PORT}\n`);
  console.log(`Serving frontend from: ${path.join(__dirname, '../frontend')}`);
  console.log(`Upload directory: ${config.UPLOAD_DIR}`);
  console.log(`Data directory: ${path.join(__dirname, '../../data')}`);
  console.log(`\nReady to accept connections!\n`);
});