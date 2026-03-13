import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import { Sparkles, CheckCircle2, Orbit, Zap, Rocket, Github, Info, Activity } from 'lucide-react'

const SEASONS = [
  {
    season: 'Season 1',
    label: 'LIVE_ACTIVE',
    status: 'live',
    color: 'var(--success)',
    title: 'Image Forensics Cluster',
    features: [
      '✅ Full-Spectrum Image Analysis (AVIF, HEIC…)',
      '✅ Dual-API Fusion Pipeline (Gemini/Groq)',
      '✅ 15-Point Neural Forensic Signature Check',
      '✅ GAN & Diffusion Artifact Mapping',
      '✅ Cinematic 3D Background Interactivity',
      '✅ Local Archive Persistence (IndexedDB)',
    ],
  },
  {
    season: 'Season 2',
    label: 'QUEUED_STAGING',
    status: 'soon',
    color: 'var(--accent-secondary)',
    title: 'AV & Multi-Modal Sync',
    subtitle: 'Full multimedia deepfake detection — video frames + audio transcription',
    features: [
      '🎥 FRAME_BY_FRAME — Deepfake Extraction',
      '🎥 TEMPORAL_SYNC — Lip & Motion Inconsistency',
      '🎥 ARTIFACT_TRACK — Compressed Stream Support',
      '🔊 VOICE_PULSE — AI-Cloned Speech Detection',
      '🔊 SEMANTIC_MAP — Groq-Whisper Anomaly Check',
      '🔊 FRQ_ANALYSIS — Audio Forensic Scoring',
    ],
  },
  {
    season: 'Season 3',
    label: 'PLANNED_GRID',
    status: 'planned',
    color: 'var(--accent-cyan)',
    title: 'Orchestration & Extension',
    features: [
      '🔮 BATCH_SYNC — Cluster Analysis (100+ items)',
      '🔮 NODE_PLUGIN — Browser Forensic Extension',
      '🔮 FEED_SCAN — Social Media Stream Guard',
      '🔮 API_BRIDGE — External Developer Access',
      '🔮 PROGRESSION — Confidence Trend Visuals',
    ],
  },
  {
    season: 'Season 4',
    label: 'FUTURE_VISION',
    status: 'vision',
    color: 'var(--accent-vivid)',
    title: 'On-Device Edge Lab',
    features: [
      '🌟 WEB_CAM — Real-Time Deepfake Guard',
      '🌟 EDGE_NODE — On-Device Inference (No API)',
      '🌟 MOBILE_UNIT — Dedicated iOS/Android Port',
      '🌟 LOW_LATENCY — Sub-10ms Inference Speed',
      '🌟 TEAM_HUB — Collaborative Forensic Workspaces',
    ],
  },
]

function MiniParticles({ color }) {
  const ref = useRef()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene    = new THREE.Scene()
    const camera   = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.z = 3
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const N = 400
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random()-0.5)*5
      pos[i*3+1] = (Math.random()-0.5)*5
      pos[i*3+2] = (Math.random()-0.5)*2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const m = new THREE.PointsMaterial({ size: 0.03, color: new THREE.Color(color), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    const pts = new THREE.Points(g, m)
    scene.add(pts)

    let frame
    let t = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      t += 0.008
      pts.rotation.y = t * 0.2
      pts.rotation.x = t * 0.05
      renderer.render(scene, camera)
    }
    animate()
    return () => { cancelAnimationFrame(frame); renderer.dispose(); if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement) }
  }, [color])
  return <div ref={ref} style={{ position:'absolute', inset:0, opacity:0.15, pointerEvents:'none' }} />
}

export default function UpcomingPage() {
  return (
    <div className="page-container">
      {/* Cinematic Header */}
      <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
        <motion.div 
          initial={{ opacity:0, y: 10 }} 
          animate={{ opacity:1, y: 0 }}
          style={{ display: 'inline-flex', alignItems:'center', gap: 8, padding: '0.4rem 1.2rem', borderRadius: 20, marginBottom: '1.5rem',
            background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
        >
          <Sparkles size={14} className="cyan-text" />
          <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 900, letterSpacing: '2px' }}>STRATEGIC_ROADMAP</span>
        </motion.div>
        
        <h1 className="gradient-text" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>Evolution Core</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
          Advancing the frontier of media verification. Each module represents a phase in our mission to neutralize synthetic deception.
        </p>
      </div>

      {/* Mission Modules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
        {SEASONS.map((s, idx) => (
          <motion.div 
            key={s.season}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card" 
            style={{ 
              padding: '2rem', position: 'relative', overflow: 'hidden', minHeight: '400px', display:'flex', flexDirection:'column',
              background: 'rgba(5, 5, 12, 0.85)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${s.color}33`
            }}
          >
            <MiniParticles color={s.color} />
            <div className="scan-line" style={{ animationDelay: `${idx * 0.5}s` }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Module Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
                <span style={{ fontSize:'0.65rem', fontWeight:900, letterSpacing:2, color: s.color }}>{s.season}</span>
                <div style={{ 
                  fontSize:'0.6rem', padding:'0.3rem 0.8rem', borderRadius:'6px',
                  background: 'rgba(0,0,0,0.5)', border: `1px solid ${s.color}44`, 
                  color: s.color, fontWeight:900, letterSpacing: '1px' 
                }}>
                  {s.label}
                </div>
              </div>

              <h3 style={{ fontSize:'1.4rem', fontWeight:800, marginBottom:'1.5rem', color:'white', fontFamily:'Outfit' }}>
                {s.title}
              </h3>

              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {s.features.map((f, i) => (
                  <div key={i} style={{ 
                    fontSize:'0.78rem', color: s.status === 'live' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
                    opacity: 1,
                    display: 'flex', alignItems: 'flex-start', gap: '8px'
                  }}>
                    <div style={{ minWidth:'4px', height:'4px', borderRadius:'50%', background: s.color, marginTop:'7px' }} />
                    <span style={{ lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {s.status === 'soon' && (
              <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                <div className="neon-glow" style={{ padding: '0.8rem', borderRadius: '8px', textAlign:'center',
                  background: 'rgba(99, 102, 241, 0.05)', border:'1px solid rgba(99, 102, 241, 0.2)',
                  fontSize:'0.65rem', color:'var(--accent-primary)', fontWeight:900, letterSpacing:'1px' }}>
                  <Activity size={12} style={{ marginRight: 8, verticalAlign:'middle' }} /> 
                  MONITORING_SIGNAL
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer Lab Stats */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity:1 }}
        className="glass" style={{ marginTop: '5rem', padding: '4rem', textAlign: 'center', position:'relative' }}
      >
        <div style={{ 
          position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', 
          width: '60px', height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)' 
        }} />
        
        <Rocket size={40} className="cyan-text" style={{ marginBottom: '1.5rem', opacity: 0.6 }} />
        <h3 style={{ fontWeight: 900, fontSize: '2rem', marginBottom: '1rem', fontFamily:'Outfit' }}>EVALUATE_FEEDBACK</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem' }}>
          Our neural architecture is shaped by investigative requirements. Propose new modules to our core development grid.
        </p>
        
        <div style={{ display:'flex', gap:'1.5rem', justifyContent:'center', flexWrap:'wrap', alignItems:'center' }}>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="btn btn-primary shimmer">
            <Github size={18} /> OPEN_SOURCE_ARCHIVE
          </a>
          <div style={{ 
            display:'flex', alignItems:'center', gap:'0.8rem', padding:'0.8rem 1.5rem',
            borderRadius:'12px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)',
            fontSize:'0.75rem', fontWeight: 900, color: 'var(--accent-cyan)', letterSpacing: '1px' 
          }}>
            <Zap size={14} /> ACTIVE: SEASON_01_DEPLOAYED
          </div>
        </div>
      </motion.div>
    </div>
  )
}
