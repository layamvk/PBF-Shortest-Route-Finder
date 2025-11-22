const fs = require('fs');
const path = require('path');

async function parsePBFFile(filePath) {
  const { createOSMStream } = await import('osm-pbf-parser-node');

  const nodeRefs = new Set();
  const ways = [];
  let nodeCounter = 0;
  let wayCounter = 0;
  const startTime = Date.now();

  console.log('📂 Starting memory-optimized PBF parse...');
  console.log(`📊 File: ${path.basename(filePath)}`);

  const stats = fs.statSync(filePath);
  console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const opts = {
    withTags: false,
    withInfo: false
  };

  try {
    console.log('🔄 Phase 1: Scanning ways to identify used nodes...');

    for await (const item of createOSMStream(filePath, opts)) {
      if (item.type === 'way') {
        wayCounter++;
        
        if (wayCounter % 10000 === 0) {
          console.log(`  🛣️  Scanned ${wayCounter.toLocaleString()} ways...`);
        }

        if (item.refs && item.refs.length >= 2) {
          item.refs.forEach(nodeId => nodeRefs.add(nodeId.toString()));
          ways.push({
            id: item.id,
            nodes: item.refs
          });
        }
      }
    }

    console.log(`✅ Phase 1 complete: ${ways.length.toLocaleString()} ways, ${nodeRefs.size.toLocaleString()} unique nodes needed`);

    console.log('🔄 Phase 2: Loading only nodes used in ways...');
    const nodes = {};
    let nodesLoaded = 0;

    for await (const item of createOSMStream(filePath, opts)) {
      if (item.type === 'node') {
        nodeCounter++;
        
        const nodeIdStr = item.id.toString();
        if (nodeRefs.has(nodeIdStr) && item.lat !== undefined && item.lon !== undefined) {
          nodes[nodeIdStr] = {
            id: nodeIdStr,
            lat: item.lat,
            lon: item.lon
          };
          nodesLoaded++;
        }
        
        if (nodeCounter % 100000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  📍 Scanned ${nodeCounter.toLocaleString()} nodes, loaded ${nodesLoaded.toLocaleString()} used nodes (${elapsed}s)`);
        }
      }
    }
    
    nodeRefs.clear();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    console.log(`✅ Parsing complete!`);
    console.log(`   📍 Total nodes scanned: ${nodeCounter.toLocaleString()}`);
    console.log(`   📍 Nodes stored (used in ways): ${nodesLoaded.toLocaleString()}`);
    console.log(`   🛣️  Ways: ${wayCounter.toLocaleString()}`);
    console.log(`   ⏱️  Time: ${elapsed}s`);
    console.log(`   💾 Memory: ${memoryMB} MB`);
    const totalItems = nodeCounter + wayCounter;
    if (totalItems > 0) {
      console.log(`   📊 Rate: ${(totalItems / ((Date.now() - startTime) / 1000) / 1000).toFixed(0)}k items/sec`);
    }

    return {
      nodes,
      ways,
      nodeCount: nodesLoaded,
      wayCount: wayCounter
    };

  } catch (error) {
    console.error('❌ Parser error:', error.message);
    throw new Error('Failed to parse PBF: ' + error.message);
  }
}

module.exports = { parsePBFFile };
