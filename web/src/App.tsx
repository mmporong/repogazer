import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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

// Predefined Neon Palette for Galaxy Clusters
const NEON_PALETTE = [
  '#00d4ff', '#ff00ff', '#ffff00', '#00ff00', '#ff4d00', 
  '#bd00ff', '#00ffcc', '#ff0055', '#aaff00', '#0055ff'
];

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
        // Assign vivid palette colors to files
        const fileColors: Record<string, string> = {};
        let colorIdx = 0;
        raw.nodes.forEach((n: Node) => {
          if (!fileColors[n.file]) {
            fileColors[n.file] = NEON_PALETTE[colorIdx % NEON_PALETTE.length];
            colorIdx++;
          }
        });

        const nodes = raw.nodes.map((n: Node) => ({
          ...n,
          color: fileColors[n.file]
        }));

        setData({ nodes, links: raw.links });
      });
  }, []);

  // Blast Radius Logic
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
    const distance = 150;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      1200
    );
  }, []);

  const nodeThreeObject = useCallback((node: any) => {
    let colorHex = node.color || '#00d4ff';
    let size = Math.sqrt(node.val || 1) * 1.2 + 2;
    let opacity = 0.8;
    let emissiveIntensity = 0.4;

    if (viewMode === 'HEATMAP') {
      const heat = node.churnScore || 0;
      colorHex = heat > 80 ? '#ff0033' : heat > 50 ? '#ffcc00' : heat > 20 ? '#00ffcc' : '#3366ff';
      emissiveIntensity = heat / 100 + 0.2;
    } 
    else if (viewMode === 'DEBT') {
      if (node.isGodObject) { colorHex = '#ff0055'; size = 18; emissiveIntensity = 1.0; }
      else if (node.isDeadCode) { colorHex = '#444444'; size = 1.5; opacity = 0.2; }
      else { colorHex = '#113311'; opacity = 0.1; }
    }
    else if (viewMode === 'BLAST') {
      if (selectedNode?.id === node.id) { colorHex = '#ffffff'; size = 10; emissiveIntensity = 1.5; }
      else if (blastNodes.has(node.id)) { colorHex = '#ff0000'; emissiveIntensity = 1.0; }
      else if (secondaryBlast.has(node.id)) { colorHex = '#ffaa00'; emissiveIntensity = 0.7; }
      else { colorHex = '#0a1122'; opacity = 0.1; emissiveIntensity = 0; }
    } else {
      // Default Galaxy: Size by importance
      size += (node.inDegree || 0) * 0.8;
    }

    const color = new THREE.Color(colorHex);
    const geometry = new THREE.SphereGeometry(size, 20, 20);
    const material = new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      shininess: 100,
      emissive: color,
      emissiveIntensity: emissiveIntensity
    });
    
    return new THREE.Mesh(geometry, material);
  }, [viewMode, selectedNode, blastNodes, secondaryBlast]);

  if (!data) return <div style={{ color: 'white', padding: 20 }}>Booting Galaxy Core...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000005', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `
          <div style="background:rgba(0,0,0,0.9); padding:8px; border-radius:6px; border:1px solid ${node.color}; color:white; font-family:monospace;">
            <b style="color:${node.color}">${node.name}</b><br/>
            <span style="font-size:0.8rem; opacity:0.7">${node.file}</span><br/>
            <hr style="border:0; border-top:1px solid #333; margin:5px 0;"/>
            <span>Owner: ${node.author}</span><br/>
            <span>Impact: ${node.inDegree} callers</span>
          </div>
        `}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={viewMode === 'BLAST' ? 0 : 3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={(link: any) => {
          if (viewMode === 'BLAST') {
            const tgt = typeof link.target === 'object' ? link.target.id : link.target;
            const src = typeof link.source === 'object' ? link.source.id : link.source;
            if (tgt === selectedNode?.id) return '#ff0000';
            if (blastNodes.has(tgt) && secondaryBlast.has(src)) return '#ffaa00';
            return 'rgba(255,255,255,0.01)';
          }
          return 'rgba(255,255,255,0.08)';
        }}
        linkWidth={(link: any) => viewMode === 'BLAST' ? 1.5 : 0.5}
        backgroundColor="#000005"
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        // Force nodes further apart to avoid clumping
        cooldownTicks={100}
        onEngineStop={() => console.log("Engine Stabilized")}
      />

      {/* Futuristic HUD */}
      <div style={{ position: 'absolute', top: 30, left: 30, pointerEvents: 'none', borderLeft: '3px solid #00d4ff', paddingLeft: 20 }}>
        <h1 style={{ margin: 0, fontSize: '2.2rem', color: '#fff', letterSpacing: 4, fontWeight: 900 }}>REPO GAZER</h1>
        <div style={{ color: '#00d4ff', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: 2 }}>ARCHITECTURAL INTELLIGENCE ACTIVE</div>
      </div>

      {/* Mode Controls */}
      <div style={{ 
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, background: 'rgba(5, 5, 10, 0.85)', padding: '12px 25px', 
        borderRadius: 40, border: '1px solid #333', backdropFilter: 'blur(12px)', boxShadow: '0 0 30px rgba(0,0,0,0.8)'
      }}>
        {[
          { id: 'GALAXY', icon: '🌌', label: 'Galaxy' },
          { id: 'HEATMAP', icon: '🔥', label: 'Heatmap' },
          { id: 'BLAST', icon: '💥', label: 'Blast' },
          { id: 'DEBT', icon: '🔎', label: 'Debt' }
        ].map(mode => (
          <button 
            key={mode.id}
            onClick={() => setViewMode(mode.id as ViewMode)}
            style={{
              padding: '10px 22px', borderRadius: 25, border: 'none', cursor: 'pointer',
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem',
              background: viewMode === mode.id ? 'linear-gradient(135deg, #00d4ff, #0055ff)' : 'transparent',
              color: viewMode === mode.id ? '#000' : '#888',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              transform: viewMode === mode.id ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <span>{mode.icon}</span> {mode.label}
          </button>
        ))}
      </div>

      {/* Node Info Sidebar */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 450, 
          background: 'rgba(2, 2, 5, 0.96)', borderLeft: '1px solid #222', 
          padding: 40, overflowY: 'auto', color: '#fff', zIndex: 100,
          boxShadow: '-20px 0 50px rgba(0,0,0,0.9)'
        }}>
          <button onClick={() => setSelectedNode(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 28 }}>✕</button>
          
          <h2 style={{ color: selectedNode.color, fontSize: '2.4rem', margin: '10px 0', fontWeight: 900 }}>{selectedNode.name}</h2>
          <div style={{ display: 'flex', gap: 12, marginBottom: 30 }}>
            <span style={{ border: `1px solid ${selectedNode.color}`, color: selectedNode.color, padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 'bold' }}>{selectedNode.file}</span>
            <span style={{ background: '#111', color: '#888', padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem' }}>LINE {selectedNode.line}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, margin: '20px 0' }}>
            <div style={{ background: '#08080a', padding: 15, borderRadius: 12, border: '1px solid #15151a' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 5 }}>LEAD AUTHOR</div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{selectedNode.author}</div>
            </div>
            <div style={{ background: '#08080a', padding: 15, borderRadius: 12, border: '1px solid #15151a' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 5 }}>MODIFICATION CHURN</div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: selectedNode.churnScore > 70 ? '#ff0033' : '#00ffcc' }}>{selectedNode.churnScore}%</div>
            </div>
          </div>

          <div style={{ marginTop: 30 }}>
            <h4 style={{ color: '#444', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 2, marginBottom: 15 }}>C# Implementation</h4>
            <pre style={{ 
              background: '#000', padding: 25, borderRadius: 15, fontSize: '0.85rem', 
              overflowX: 'auto', border: '1px solid #111', color: '#ccc', lineWeight: 1.6,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,1)'
            }}>
              <code style={{ fontFamily: 'Fira Code, monospace' }}>{selectedNode.snippet}</code>
            </pre>
          </div>

          {selectedNode.isGodObject && (
            <div style={{ marginTop: 30, padding: 20, background: 'rgba(255,0,85,0.05)', borderLeft: '4px solid #ff0055', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#ff0055', fontSize: '0.8rem' }}>⚠️ ARCHITECTURAL DEBT</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>This function acts as a <b>God Object</b>. It has {selectedNode.outDegree} outbound dependencies, making it a critical point of failure.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
