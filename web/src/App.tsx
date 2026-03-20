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
  churnScore: number;
  inDegree: number;
  outDegree: number;
  isGodObject: boolean;
  isDeadCode: boolean;
  isCircular: boolean;
  cloneIds: string[];
  diagnostics: string[];
  color?: string;
  outerColor?: string; 
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

// RESTORED VIVID STELLAR PALETTE (v6.6.1 Style)
const STELLAR_PAIRS = [
  { inner: '#0044ff', outer: '#0022aa' }, // Class O: Deep Sapphire
  { inner: '#00d4ff', outer: '#0088ff' }, // Class B: Electric Cyan
  { inner: '#ffffff', outer: '#cae1ff' }, // Class A: Brilliant White
  { inner: '#ffee00', outer: '#ffaa00' }, // Class F/G: Solar Gold
  { inner: '#ff8800', outer: '#ff4400' }, // Class K: Plasma Orange
  { inner: '#f0f0f0', outer: '#a0a0a0' }, // Class M: Moonlight Silver
  { inner: '#bd00ff', outer: '#7000ff' }  // Bonus: Pulsar Purple
];

const textureCache: Record<string, THREE.CanvasTexture> = {};

/**
 * RESTORED STELLAR CORONA GENERATOR (v6.6.1 Style)
 */
const getMasterNodeTexture = (inner: string, outer: string, churn: number, isCircular: boolean, isClone: boolean) => {
  const cacheKey = `${inner}_${outer}_${churn}_${isCircular}_${isClone}_v81`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    const cx = 64;
    const cy = 64;

    // 1. Aura Layer (Red for cycles, Purple for clones, Orange for churn)
    let auraColor = null;
    if (isCircular) auraColor = '#ff0000';
    else if (isClone) auraColor = '#bd00ff';
    else if (churn > 70) auraColor = '#ffaa00';

    if (auraColor) {
        const auraGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 64);
        auraGrad.addColorStop(0, auraColor + '66');
        auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = auraGrad;
        ctx.fillRect(0, 0, 128, 128);
    }

    // 2. High-Density Star Core (Original Vivid Colors)
    const starGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 45);
    starGrad.addColorStop(0, '#ffffff'); // Pure hot core
    starGrad.addColorStop(0.08, '#ffffff');
    starGrad.addColorStop(0.2, inner);   
    starGrad.addColorStop(0.6, outer);   
    starGrad.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fill();

    // 3. Status Markers (Enhanced for visibility)
    if (isCircular || isClone) {
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'black';
        ctx.fillStyle = isCircular ? '#ff0000' : '#bd00ff';
        ctx.fillText(isCircular ? '⚠' : '❐', cx, cy - 35);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  textureCache[cacheKey] = texture;
  return texture;
};

export default function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'CYCLE' | 'CLONE' | 'DEBT'>('ALL');
  const [impactNodes, setImpactNodes] = useState<Set<string>>(new Set());
  
  const fgRef = useRef<any>();

  useEffect(() => {
    fetch('/project_data.json')
      .then(res => res.json())
      .then(raw => {
        const inDegrees = raw.nodes.map((n: Node) => n.inDegree);
        const maxInDeg = Math.max(...inDegrees, 1);

        const nodes = raw.nodes.map((n: Node) => {
          const norm = n.inDegree / maxInDeg;
          const pairIdx = Math.floor((1 - norm) * (STELLAR_PAIRS.length - 1));
          const pair = STELLAR_PAIRS[pairIdx];

          const baseSize = Math.sqrt(n.val || 1) * 3 + 12; 
          const importanceSize = (n.inDegree / maxInDeg) * 25;

          return {
            ...n,
            color: pair.inner,
            outerColor: pair.outer,
            size: baseSize + importanceSize
          };
        });

        setData({ nodes, links: raw.links });
      });
  }, []);

  useEffect(() => {
    if (fgRef.current && data) {
      setTimeout(() => {
        fgRef.current.d3Force('link').distance(220);
        fgRef.current.d3Force('charge').strength(-1200); 
        fgRef.current.d3Force('collide', (node: any) => (node.size || 15) + 15);
      }, 100);
    }
  }, [data]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    const impacted = new Set<string>();
    data?.links.forEach((l: any) => {
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      if (targetId === node.id) impacted.add(sourceId);
    });
    setImpactNodes(impacted);

    const distance = 250;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500);
  }, [data]);

  const nodeThreeObject = useCallback((node: any) => {
    let opacity = 1.0;
    
    // Filter logic
    if (filter === 'CYCLE' && !node.isCircular) opacity = 0.05;
    if (filter === 'CLONE' && node.cloneIds.length === 0) opacity = 0.05;
    if (filter === 'DEBT' && !node.isGodObject && !node.isDeadCode) opacity = 0.05;

    // Selection highlight
    if (selectedNode && selectedNode.id !== node.id && !impactNodes.has(node.id)) opacity *= 0.1;

    const material = new THREE.SpriteMaterial({
      map: getMasterNodeTexture(node.color!, node.outerColor!, node.churnScore, node.isCircular, node.cloneIds.length > 0),
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false 
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(node.size!, node.size!, 1);
    return sprite;
  }, [filter, selectedNode, impactNodes]);

  if (!data) return <div style={{ color: 'white', padding: 40, fontFamily: 'monospace' }}>🛰️ RECONNECTING TO VIVID CORE...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000005', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `
          <div style="background:rgba(0,0,0,0.95); padding:15px; border-radius:8px; border:1px solid ${node.outerColor}; color:white; font-family:monospace;">
            <b style="color:${node.outerColor}; font-size:1.2rem;">${node.name}</b><br/>
            <span style="opacity:0.6">${node.file}</span>
          </div>
        `}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(255, 255, 255, 0.03)'} 
        linkWidth={0.5}
        backgroundColor="#000005"
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
      />

      {/* Control HUD */}
      <div style={{ position: 'absolute', top: 40, left: 40, pointerEvents: 'none', borderLeft: '5px solid white', paddingLeft: 30 }}>
        <h1 style={{ margin: 0, fontSize: '3rem', color: '#fff', letterSpacing: 12, fontWeight: 900, textTransform: 'uppercase' }}>REPO GAZER</h1>
        <div style={{ color: '#00fbff', fontSize: '0.9rem', fontWeight: 900, letterSpacing: 5, marginTop: 10 }}>STRUCTURAL DIAGNOSTICS v8.1</div>
        
        {/* Diagnostic Filters */}
        <div style={{ marginTop: 30, display: 'flex', gap: 10, pointerEvents: 'auto' }}>
          {[
            { id: 'ALL', label: '전체 (ALL)', color: '#888' },
            { id: 'CYCLE', label: '순환참조 (CYCLES)', color: '#ff0000' },
            { id: 'CLONE', label: '코드중복 (CLONES)', color: '#bd00ff' },
            { id: 'DEBT', label: '기술부채 (DEBT)', color: '#ffcc00' }
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
              background: filter === f.id ? f.color : '#111',
              color: filter === f.id ? '#000' : '#fff',
              border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 900, fontSize: '0.75rem', letterSpacing: 1
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 550, 
          background: 'rgba(5, 5, 10, 1.0)', borderLeft: '1px solid #333', 
          padding: 60, overflowY: 'auto', color: '#fff', zIndex: 100,
          boxShadow: '-50px 0 100px rgba(0,0,0,1)'
        }}>
          <button onClick={() => setSelectedNode(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 40 }}>✕</button>
          
          <h2 style={{ color: selectedNode.outerColor, fontSize: '3rem', margin: '15px 0 10px 0', fontWeight: 900 }}>{selectedNode.name}</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '1rem', fontWeight: 'bold' }}>SOURCE: {selectedNode.file.toUpperCase()}</p>
          
          <div style={{ marginTop: 50 }}>
            <h4 style={{ color: '#444', letterSpacing: 3, fontSize: '0.8rem' }}>ARCHITECTURAL DIAGNOSIS</h4>
            <div style={{ marginTop: 20 }}>
              {selectedNode.diagnostics && selectedNode.diagnostics.length > 0 ? (
                selectedNode.diagnostics.map((d, i) => (
                  <div key={i} style={{ padding: 25, background: '#110505', borderLeft: '4px solid #ff0000', marginBottom: 15, fontSize: '1rem', lineHeight: 1.7 }}>{d}</div>
                ))
              ) : (
                <div style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '1.1rem' }}>✅ HEALTHY COMPONENT</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 50, display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            <div style={{ background: '#0a0a0f', padding: 30, borderLeft: '4px solid ' + selectedNode.outerColor }}>
              <div style={{ fontSize: '0.7rem', color: '#444', marginBottom: 10, letterSpacing: 2 }}>PRIMARY OWNER</div>
              <div style={{ fontWeight: 900, fontSize: '1.4rem' }}>{selectedNode.author.toUpperCase()}</div>
            </div>
            <div style={{ background: '#1a0505', padding: 30, borderLeft: '4px solid #ff0000' }}>
              <div style={{ fontSize: '0.7rem', color: '#ff6666', marginBottom: 10, letterSpacing: 2 }}>IMPACT RADIUS</div>
              <div style={{ fontWeight: 900, fontSize: '1.8rem' }}>{impactNodes.size} Dependent Modules</div>
            </div>
          </div>

          <div style={{ marginTop: 50 }}>
            <h4 style={{ color: '#222', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: 4, marginBottom: 20 }}>Source Implementation</h4>
            <pre style={{ 
              background: '#000', padding: 40, borderRadius: 2, fontSize: '0.9rem', 
              overflowX: 'auto', border: '1px solid #111', color: '#aaa', lineHeight: 1.8
            }}>
              <code>{selectedNode.snippet}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
