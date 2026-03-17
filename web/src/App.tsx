import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

interface Node {
  id: string;
  name: string;
  file: string;
  line: number;
  val: number; // Complexity
  snippet: string;
  color?: string;
  connections?: number; // In-degree
}

interface Link {
  source: string;
  target: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

export default function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('DEEPSEEK_API_KEY') || '');
  const [showSettings, setShowSettings] = useState(false);
  const fgRef = useRef<any>();

  useEffect(() => {
    fetch('/project_data.json')
      .then(res => res.json())
      .then(raw => {
        // Calculate in-degree (connections) for each node to identify hotspots
        const connections: Record<string, number> = {};
        raw.links.forEach((l: Link) => {
          connections[l.target] = (connections[l.target] || 0) + 1;
        });

        const nodes = raw.nodes.map((n: Node) => ({
          ...n,
          connections: connections[n.id] || 0,
          // If a node is heavily called, make it hot (Red-ish)
          color: (connections[n.id] || 0) > 3 ? '#ff4d00' : 
                 (connections[n.id] || 0) > 1 ? '#ffcc00' : '#00d4ff'
        }));

        setData({ nodes, links: raw.links });
      });
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    setAiAnalysis('');
    
    // Camera aim to node
    const distance = 100;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      2000
    );
  }, []);

  const askAI = async () => {
    if (!selectedNode || !apiKey) {
      if (!apiKey) setShowSettings(true);
      return;
    }
    
    setLoading(true);
    setAiAnalysis('Connecting to DeepSeek Intelligence...');

    try {
      const neighbors = data?.links
        .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
        .map(l => l.source === selectedNode.id ? l.target : l.source);

      const prompt = `
You are an expert Software Architect. Analyze this function in the context of a 3D dependency graph.
Node ID: ${selectedNode.id}
File: ${selectedNode.file} (Line ${selectedNode.line})
Code:
\`\`\`javascript
${selectedNode.snippet}
\`\`\`
This function is connected to ${neighbors?.length} other components.
Analyze:
1. What is the core responsibility of this function?
2. Are there any architectural risks (tight coupling, high complexity)?
3. How does this fit into the broader system?
Give a concise, professional analysis in Markdown.
      `;

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          stream: false
        })
      });

      const result = await response.json();
      if (result.choices && result.choices[0]) {
        setAiAnalysis(result.choices[0].message.content);
      } else {
        setAiAnalysis('AI Response Error: Check your API Key or quota.');
      }
    } catch (error) {
      setAiAnalysis('Network Error: Failed to reach DeepSeek API.');
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('DEEPSEEK_API_KEY', key);
    setShowSettings(false);
  };

  const nodeThreeObject = useMemo(() => (node: any) => {
    const color = new THREE.Color(node.color);
    const size = Math.sqrt(node.val || 1) * 2 + 3 + (node.connections * 2);
    const geometry = new THREE.SphereGeometry(size, 24, 24);
    const material = new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      shininess: 100,
      emissive: color,
      emissiveIntensity: 0.6
    });
    return new THREE.Mesh(geometry, material);
  }, []);

  if (!data) return <div style={{ color: 'white', padding: 20 }}>Initializing Code Universe...</div>;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        nodeLabel={(node: any) => `<b>${node.name}</b><br/>${node.file}<br/>${node.connections} Incoming Links`}
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(255,255,255,0.15)'}
        linkWidth={0.7}
        backgroundColor="#000000"
      />

      {/* Futuristic Header */}
      <div style={{ position: 'absolute', top: 20, left: 20, borderLeft: '4px solid #00d4ff', paddingLeft: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#fff', letterSpacing: 2 }}>REPO GAZER 2.0</h1>
        <div style={{ color: '#00d4ff', fontSize: '0.8rem', fontWeight: 'bold' }}>AI ARCHITECT CONNECTED</div>
        <button 
          onClick={() => setShowSettings(true)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.7rem', padding: 0, marginTop: 5, textDecoration: 'underline' }}
        >⚙ CONFIG API KEY</button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#111', padding: 30, borderRadius: 12, border: '1px solid #333', zIndex: 1000, width: 400 }}>
          <h3 style={{ color: '#00d4ff', marginTop: 0 }}>API Configuration</h3>
          <p style={{ color: '#888', fontSize: '0.8rem' }}>Enter your DeepSeek API Key. It will be stored locally in your browser.</p>
          <input 
            type="password" 
            placeholder="sk-..." 
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

      {/* Sidebar Overlay */}
      {selectedNode && (
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 480, 
          background: 'rgba(5, 5, 12, 0.95)', backdropFilter: 'blur(15px)',
          borderLeft: '2px solid rgba(0, 212, 255, 0.4)', 
          padding: 30, overflowY: 'auto', color: '#eee', zIndex: 100
        }}>
          <button onClick={() => setSelectedNode(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24 }}>✕</button>
          <h2 style={{ color: '#fff', fontSize: '2.2rem', margin: '15px 0 5px 0' }}>{selectedNode.name}</h2>
          <div style={{ display: 'flex', gap: 10, marginBottom: 25 }}>
            <span style={{ background: '#222', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem' }}>{selectedNode.file}</span>
            <span style={{ background: '#004466', color: '#00d4ff', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 'bold' }}>{selectedNode.connections} USAGES</span>
          </div>
          
          <pre style={{ background: '#000', padding: 20, borderRadius: 10, fontSize: '0.85rem', border: '1px solid #222', color: '#fff', overflowX: 'auto' }}>
            <code>{selectedNode.snippet}</code>
          </pre>

          <button onClick={askAI} disabled={loading} style={{ 
            width: '100%', padding: 18, marginTop: 30,
            background: 'linear-gradient(135deg, #00d4ff 0%, #007799 100%)', color: '#000', 
            fontWeight: 'bold', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: '1rem', boxShadow: '0 5px 15px rgba(0, 212, 255, 0.3)'
          }}>
            {loading ? 'AI AGENT REASONING...' : '✨ ASK DEEPSEEK ARCHITECT'}
          </button>

          {aiAnalysis && (
            <div style={{ marginTop: 30, padding: 25, background: 'rgba(0, 212, 255, 0.08)', borderRadius: 12, border: '1px solid rgba(0, 212, 255, 0.3)', lineHeight: '1.8', fontSize: '1rem', color: '#ddd' }}>
               <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
