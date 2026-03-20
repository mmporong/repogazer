import { useEffect, useState, useCallback, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
  painScore: number;
  issues: string[];
  inDegree: number;
  outDegree: number;
  isGodObject: boolean;
  isDeadCode: boolean;
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

type ViewMode = 'GALAXY' | 'HEATMAP' | 'BLAST' | 'DEBT';

// Realistic yet VIVID Stellar Palette (O-B-A-F-G-K-M)
const STELLAR_PAIRS = [
  { inner: '#ffffff', outer: '#9bb0ff' }, // Class O: Deep Sapphire
  { inner: '#cae1ff', outer: '#0077ff' }, // Class B: Blue-White
  { inner: '#f8f7ff', outer: '#ffffff' }, // Class A: Pure White
  { inner: '#fff4ea', outer: '#ffee00' }, // Class F/G: Solar Gold
  { inner: '#ffd2a1', outer: '#ff8800' }, // Class K: Plasma Orange
  { inner: '#ffcc6f', outer: '#ff3300' }, // Class M: Red
  { inner: '#ff55aa', outer: '#7000ff' }  // Bonus: Cyber Nebula
];

const textureCache: Record<string, THREE.CanvasTexture> = {};

const getMasterNodeTexture = (inner: string, outer: string, churn: number, isGod: boolean, isDead: boolean) => {
  const cacheKey = `${inner}_${outer}_${churn}_${isGod}_${isDead}_v70`;
  if (textureCache[cacheKey]) return textureCache[cacheKey];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    const cx = 64;
    const cy = 64;

    const haloGrad = ctx.createRadialGradient(cx, cy, 15, cx, cy, 64);
    if (churn > 70) {
        haloGrad.addColorStop(0, 'rgba(255, 0, 0, 0.5)');
    } else {
        haloGrad.addColorStop(0, outer + '66');
    }
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, 128, 128);

    const starGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 45);
    starGrad.addColorStop(0, '#ffffff'); 
    starGrad.addColorStop(0.08, '#ffffff');
    starGrad.addColorStop(0.2, inner);   
    starGrad.addColorStop(0.6, outer);   
    starGrad.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fill();

    if (isGod || isDead) {
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'black';
        
        if (isGod) {
            ctx.fillStyle = '#ffff00';
            ctx.fillText('⚠', cx, cy - 35);
        }
        if (isDead) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('☠', cx, cy + 35);
        }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  textureCache[cacheKey] = texture;
  return texture;
};

export default function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('GALAXY');
  const [impactNodes, setImpactNodes] = useState<Set<string>>(new Set());
  
  // Auto-Fix States
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixedCode, setFixedCode] = useState<string | null>(null);
  
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
        fgRef.current.d3Force('collide', (node: any) => (node.size || 15) + 12);
      }, 100);
    }
  }, [data]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    setFixedCode(null); // Reset fix state when changing node
    
    const impacted = new Set<string>();
    data?.links.forEach((l: any) => {
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      if (targetId === node.id) impacted.add(sourceId);
    });
    setImpactNodes(impacted);

    const distance = 250;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      1500
    );
  }, [data]);

  const requestAutoFix = async () => {
      if (!apiKey) {
          setShowSettings(true);
          return;
      }
      if (!selectedNode) return;

      setIsFixing(true);
      setFixedCode("🧠 Analyzing code and formulating refactor plan...");

      try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          
          const prompt = `
          You are an expert Software Architect.
          Task: Refactor the following C# code to resolve its architectural debt.
          
          Issues Detected:
          ${selectedNode.issues.join('\n')}
          
          Current Code:
          \`\`\`csharp
          ${selectedNode.snippet}
          \`\`\`
          
          Provide the optimized, refactored C# code. If it's a God Object, show how it should be split into smaller methods or classes. If it's dead code, state that it should be removed.
          `;

          const result = await model.generateContent(prompt);
          setFixedCode(result.response.text());
      } catch (err: any) {
          setFixedCode(`❌ Error generating fix: ${err.message}. Check your API Key.`);
      } finally {
          setIsFixing(false);
      }
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GEMINI_API_KEY', key);
    setShowSettings(false);
  };

  const nodeThreeObject = useCallback((node: any) => {
    const isImpacted = impactNodes.has(node.id);
    const isTarget = selectedNode?.id === node.id;
    
    let opacity = 1.0;
    if (selectedNode && !isTarget && !isImpacted) opacity = 0.1;

    const material = new THREE.SpriteMaterial({
      map: getMasterNodeTexture(node.color!, node.outerColor!, node.churnScore, node.isGodObject, node.isDeadCode),
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false 
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(node.size!, node.size!, 1);
    return sprite;
  }, [selectedNode, impactNodes]);

  if (!data) return <div style={{ color: 'white', padding: 40, fontFamily: 'monospace' }}>🛰️ CALIBRATING ACTIONABLE MAP...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000002', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `
          <div style="background:rgba(0,0,0,0.95); padding:15px; border-radius:8px; border:1px solid ${node.outerColor}; color:white; font-family:'Segoe UI', sans-serif;">
            <b style="color:${node.outerColor}; font-size:1.2rem;">${node.name}</b><br/>
            <span style="opacity:0.6; font-size:0.85rem;">${node.file}</span><br/>
            <div style="height:1px; background:#333; margin:8px 0;"></div>
            <div style="color:${node.painScore > 5000 ? '#ff4444' : '#fff'}; font-size:0.8rem;">
              PAIN SCORE: <b>${Math.round(node.painScore || 0).toLocaleString()}</b>
            </div>
          </div>
        `}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(255, 255, 255, 0.03)'} 
        linkWidth={0.5}
        backgroundColor="#000002"
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
      />

      <div style={{ position: 'absolute', top: 40, left: 40, pointerEvents: 'none', borderLeft: '5px solid white', paddingLeft: 30 }}>
        <h1 style={{ margin: 0, fontSize: '3rem', color: '#fff', letterSpacing: 12, fontWeight: 900, textTransform: 'uppercase' }}>REPO GAZER</h1>
        <div style={{ color: '#00fbff', fontSize: '0.9rem', fontWeight: 900, letterSpacing: 5, marginTop: 10 }}>ACTIONABLE PROFILER v7.0</div>
        
        <button 
          onClick={() => setShowSettings(true)}
          style={{ pointerEvents: 'auto', background: 'none', border: '1px solid #444', color: '#888', padding: '5px 10px', borderRadius: 4, marginTop: 15, cursor: 'pointer', fontSize: '0.7rem' }}
        >⚙ CONFIG API KEY</button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#111', padding: 30, borderRadius: 12, border: '1px solid #333', zIndex: 1000, width: 400 }}>
          <h3 style={{ color: '#00d4ff', marginTop: 0 }}>Auto-Fix Configuration</h3>
          <p style={{ color: '#888', fontSize: '0.8rem' }}>Enter Gemini API Key to enable AI Auto-Refactoring. (Stored locally)</p>
          <input 
            type="password" 
            placeholder="AIza..." 
            defaultValue={apiKey}
            id="apiKeyInput"
            style={{ width: '100%', padding: 10, background: '#000', border: '1px solid #444', color: '#fff', borderRadius: 5, marginBottom: 20 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => saveApiKey((document.getElementById('apiKeyInput') as HTMLInputElement).value)} style={{ flex: 1, padding: 10, background: '#00d4ff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' }}>SAVE KEY</button>
            <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: 10, background: '#333', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Mode Switcher */}
      <div style={{ 
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 15, background: 'rgba(10, 10, 15, 0.95)', padding: '12px 25px', 
        borderRadius: 15, border: '1px solid #333', backdropFilter: 'blur(15px)'
      }}>
        {[
          { id: 'GALAXY', label: '구조 (STRUCTURE)' },
          { id: 'HEATMAP', label: '위험도 (RISK)' },
          { id: 'BLAST', label: '파급력 (IMPACT)' },
          { id: 'DEBT', label: '부채 (DEBT)' }
        ].map(mode => (
          <button 
            key={mode.id}
            onClick={() => setViewMode(mode.id as ViewMode)}
            style={{
              padding: '10px 25px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 900, fontSize: '0.85rem', letterSpacing: 2,
              background: viewMode === mode.id ? 'white' : 'transparent',
              color: viewMode === mode.id ? 'black' : '#888',
              transition: 'all 0.3s ease'
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Actionable Sidebar */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 550, 
          background: 'rgba(5, 5, 10, 1.0)', borderLeft: '1px solid #333', 
          padding: 50, overflowY: 'auto', color: '#fff', zIndex: 100,
          boxShadow: '-50px 0 100px rgba(0,0,0,1)'
        }}>
          <button onClick={() => setSelectedNode(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 40 }}>✕</button>
          
          <h2 style={{ color: selectedNode.outerColor, fontSize: '3rem', margin: '15px 0 10px 0', fontWeight: 900 }}>{selectedNode.name}</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '1rem', fontWeight: 'bold' }}>SOURCE: {selectedNode.file.toUpperCase()}</p>
          
          {/* Actionable Metrics */}
          <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr', gap: 15 }}>
            <div style={{ background: '#0a0a0f', padding: 20, borderLeft: '4px solid ' + selectedNode.outerColor }}>
              <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 5, letterSpacing: 2 }}>PAIN SCORE (Complexity × Churn)</div>
              <div style={{ fontWeight: 900, fontSize: '1.8rem', color: selectedNode.painScore > 5000 ? '#ff0000' : '#fff' }}>
                {Math.round(selectedNode.painScore || 0).toLocaleString()}
              </div>
            </div>

            {selectedNode.issues && selectedNode.issues.length > 0 && (
              <div style={{ background: '#1a0505', padding: 20, borderLeft: '4px solid #ff0000' }}>
                <div style={{ fontSize: '0.7rem', color: '#ff6666', marginBottom: 10, letterSpacing: 2 }}>ACTIONABLE DIAGNOSIS</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.9rem', color: '#ffaaaa', lineHeight: 1.5 }}>
                  {selectedNode.issues.map((issue, idx) => (
                    <li key={idx} style={{ marginBottom: 5 }}>{issue}</li>
                  ))}
                </ul>
                
                {/* THE KILLING POINT: Auto-Fix Button */}
                <button 
                  onClick={requestAutoFix}
                  disabled={isFixing}
                  style={{
                    width: '100%', marginTop: 20, padding: 15, background: 'linear-gradient(90deg, #ff0055, #ffaa00)',
                    border: 'none', borderRadius: 6, color: 'white', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(255, 0, 85, 0.4)', opacity: isFixing ? 0.5 : 1
                  }}
                >
                  {isFixing ? '⚙️ AI IS REFACTORING...' : '✨ ONE-CLICK AUTO-FIX (GEMINI)'}
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: 40 }}>
            <h4 style={{ color: '#222', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: 4, marginBottom: 15 }}>Current C# Source</h4>
            <pre style={{ 
              background: '#000', padding: 30, borderRadius: 2, fontSize: '0.85rem', 
              overflowX: 'auto', border: '1px solid #111', color: '#aaa', lineHeight: 1.6
            }}>
              <code>{selectedNode.snippet}</code>
            </pre>
          </div>

          {fixedCode && (
            <div style={{ marginTop: 30 }}>
              <h4 style={{ color: '#00d4ff', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: 4, marginBottom: 15 }}>AI Proposed Refactor</h4>
              <div style={{ 
                background: 'rgba(0, 212, 255, 0.05)', padding: 30, borderRadius: 2, fontSize: '0.85rem', 
                border: '1px solid rgba(0, 212, 255, 0.3)', color: '#fff', lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}>
                {fixedCode}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
