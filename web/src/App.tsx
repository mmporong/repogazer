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
      .then(setData);
  }, []);

  // Blast Radius Calculation
  useEffect(() => {
    if (viewMode === 'BLAST' && selectedNode && data) {
      const primary = new Set<string>();
      const secondary = new Set<string>();
      
      // Find what relies on this node (who calls it) - the blast travels UP the call stack
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
    const distance = 120;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      1500
    );
  }, []);

  const nodeThreeObject = useCallback((node: any) => {
    let colorHex = '#00d4ff';
    let size = Math.sqrt(node.val || 1) * 1.5 + 2;
    let opacity = 0.9;
    let emissiveIntensity = 0.5;

    if (viewMode === 'HEATMAP') {
      // Hotter (higher churn) = Red, Colder = Blue
      const heat = node.churnScore || 0;
      colorHex = heat > 80 ? '#ff0000' : heat > 50 ? '#ff8800' : heat > 20 ? '#ffff00' : '#0066ff';
      if (heat > 80) emissiveIntensity = 1.0;
    } 
    else if (viewMode === 'DEBT') {
      if (node.isGodObject) {
        colorHex = '#ff0055';
        size = 15; // Massive black hole
        emissiveIntensity = 0.8;
      } else if (node.isDeadCode) {
        colorHex = '#444444';
        size = 1; // Dust
        opacity = 0.3;
        emissiveIntensity = 0.0;
      } else {
        colorHex = '#225522';
        opacity = 0.2;
      }
    }
    else if (viewMode === 'BLAST') {
      if (selectedNode?.id === node.id) {
        colorHex = '#ffffff'; // Ground zero
        size = 8;
        emissiveIntensity = 1;
      } else if (blastNodes.has(node.id)) {
        colorHex = '#ff0000'; // 1st degree burn
        emissiveIntensity = 0.9;
      } else if (secondaryBlast.has(node.id)) {
        colorHex = '#ff8800'; // 2nd degree burn
        emissiveIntensity = 0.6;
      } else {
        colorHex = '#112233'; // Unaffected
        opacity = 0.2;
        emissiveIntensity = 0;
      }
    } else {
      // GALAXY Default - Auto color by file, size by incoming connections
      size += (node.inDegree || 0) * 0.5;
    }

    const color = new THREE.Color(colorHex);
    const geometry = new THREE.SphereGeometry(size, 16, 16);
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

  if (!data) return <div style={{ color: 'white', padding: 20 }}>Initializing Matrix...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050505', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `
          <div style="background:rgba(0,0,0,0.8); padding:5px; border-radius:4px; border:1px solid #444;">
            <b>${node.name}</b><br/>
            ${node.file}<br/>
            <span style="color:#aaa">Author: ${node.author}</span><br/>
            <span style="color:${node.churnScore > 80 ? 'red' : 'green'}">Churn Score: ${node.churnScore}</span>
          </div>
        `}
        nodeAutoColorBy={viewMode === 'GALAXY' ? 'file' : undefined}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={viewMode === 'BLAST' ? 0 : 3}
        linkColor={(link: any) => {
          if (viewMode === 'BLAST') {
            const src = typeof link.source === 'object' ? link.source.id : link.source;
            const tgt = typeof link.target === 'object' ? link.target.id : link.target;
            if (tgt === selectedNode?.id) return 'rgba(255,0,0,0.8)';
            if (blastNodes.has(tgt) && secondaryBlast.has(src)) return 'rgba(255,136,0,0.6)';
            return 'rgba(255,255,255,0.02)';
          }
          return 'rgba(255,255,255,0.1)';
        }}
        linkWidth={(link: any) => viewMode === 'BLAST' ? 1 : 0.3}
        backgroundColor="#050505"
      />

      {/* Header */}
      <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'none' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', color: '#fff', textShadow: '0 0 10px #00d4ff' }}>REPO GAZER 3.0</h1>
        <div style={{ color: '#00d4ff', fontSize: '0.9rem', marginTop: 5 }}>THE ULTIMATE CODE INTELLIGENCE</div>
      </div>

      {/* Mode Switcher HUD */}
      <div style={{ 
        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 15, background: 'rgba(20,20,25,0.8)', padding: 15, 
        borderRadius: 30, border: '1px solid #333', backdropFilter: 'blur(10px)'
      }}>
        {[
          { id: 'GALAXY', icon: '🌌', label: 'Default Galaxy' },
          { id: 'HEATMAP', icon: '🔥', label: 'Git Heatmap' },
          { id: 'BLAST', icon: '💥', label: 'Blast Radius' },
          { id: 'DEBT', icon: '🔎', label: 'Tech Debt Radar' }
        ].map(mode => (
          <button 
            key={mode.id}
            onClick={() => setViewMode(mode.id as ViewMode)}
            style={{
              padding: '10px 20px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8,
              background: viewMode === mode.id ? '#00d4ff' : '#222',
              color: viewMode === mode.id ? '#000' : '#fff',
              transition: 'all 0.3s'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{mode.icon}</span> {mode.label}
          </button>
        ))}
      </div>

      {/* Sidebar Overlay */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 400, 
          background: 'rgba(10, 10, 15, 0.95)', borderLeft: '1px solid #333', 
          padding: 30, overflowY: 'auto', color: '#eee'
        }}>
          <button onClick={() => setSelectedNode(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
          
          <h2 style={{ color: '#00d4ff', fontSize: '1.8rem', margin: '10px 0' }}>{selectedNode.name}</h2>
          <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem' }}>{selectedNode.file} (Line {selectedNode.line})</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '20px 0' }}>
            <div style={{ background: '#111', padding: 10, borderRadius: 8, border: '1px solid #222' }}>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>AUTHOR</div>
              <div style={{ fontWeight: 'bold' }}>{selectedNode.author}</div>
            </div>
            <div style={{ background: '#111', padding: 10, borderRadius: 8, border: '1px solid #222' }}>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>CHURN SCORE (0-100)</div>
              <div style={{ fontWeight: 'bold', color: selectedNode.churnScore > 80 ? '#ff4444' : '#44ff44' }}>{selectedNode.churnScore}</div>
            </div>
            <div style={{ background: '#111', padding: 10, borderRadius: 8, border: '1px solid #222' }}>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>IN-DEGREE (CALLED BY)</div>
              <div style={{ fontWeight: 'bold' }}>{selectedNode.inDegree}</div>
            </div>
            <div style={{ background: '#111', padding: 10, borderRadius: 8, border: '1px solid #222' }}>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>OUT-DEGREE (CALLS)</div>
              <div style={{ fontWeight: 'bold' }}>{selectedNode.outDegree}</div>
            </div>
          </div>

          {selectedNode.isGodObject && (
            <div style={{ background: 'rgba(255,0,0,0.1)', borderLeft: '4px solid red', padding: 10, marginBottom: 20, color: '#ffaaaa' }}>
              ⚠️ <b>God Object Detected:</b> This function has excessive complexity or dependencies. High refactoring priority.
            </div>
          )}
          {selectedNode.isDeadCode && (
            <div style={{ background: 'rgba(100,100,100,0.2)', borderLeft: '4px solid gray', padding: 10, marginBottom: 20, color: '#aaaaaa' }}>
              ⚰️ <b>Dead Code Detected:</b> This function is never called within the analyzed scope.
            </div>
          )}

          <h4 style={{ color: '#888', marginTop: 20 }}>Source Snippet</h4>
          <pre style={{ background: '#000', padding: 15, borderRadius: 8, fontSize: '0.8rem', overflowX: 'auto', border: '1px solid #222' }}>
            <code>{selectedNode.snippet}</code>
          </pre>
          
          {viewMode === 'BLAST' && (
            <div style={{ marginTop: 20, padding: 15, background: 'rgba(255, 136, 0, 0.1)', borderRadius: 8, border: '1px solid rgba(255, 136, 0, 0.3)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#ff8800' }}>💥 Blast Radius Impact</h4>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Modifying this node will directly impact <b>{blastNodes.size}</b> functions (1st degree) and indirectly impact <b>{secondaryBlast.size}</b> functions (2nd degree).</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
