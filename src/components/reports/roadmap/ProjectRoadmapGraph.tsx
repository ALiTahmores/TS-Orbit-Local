import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  GitBranch, 
  Code, 
  Lock,
  Unlock,
  MousePointerClick,
  Info, 
  Server, 
  Palette, 
  Users, 
  TrendingUp,
  Sliders,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useProject } from '../../../context/ProjectContext';
import { 
  DOMAIN_ROADMAPS, 
  DomainType, 
  RoadmapNode, 
  RoadmapConnection 
} from './roadmapData';
import { NodeDetailModal } from './NodeDetailModal';
import { ComparativeBranchModal } from './ComparativeBranchModal';

export const ProjectRoadmapGraph: React.FC = () => {
  const { 
    projects, 
    selectedProject, 
    tasks, 
    updateProject, 
    isRtl 
  } = useProject();

  // Active Project (fallback to first project if none selected)
  const currentProject = selectedProject || projects[0] || null;

  // Active Domain Template: Auto-detect based on project category/title or default to web_dev
  const [activeDomain, setActiveDomain] = useState<DomainType>(() => {
    if (!currentProject) return 'web_dev';
    const text = (currentProject.title + ' ' + (currentProject.category || '') + ' ' + (currentProject.department || '')).toLowerCase();
    if (text.includes('سئو') || text.includes('seo')) return 'seo';
    if (text.includes('گرافیک') || text.includes('برند') || text.includes('لوگو')) return 'graphic';
    if (text.includes('سوشال') || text.includes('اینستاگرام') || text.includes('محتوا')) return 'social';
    if (text.includes('ui') || text.includes('ux') || text.includes('رابط') || text.includes('تجربه')) return 'ui_ux';
    return 'web_dev';
  });

  // Decision branch state for Web Dev ('wp' or 'custom') - synced with project settings
  const [webBranch, setWebBranch] = useState<'wp' | 'custom'>(() => {
    if (currentProject) {
      const pArch = (currentProject as any).architecture;
      if (pArch === 'wp' || pArch === 'custom') return pArch;
      const text = ((currentProject.category || '') + ' ' + (currentProject.title || '')).toLowerCase();
      if (text.includes('custom') || text.includes('اختصاصی') || text.includes('next') || text.includes('react')) return 'custom';
    }
    return 'wp';
  });

  // Switch branch and persist to project
  const handleSwitchBranch = async (newBranch: 'wp' | 'custom') => {
    setWebBranch(newBranch);
    if (currentProject && updateProject) {
      await updateProject(currentProject.id, { architecture: newBranch } as any);
    }
  };

  // Canvas Interactive Activation Shield State (Prevents Accidental Page Scroll Hijacking)
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  // Node states & positions
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [activeRoadmapNodes, setActiveRoadmapNodes] = useState<RoadmapNode[]>([]);
  const [activeConnections, setActiveConnections] = useState<RoadmapConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Comparative Branch Modal State (triggers when clicking ghost/alternative branch nodes)
  const [comparativeModalNode, setComparativeModalNode] = useState<RoadmapNode | null>(null);
  const [isComparativeModalOpen, setIsComparativeModalOpen] = useState(false);

  // Canvas Pan & Zoom state - Optimized for top-to-bottom vertical tree hierarchy
  const [scale, setScale] = useState<number>(0.75);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Escape key listener to exit interaction mode or close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          setIsModalOpen(false);
        } else if (isInteracting) {
          setIsInteracting(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isInteracting]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Load domain template nodes and calculate initial status based on real ProjectContext state
  useEffect(() => {
    const config = DOMAIN_ROADMAPS[activeDomain];
    if (!config) return;

    // Load ALL connections (do not filter out ghost branch, it will be rendered with muted dashed styling)
    setActiveConnections(config.connections);

    // Load ALL nodes (active and ghost branches)
    const nodes = config.nodes;

    // Determine current project progress & blocked tasks
    const progress = currentProject ? currentProject.progress : 25;
    const hasBlockedTasks = tasks.some(t => 
      (currentProject ? t.projectId === currentProject.id : true) && 
      (t.status === 'blocked' || (t as any).isBlocked)
    );

    // For calculating execution progression, use only nodes on the active branch
    const activePipelineNodes = nodes.filter(n => !n.branch || n.branch === 'all' || n.branch === webBranch);
    const totalSteps = activePipelineNodes.length;
    const activeStepIndex = Math.min(
      Math.floor((progress / 100) * totalSteps),
      totalSteps - 1
    );

    const calculatedNodes: RoadmapNode[] = nodes.map((node) => {
      const isGhost = Boolean(node.branch && node.branch !== webBranch);

      if (isGhost) {
        return {
          ...node,
          status: 'pending' as const,
          isBottleneck: false,
          bottleneckReason: ''
        };
      }

      const activeIndex = activePipelineNodes.findIndex(n => n.id === node.id);
      let status: 'completed' | 'in_progress' | 'blocked' | 'pending' = 'pending';
      let isBottleneck = false;
      let bottleneckReason = '';

      if (activeIndex < activeStepIndex) {
        status = 'completed';
      } else if (activeIndex === activeStepIndex) {
        if (hasBlockedTasks && activeIndex > 1) {
          status = 'blocked';
          isBottleneck = true;
          bottleneckReason = 'یک یا چند وظیفه در این مرحله یا فاز قبلی مسدود شده و جریان تحویل متوقف گردیده است.';
        } else {
          status = 'in_progress';
        }
      } else {
        if (hasBlockedTasks && activeIndex > activeStepIndex) {
          status = 'blocked';
          bottleneckReason = 'در انتظار رفع انسداد در فاز قبلی (Critical Path Blocked)';
        } else {
          status = 'pending';
        }
      }

      return {
        ...node,
        status,
        deliverables: node.deliverables.map(d => ({
          ...d,
          completed: status === 'completed' ? true : d.completed
        })),
        isBottleneck,
        bottleneckReason
      };
    });

    setActiveRoadmapNodes(calculatedNodes);

    // Initialize node positions if not already set for this domain
    setNodePositions(prev => {
      const nextPos: Record<string, { x: number; y: number }> = { ...prev };
      calculatedNodes.forEach(n => {
        if (!nextPos[n.id]) {
          nextPos[n.id] = { x: n.initialX, y: n.initialY };
        }
      });
      return nextPos;
    });
  }, [activeDomain, webBranch, currentProject, tasks]);

  // Render dynamic icon helper
  const renderIcon = (name: string, size = 16, className = '') => {
    const IconComp = (LucideIcons as any)[name] || LucideIcons.Sparkles;
    return <IconComp size={size} className={className} />;
  };

  // Canvas Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteracting) return;
    // Only pan if clicking on canvas background
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteracting) return;

    if (isPanning) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPan({
          x: clientX - panStartRef.current.x,
          y: clientY - panStartRef.current.y
        });
      });
    } else if (draggingNodeId) {
      const clientX = e.clientX;
      const clientY = e.clientY;
      const id = draggingNodeId;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const newX = (clientX - dragOffsetRef.current.x) / scale;
        const newY = (clientY - dragOffsetRef.current.y) / scale;
        setNodePositions(prev => ({
          ...prev,
          [id]: { x: Math.round(newX), y: Math.round(newY) }
        }));
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Mouse wheel zoom centered at cursor - ONLY runs when isInteracting is TRUE
  const handleWheel = (e: React.WheelEvent) => {
    if (!isInteracting) {
      // Normal page scrolling allowed without hijacking!
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;

    const zoomFactor = 1.08;
    let newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    newScale = Math.min(Math.max(0.35, newScale), 2.0);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  // Node Drag Handlers
  const startDragNode = (e: React.MouseEvent, nodeId: string) => {
    if (!isInteracting) return;
    e.stopPropagation();
    const currentPos = nodePositions[nodeId] || { x: 0, y: 0 };
    dragOffsetRef.current = {
      x: e.clientX - currentPos.x * scale,
      y: e.clientY - currentPos.y * scale
    };
    setDraggingNodeId(nodeId);
  };

  // Canvas Control Buttons
  const handleZoomIn = () => setScale(s => Math.min(s * 1.15, 2.0));
  const handleZoomOut = () => setScale(s => Math.max(s / 1.15, 0.35));
  const handleResetZoom = () => {
    setScale(0.85);
    setPan({ x: 60, y: 70 });
  };
  const handleFitView = () => {
    setScale(0.6);
    setPan({ x: 40, y: 80 });
  };

  // Toggle Deliverable inside Modal
  const handleToggleDeliverable = (nodeId: string, deliverableId: string) => {
    setActiveRoadmapNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const updatedDeliverables = n.deliverables.map(d => 
          d.id === deliverableId ? { ...d, completed: !d.completed } : d
        );
        const allDone = updatedDeliverables.every(d => d.completed);
        const updatedNode = {
          ...n,
          deliverables: updatedDeliverables,
          status: allDone ? ('completed' as const) : ('in_progress' as const)
        };
        if (selectedNode?.id === nodeId) setSelectedNode(updatedNode);
        return updatedNode;
      }
      return n;
    }));
  };

  // Mark Node as Complete & update Project in Context
  const handleMarkNodeComplete = async (nodeId: string) => {
    const nodeIndex = activeRoadmapNodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    setActiveRoadmapNodes(prev => prev.map((n, idx) => {
      if (idx <= nodeIndex) {
        return {
          ...n,
          status: 'completed',
          deliverables: n.deliverables.map(d => ({ ...d, completed: true }))
        };
      } else if (idx === nodeIndex + 1) {
        return {
          ...n,
          status: 'in_progress'
        };
      }
      return n;
    }));

    // Increment Project Progress in Context
    if (currentProject && updateProject) {
      const stepPercentage = Math.round(((nodeIndex + 1) / activeRoadmapNodes.length) * 100);
      const newProgress = Math.min(100, Math.max(currentProject.progress, stepPercentage));
      await updateProject(currentProject.id, { progress: newProgress });
    }
  };

  // Calculate Smooth Cubic Bezier Paths for Dynamic Connections (Top-to-Bottom Vertical Flow)
  const renderedConnections = useMemo(() => {
    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 106;

    return activeConnections.map(conn => {
      const fromPos = nodePositions[conn.from] || { x: 0, y: 0 };
      const toPos = nodePositions[conn.to] || { x: 0, y: 0 };
      const fromNode = activeRoadmapNodes.find(n => n.id === conn.from);
      const toNode = activeRoadmapNodes.find(n => n.id === conn.to);

      // Parent exit socket: bottom edge
      let x1 = fromPos.x + (NODE_WIDTH / 2);
      let y1 = fromPos.y + (fromNode?.isDecisionNode ? 136 : NODE_HEIGHT);

      // If originating from Decision Node, route from respective branch socket
      if (fromNode?.isDecisionNode) {
        if (conn.branch === 'custom') {
          x1 = fromPos.x + 60; // Left branch socket
        } else if (conn.branch === 'wp') {
          x1 = fromPos.x + 180; // Right branch socket
        }
      }

      // Child entry socket: top edge center
      const x2 = toPos.x + (NODE_WIDTH / 2);
      const y2 = toPos.y;

      // Vertical cubic bezier curve
      const dy = Math.max(Math.abs(y2 - y1) * 0.5, 36);
      const pathData = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

      // Ghost status: connection belongs to alternative/inactive branch
      const isGhost = Boolean(conn.branch && conn.branch !== webBranch);

      // Active state checks
      const isBlocked = !isGhost && (fromNode?.status === 'blocked' || toNode?.status === 'blocked');
      const isActive = !isGhost && (fromNode?.status === 'completed' && toNode?.status === 'in_progress');
      const isCompleted = !isGhost && (fromNode?.status === 'completed' && toNode?.status === 'completed');

      return {
        ...conn,
        pathData,
        isGhost,
        isBlocked,
        isActive,
        isCompleted,
        midX: (x1 + x2) / 2,
        midY: (y1 + y2) / 2
      };
    });
  }, [activeConnections, nodePositions, activeRoadmapNodes, webBranch]);

  return (
    <div className="relative w-full h-[460px] md:h-[520px] bg-[#070b14] rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col font-vazirmatn select-none">
      
      {/* Dynamic Animated Pulse Keyframes */}
      <style>{`
        @keyframes flowBeamActive {
          0% { stroke-dashoffset: 48; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes flowBeamBlocked {
          0% { stroke-dashoffset: 36; }
          100% { stroke-dashoffset: 0; }
        }
        .flow-beam-active {
          animation: flowBeamActive 1.4s linear infinite;
        }
        .flow-beam-blocked {
          animation: flowBeamBlocked 2.2s linear infinite;
        }
      `}</style>

      {/* TOP FLOATING CONTROL BAR - Architecture pills purged; now natively in Decision Node */}
      <div className="absolute top-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Domain / Pipeline Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-lg backdrop-blur-md pointer-events-auto">
          {(Object.keys(DOMAIN_ROADMAPS) as DomainType[]).map((dom) => {
            const config = DOMAIN_ROADMAPS[dom];
            const isSelected = activeDomain === dom;
            return (
              <button
                key={dom}
                onClick={() => setActiveDomain(dom)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{config.title}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Interaction Exit */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Floating Exit Interactive Mode button if currently active */}
          {isInteracting && (
            <button
              onClick={() => setIsInteracting(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-lg backdrop-blur-md text-xs font-bold transition-all cursor-pointer pointer-events-auto"
              title="خروج از حالت تعاملی (Escape)"
            >
              <Unlock size={12} className="text-amber-400" />
              <span>خروج از حالت تعاملی</span>
              <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-slate-400">Esc</kbd>
            </button>
          )}
        </div>
      </div>

      {/* CANVAS CONTAINER */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={`relative flex-1 w-full h-full overflow-hidden canvas-bg ${
          isInteracting ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      >
        {/* TRANSFORM LAYER */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isPanning || draggingNodeId ? 'none' : 'transform 0.08s ease-out'
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* SVG LAYER FOR BEZIER CONNECTORS & FLOWING LIGHT PULSES */}
          <svg className="absolute inset-0 w-[4200px] h-[3200px] pointer-events-none overflow-visible">
            <defs>
              {/* Glow filter cyan */}
              <filter id="glow-cyan" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Glow filter rose */}
              <filter id="glow-rose" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Glow filter emerald */}
              <filter id="glow-emerald" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Layer A: Base Structural Architectural Wires */}
            {renderedConnections.map(conn => {
              if (conn.isGhost) {
                // Ghost / Alternative Branch connection: muted dashed wire
                return (
                  <g key={`ghost-${conn.id}`} className="opacity-40 hover:opacity-75 transition-opacity">
                    <path
                      d={conn.pathData}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1.5"
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                    />
                    {conn.label && (
                      <foreignObject
                        x={conn.midX - 45}
                        y={conn.midY - 10}
                        width={90}
                        height={20}
                        className="pointer-events-none"
                      >
                        <div className="flex items-center justify-center">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-900/90 text-slate-500 border border-slate-800">
                            {conn.label}
                          </span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              }

              // Active Pipeline: solid base wire
              return (
                <g key={`base-${conn.id}`}>
                  <path
                    d={conn.pathData}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {conn.label && (
                    <foreignObject
                      x={conn.midX - 50}
                      y={conn.midY - 10}
                      width={100}
                      height={20}
                      className="pointer-events-none"
                    >
                      <div className="flex items-center justify-center">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-500/40 shadow-sm">
                          {conn.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Layer B: Animated Neon Flowing Light Beams (Dual-Layer Framer Fidelity) */}
            {renderedConnections.map(conn => {
              if (conn.isGhost) return null; // No animated pulse on ghost branches

              if (conn.isBlocked) {
                return (
                  <g key={`beam-${conn.id}`}>
                    <path
                      d={conn.pathData}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                      strokeDasharray="6 12"
                      className="flow-beam-blocked"
                      filter="url(#glow-rose)"
                      strokeLinecap="round"
                    />
                    {/* Pulsing alert indicator at midpoint */}
                    <circle 
                      cx={conn.midX} 
                      cy={conn.midY} 
                      r="4.5" 
                      fill="#f43f5e" 
                      filter="url(#glow-rose)" 
                      className="animate-ping" 
                    />
                  </g>
                );
              }

              if (conn.isActive) {
                return (
                  <path
                    key={`beam-${conn.id}`}
                    d={conn.pathData}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeDasharray="8 16"
                    className="flow-beam-active"
                    filter="url(#glow-cyan)"
                    strokeLinecap="round"
                  />
                );
              }

              if (conn.isCompleted) {
                return (
                  <path
                    key={`beam-${conn.id}`}
                    d={conn.pathData}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    filter="url(#glow-emerald)"
                    strokeLinecap="round"
                  />
                );
              }

              return null;
            })}
          </svg>

          {/* NODES LAYER */}
          {activeRoadmapNodes.map((node) => {
            const pos = nodePositions[node.id] || { x: node.initialX, y: node.initialY };
            const isNodeSelected = selectedNode?.id === node.id;
            const isGhost = Boolean(node.branch && node.branch !== webBranch);

            // ========================================================
            // CASE 1: NATIVE INTERACTIVE DECISION NODE
            // ========================================================
            if (node.isDecisionNode) {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => startDragNode(e, node.id)}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    position: 'absolute',
                    width: '240px',
                    height: '136px'
                  }}
                  className="group pointer-events-auto rounded-2xl p-2.5 shadow-2xl backdrop-blur-md select-none border border-amber-500/50 bg-[#14120a]/95 hover:border-amber-400 flex flex-col justify-between transition-all duration-200 z-10"
                >
                  {/* Top Port Handle (Input) */}
                  <div 
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 bg-[#0e1626] border-emerald-400 flex items-center justify-center shadow-sm"
                    title="پورت ورودی"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>

                  {/* Top Row: Phase + Decision Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-amber-400">
                      {node.phaseNumber}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <GitBranch size={9} />
                      <span>گره تصمیم معماری</span>
                    </span>
                  </div>

                  {/* Title */}
                  <div className="flex items-center gap-1.5 my-0.5">
                    <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <GitBranch size={11} />
                    </div>
                    <h4 className="text-[11px] font-bold text-white truncate flex-1">
                      {node.title}
                    </h4>
                  </div>

                  {/* Native Architecture Switcher Inside Node */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchBranch('custom');
                      }}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        webBranch === 'custom'
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-400/60 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${webBranch === 'custom' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                        <span>کدنویسی اختصاصی</span>
                      </div>
                      <span className="text-[8px] opacity-70 font-mono">Next.js / Node</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchBranch('wp');
                      }}
                      className={`px-1.5 py-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        webBranch === 'wp'
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-400/60 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${webBranch === 'wp' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                        <span>سیستم وردپرس</span>
                      </div>
                      <span className="text-[8px] opacity-70 font-mono">WP / Headless</span>
                    </button>
                  </div>

                  {/* Comparative Analysis Trigger Link */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetNode = activeRoadmapNodes.find(n => n.branch && n.branch !== webBranch) || node;
                      setComparativeModalNode(targetNode);
                      setIsComparativeModalOpen(true);
                    }}
                    className="w-full text-center text-[9px] font-bold text-amber-400/90 hover:text-amber-300 hover:underline flex items-center justify-center gap-1 cursor-pointer pt-0.5"
                  >
                    <Sparkles size={10} />
                    <span>تحلیل و مقایسه معماری دو شاخه</span>
                  </button>

                  {/* Output Socket 1: Custom Branch (Left Socket at 60px / 25%) */}
                  <div 
                    className={`absolute -bottom-2 left-[25%] -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 bg-[#0e1626] flex items-center justify-center shadow-sm ${
                      webBranch === 'custom' ? 'border-blue-400' : 'border-slate-700'
                    }`}
                    title="خروجی شاخه اختصاصی"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${webBranch === 'custom' ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
                  </div>

                  {/* Output Socket 2: WordPress Branch (Right Socket at 180px / 75%) */}
                  <div 
                    className={`absolute -bottom-2 right-[25%] translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 bg-[#0e1626] flex items-center justify-center shadow-sm ${
                      webBranch === 'wp' ? 'border-cyan-400' : 'border-slate-700'
                    }`}
                    title="خروجی شاخه وردپرس"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${webBranch === 'wp' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
                  </div>
                </div>
              );
            }

            // ========================================================
            // CASE 2: GHOST / COMPARATIVE BRANCH NODE (INACTIVE ARCHITECTURE)
            // ========================================================
            if (isGhost) {
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => startDragNode(e, node.id)}
                  onClick={() => {
                    setComparativeModalNode(node);
                    setIsComparativeModalOpen(true);
                  }}
                  style={{
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                    position: 'absolute',
                    width: '220px',
                    height: '106px'
                  }}
                  className="group pointer-events-auto rounded-2xl p-2.5 shadow-md backdrop-blur-md select-none transition-all duration-200 cursor-pointer border border-dashed border-slate-700/80 bg-slate-950/60 opacity-45 hover:opacity-95 hover:border-slate-500 flex flex-col justify-between"
                  title="کلیک جهت مشاهده تحلیل مقایسه‌ای این معماری"
                >
                  {/* Top and Bottom Ports */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border border-slate-700 bg-slate-900" />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border border-slate-700 bg-slate-900" />

                  {/* Header: Phase + Ghost Tag */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">{node.phaseNumber}</span>
                    <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700 flex items-center gap-1">
                      <GitBranch size={8} />
                      <span>شاخه جایگزین</span>
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-center gap-2 my-auto">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-slate-800/60 text-slate-500">
                      {renderIcon(node.iconName, 12)}
                    </div>
                    <h4 className="text-xs font-medium text-slate-400 group-hover:text-slate-200 truncate flex-1">
                      {node.title}
                    </h4>
                  </div>

                  {/* Comparison CTA */}
                  <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-500 group-hover:text-amber-400/90 font-bold">
                    <span>کلیک جهت مقایسه معماری</span>
                    <ChevronRight size={10} />
                  </div>
                </div>
              );
            }

            // ========================================================
            // CASE 3: ACTIVE STANDARD PIPELINE NODE
            // ========================================================
            const completedDels = node.deliverables.filter(d => d.completed).length;
            const totalDels = node.deliverables.length;
            const nodeProgress = totalDels > 0 ? Math.round((completedDels / totalDels) * 100) : 0;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => startDragNode(e, node.id)}
                onClick={() => {
                  setSelectedNode(node);
                  setIsModalOpen(true);
                }}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  position: 'absolute',
                  width: '220px',
                  height: '106px'
                }}
                className={`group pointer-events-auto rounded-2xl p-2.5 shadow-xl backdrop-blur-md select-none transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
                  node.isBottleneck || node.status === 'blocked'
                    ? 'bg-[#180d19]/95 border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                    : node.status === 'in_progress'
                    ? 'bg-[#0b1b2d]/95 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                    : node.status === 'completed'
                    ? 'bg-[#0a1c17]/95 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : 'bg-[#0e1626]/95 border-slate-700/80 hover:border-slate-500'
                } ${isNodeSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-[#080c16]' : ''}`}
              >
                {/* Vertical Top Port Handle (Input) */}
                <div 
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 bg-[#0e1626] flex items-center justify-center shadow-sm ${
                    node.status === 'completed'
                      ? 'border-emerald-400'
                      : node.status === 'in_progress'
                      ? 'border-cyan-400'
                      : node.status === 'blocked'
                      ? 'border-rose-400'
                      : 'border-slate-600'
                  }`}
                  title="پورت ورودی"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    node.status === 'completed'
                      ? 'bg-emerald-400'
                      : node.status === 'in_progress'
                      ? 'bg-cyan-400 animate-pulse'
                      : node.status === 'blocked'
                      ? 'bg-rose-400'
                      : 'bg-slate-500'
                  }`} />
                </div>

                {/* Vertical Bottom Port Handle (Output) */}
                <div 
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 bg-[#0e1626] flex items-center justify-center shadow-sm ${
                    node.status === 'completed'
                      ? 'border-emerald-400'
                      : node.status === 'in_progress'
                      ? 'border-cyan-400'
                      : node.status === 'blocked'
                      ? 'border-rose-400'
                      : 'border-slate-600'
                  }`}
                  title="پورت خروجی"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    node.status === 'completed'
                      ? 'bg-emerald-400'
                      : node.status === 'in_progress'
                      ? 'bg-cyan-400 animate-pulse'
                      : node.status === 'blocked'
                      ? 'bg-rose-400'
                      : 'bg-slate-500'
                  }`} />
                </div>

                {/* Top Row: Phase + Status Badge */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {node.phaseNumber}
                  </span>
                  <div>
                    {node.status === 'completed' && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 size={9} />
                        <span>تکمیل</span>
                      </span>
                    )}
                    {node.status === 'in_progress' && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 animate-pulse">
                        <Sparkles size={9} />
                        <span>جاری</span>
                      </span>
                    )}
                    {node.status === 'blocked' && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/40 animate-pulse">
                        <AlertTriangle size={9} />
                        <span>گلوگاه</span>
                      </span>
                    )}
                    {(!node.status || node.status === 'pending') && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        <Clock size={9} />
                        <span>انتظار</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Icon + Title */}
                <div className="flex items-center gap-2 my-auto">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    node.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : node.status === 'in_progress'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : node.status === 'blocked'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {renderIcon(node.iconName, 12)}
                  </div>
                  <h4 className="text-xs font-bold text-white truncate flex-1 leading-snug">
                    {node.title}
                  </h4>
                </div>

                {/* Bottom Row: Deliverables Micro Bar & Details */}
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          node.status === 'completed'
                            ? 'bg-emerald-500'
                            : node.status === 'blocked'
                            ? 'bg-rose-500'
                            : 'bg-cyan-400'
                        }`}
                        style={{ width: `${nodeProgress}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] font-bold text-slate-300">
                      {completedDels}/{totalDels}
                    </span>
                  </div>
                  <span className="font-bold text-cyan-400 group-hover:underline flex items-center gap-0.5 text-[10px]">
                    <span>جزئیات</span>
                    <ChevronRight size={10} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ACTIVATION OVERLAY SHIELD: Protects Normal Page Scrolling Until Explicitly Activated */}
        {!isInteracting && (
          <div 
            onClick={() => setIsInteracting(true)}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/45 backdrop-blur-[2.5px] cursor-pointer transition-all duration-300 group"
          >
            <div className="flex flex-col items-center p-6 rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md group-hover:scale-105 group-hover:border-blue-500/60 transition-all duration-200 text-center max-w-sm mx-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg shadow-blue-500/20">
                <Lock size={22} />
              </div>
              <span className="text-sm font-black text-white">
                کلیک برای تعامل و جابه‌جایی نودها
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                جهت اسکرول آزادانه صفحه، بوم قفل است. با کلیک بر روی این بخش کنترل بزرگ‌نمایی و درگ فعال می‌شود.
              </span>
              <div className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/30">
                <span>فعال‌سازی بوم نودگراف</span>
                <MousePointerClick size={14} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FLOATING BOTTOM CONTROLS & STATUS LEGEND */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Real-Time Status & Bottleneck Indicator */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md pointer-events-auto text-xs">
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300 text-[10px] font-bold">تکمیل‌شده</span>
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-slate-300 text-[10px] font-bold">درحال اجرا (پالس نوری)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-slate-300 text-[10px] font-bold">مسیر بحرانی / گلوگاه</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 border-r border-slate-700/80">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-slate-400 text-[10px] font-bold">شاخه جایگزین (Ghost)</span>
          </div>
        </div>

        {/* Pan / Zoom Control Tools */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md pointer-events-auto">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="بزرگ‌نمایی (+)"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="کوچک‌نمایی (-)"
          >
            <ZoomOut size={14} />
          </button>
          <div className="h-3.5 w-px bg-slate-700" />
          <button
            onClick={handleResetZoom}
            className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            title="مقیاس پیش‌فرض"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={handleFitView}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="مرکزچینی خودکار (Fit to Screen)"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* CENTERED STANDARD TS ORBIT MODAL */}
      <NodeDetailModal
        node={selectedNode}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onToggleDeliverable={handleToggleDeliverable}
        onMarkNodeComplete={handleMarkNodeComplete}
        allNodes={activeRoadmapNodes}
      />

      {/* COMPARATIVE ARCHITECTURAL TRADE-OFF MODAL */}
      <ComparativeBranchModal
        isOpen={isComparativeModalOpen}
        onClose={() => {
          setIsComparativeModalOpen(false);
          setComparativeModalNode(null);
        }}
        clickedNode={comparativeModalNode}
        activeBranch={webBranch}
        onSwitchBranch={(newBranch) => {
          handleSwitchBranch(newBranch);
          setIsComparativeModalOpen(false);
        }}
        projectName={currentProject?.title}
      />
    </div>
  );
};

export default ProjectRoadmapGraph;
