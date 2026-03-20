import { useEffect, useState, useCallback, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  file: string;
  line: number;
  val: number; 
  snippet: string;
  author: string;
  lastModified: string;
  churnScore: number;
  inDegree: number;
  outDegree: number;
  isGodObject: boolean;
  isDeadCode: boolean;
  color?: string;
  size?: number; 
}

interface Link {
  source: string | Node;
  target: string | Node;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

type ViewMode = 'GALAXY' | 'HEATMAP' | 'BLAST' | 'DEBT';

// Deep Space Nebula Palette (Researched)
const NEBULA_PALETTE = [
  '#AC3AF2', // Cosmic Purple
  '#8CBDF8', // Nimbus Blue
  '#FF5BD3', // Neon Pink (Bloom)
  '#7EF0C1', // Mint Glow
  '#6E55D7', // Astral Violet
  '#1B8E7D'  // Seafoam Nebula
];

// Cache for generated gradient textures to save memory
const textureCache: Record<string, THREE.CanvasTexture> = {};

// Generator for True Gradient Nebula Stars
const getGlowTexture = (colorHex: string, mode: ViewMode = 'GALAXY') => {
  const cacheKey = `${colorHex}_${mode}`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Radial Gradient: Center -> Edge
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    
    if (mode === 'DEBT') {
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, colorHex);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
        gradient.addColorStop(0, '#ffffff'); // Super hot white core
        gradient.addColorStop(0.15, '#ffffff'); // Keep core solid
        gradient.addColorStop(0.4, colorHex);  // Primary color transition
        
        // Convert Hex to RGBA for smooth transparent fade
        const hex = colorHex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        gradient.addColorStop(0.7, `rgba(${r},${g},${b},0.3)`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  textureCache[cacheKey] = texture;
  return texture;
};

export default function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('GALAXY');
  const [blastNodes, setBlastNodes] = useState<Set<string>>(new Set());
  const [secondaryBlast, setSecondaryBlast] = useState<Set<string>>(new Set());
  
  const fgRef = useRef<any>();

  useEffect(() => {
    fetch('/project_data.json')
      .then(res => res.json())
      .then(raw => {
        const fileColors: Record<string, string> = {};
        let colorIdx = 0;
        raw.nodes.forEach((n: Node) => {
          const folder = n.file.split('/')[0];
          if (!fileColors[folder]) {
            fileColors[folder] = NEBULA_PALETTE[colorIdx % NEBULA_PALETTE.length];
            colorIdx++;
          }
        });

        const nodes = raw.nodes.map((n: Node) => {
          // Adjust size scale for Sprites (Sprites look smaller than geometries)
          const baseSize = Math.sqrt(n.val || 1) * 3 + 15; 
          const importanceSize = (n.inDegree || 0) * 2.5;
          return {
            ...n,
            color: fileColors[n.file.split('/')[0]],
            size: baseSize + importanceSize
          };
        });

        setData({ nodes, links: raw.links });
      })
      .catch(err => console.error("Failed to load galaxy data:", err));
  }, []);

  // Update physics safely after data loads
  useEffect(() => {
    if (fgRef.current && data) {
      setTimeout(() => {
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce) linkForce.distance(180).iterations(2);
        
        const chargeForce = fgRef.current.d3Force('charge');
        if (chargeForce) chargeForce.strength(-600); // Strong repulsion

        // Keep them from totally overlapping, but allow outer glow to mix
        fgRef.current.d3Force('collide', (node: any) => (node.size || 10) * 0.5);
      }, 100);
    }
  }, [data]);

  // Blast Radius Calculation
  useEffect(() => {
    if (viewMode === 'BLAST' && selectedNode && data) {
      const primary = new Set<string>();
      const secondary = new Set<string>();
      data.links.forEach((l: any) => {
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        if (targetId === selectedNode.id) primary.add(sourceId);
      });
      data.links.forEach((l: any) => {
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        if (primary.has(targetId)) secondary.add(sourceId);
      });
      setBlastNodes(primary);
      setSecondaryBlast(secondary);
    } else {
      setBlastNodes(new Set());
      setSecondaryBlast(new Set());
    }
  }, [viewMode, selectedNode, data]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    const distance = 300;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      1500
    );
  }, []);

  // GRADIENT STAR SPRITE CREATION (The Kick)
  const nodeThreeObject = useCallback((node: any) => {
    let colorHex = node.color || '#8CBDF8';
    let size = node.size || 15;
    let opacity = 1.0;

    if (viewMode === 'HEATMAP') {
      const heat = node.churnScore || 0;
      // Thermal Gradient
      colorHex = heat > 80 ? '#ffffff' : heat > 50 ? '#ffcc00' : heat > 20 ? '#ff0055' : '#0a1a3a';
      if (heat <= 20) opacity = 0.2;
    } 
    else if (viewMode === 'DEBT') {
      if (node.isGodObject) { colorHex = '#ff0000'; size *= 1.5; }
      else if (node.isDeadCode) { colorHex = '#666666'; opacity = 0.5; size = 10; }
      else { colorHex = '#051105'; opacity = 0.0; } // Hide healthy nodes
    }
    else if (viewMode === 'BLAST') {
      if (selectedNode?.id === node.id) { colorHex = '#ffffff'; size *= 1.5; }
      else if (blastNodes.has(node.id)) { colorHex = '#ff0000'; }
      else if (secondaryBlast.has(node.id)) { colorHex = '#ffaa00'; }
      else { colorHex = '#000000'; opacity = 0.0; } // Hide unaffected
    }

    const material = new THREE.SpriteMaterial({
      map: getGlowTexture(colorHex, viewMode),
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending, // This makes overlapping colors mix like light
      depthWrite: false // Prevents sorting artifacts with transparency
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size, size, 1);
    
    return sprite;
  }, [viewMode, selectedNode, blastNodes, secondaryBlast]);

  if (!data) return <div style={{ color: 'white', padding: 40, fontFamily: 'monospace', fontSize: '1.2rem' }}>⭐ IGNITING DEEP SPACE...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#020205', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `
          <div style="background:rgba(5, 5, 10, 0.95); padding:15px; border-radius:8px; border:1px solid ${node.color}; color:white; font-family:'Segoe UI', sans-serif; box-shadow: 0 0 20px ${node.color}44;">
            <b style="color:${node.color}; font-size:1.1rem;">${node.name}</b><br/>
            <span style="font-size:0.85rem; opacity:0.6">${node.file}</span><br/>
            <div style="height:1px; background:#333; margin:8px 0;"></div>
            <div style="display:flex; justify-content:space-between; gap:20px; font-size:0.8rem;">
              <span>OWNER: <b>${node.author}</b></span>
              <span>IMPACT: <b>${node.inDegree}</b></span>
            </div>
          </div>
        `}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={viewMode === 'BLAST' ? 0 : 5}
        linkDirectionalArrowRelPos={1}
        linkColor={(link: any) => {
          if (viewMode === 'BLAST') {
            const tgt = typeof link.target === 'object' ? link.target.id : link.target;
            const src = typeof link.source === 'object' ? link.source.id : link.source;
            if (tgt === selectedNode?.id) return '#ff0000';
            if (blastNodes.has(tgt) && secondaryBlast.has(src)) return '#ffaa00';
            return 'rgba(0,0,0,0)';
          }
          return 'rgba(140, 189, 248, 0.05)'; // Deep space link color
        }}
        linkWidth={(link: any) => viewMode === 'BLAST' ? 2 : 0.6}
        backgroundColor="#020205"
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
      />

      {/* Header HUD */}
      <div style={{ position: 'absolute', top: 30, left: 30, pointerEvents: 'none', borderLeft: '4px solid #AC3AF2', paddingLeft: 20 }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', letterSpacing: 8, fontWeight: 900 }}>REPO GAZER</h1>
        <div style={{ color: '#AC3AF2', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: 4 }}>DEEP SPACE EDITION v4.0</div>
      </div>

      {/* Mode Switcher */}
      <div style={{ 
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 15, background: 'rgba(10, 10, 15, 0.95)', padding: '12px 25px', 
        borderRadius: 15, border: '1px solid #333', backdropFilter: 'blur(15px)', boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
      }}>
        {[
          { id: 'GALAXY', label: 'NEBULA MAP' },
          { id: 'HEATMAP', label: 'THERMAL' },
          { id: 'BLAST', label: 'IMPACT' },
          { id: 'DEBT', label: 'DEBT' }
        ].map(mode => (
          <button 
            key={mode.id}
            onClick={() => setViewMode(mode.id as ViewMode)}
            style={{
              padding: '10px 25px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 900, fontSize: '0.85rem', letterSpacing: 2,
              background: viewMode === mode.id ? '#AC3AF2' : 'transparent',
              color: viewMode === mode.id ? '#fff' : '#6E55D7',
              transition: 'all 0.3s ease'
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Sidebar */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 450, 
          background: 'rgba(5, 5, 10, 0.98)', borderLeft: '1px solid #222', 
          padding: 50, overflowY: 'auto', color: '#fff', zIndex: 100,
          boxShadow: '-30px 0 60px rgba(0,0,0,0.9)'
        }}>
          <button onClick={() => setSelectedNode(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 32 }}>✕</button>
          
          <h2 style={{ color: selectedNode.color, fontSize: '2.5rem', margin: '15px 0 10px 0', fontWeight: 900, lineHeight: 1 }}>{selectedNode.name}</h2>
          <p style={{ margin: 0, color: '#8CBDF8', fontSize: '1rem', fontWeight: 'bold' }}>{selectedNode.file.toUpperCase()}</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, margin: '40px 0' }}>
            <div style={{ background: '#0a0a0f', padding: 20, borderRadius: 8, border: '1px solid #1a1a25', borderLeft: '4px solid ' + selectedNode.color }}>
              <div style={{ fontSize: '0.65rem', color: '#6E55D7', marginBottom: 5, letterSpacing: 1 }}>OWNER</div>
              <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>{selectedNode.author}</div>
            </div>
            <div style={{ background: '#0a0a0f', padding: 20, borderRadius: 8, border: '1px solid #1a1a25', borderLeft: '4px solid ' + (selectedNode.churnScore > 70 ? '#FF5BD3' : '#7EF0C1') }}>
              <div style={{ fontSize: '0.65rem', color: '#6E55D7', marginBottom: 5, letterSpacing: 1 }}>STABILITY</div>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', color: selectedNode.churnScore > 70 ? '#FF5BD3' : '#7EF0C1' }}>{100 - selectedNode.churnScore}%</div>
            </div>
          </div>

          <div style={{ marginTop: 40 }}>
            <h4 style={{ color: '#6E55D7', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 3, marginBottom: 15 }}>C# Source</h4>
            <pre style={{ 
              background: '#000', padding: 25, borderRadius: 10, fontSize: '0.85rem', 
              overflowX: 'auto', border: '1px solid #111', color: '#ccc', lineHeight: 1.7
            }}>
              <code>{selectedNode.snippet}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
