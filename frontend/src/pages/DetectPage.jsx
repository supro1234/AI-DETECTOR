import React, { useState, useRef } from 'react'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8301';
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, ShieldAlert, CheckCircle, Info, Scan, Loader2, RefreshCw, Download, BarChart2, Activity, Terminal, AlertTriangle, Users, Cpu, Zap, Shield } from 'lucide-react'
import axios from 'axios'
import confetti from 'canvas-confetti'

// ── Confidence Ring ──────────────────────────────────────────────────────────
const ConfidenceRing = ({ score, color, label }) => {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(Math.max(parseFloat(score) || 0, 0), 100)
  const offset = circumference - (pct / 100) * circumference
  return (
    <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0 }}>
      <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
        <motion.circle
          cx="75" cy="75" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '2rem', fontWeight: 900, color, fontFamily: 'Outfit', lineHeight: 1 }}>
          {Math.round(pct)}%
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px', fontWeight: 700 }}>
          {label || 'AI CONF'}
        </span>
      </div>
    </div>
  )
}

// ── Model Performance Bar ────────────────────────────────────────────────────
const ModelBar = ({ label, score, color }) => (
  <div style={{ marginBottom: '1.2rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color }}>{score}%</span>
    </div>
    <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: '999px', boxShadow: `0 0 8px ${color}44` }}
      />
    </div>
  </div>
)

// ── Face Swap Alert ──────────────────────────────────────────────────────────
const FaceSwapAlert = ({ confidence }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    style={{
      background: 'rgba(255, 61, 113, 0.08)',
      border: '1px solid rgba(255, 61, 113, 0.4)',
      borderRadius: '16px', padding: '1.2rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '1rem',
      position: 'relative', overflow: 'hidden',
    }}
  >
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(135deg, rgba(255,61,113,0.05) 0%, transparent 100%)',
      animation: 'fsFade 2s ease-in-out infinite', pointerEvents: 'none'
    }} />
    <div style={{
      width: '44px', height: '44px', borderRadius: '50%',
      background: 'rgba(255,61,113,0.15)', border: '2px solid rgba(255,61,113,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      animation: 'fsPulse 1.8s ease-in-out infinite'
    }}>
      <Users size={20} color="#ff3d71" />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ff3d71', fontFamily: 'Outfit', letterSpacing: '1px', textTransform: 'uppercase' }}>
          ⚠ FACE SWAP DETECTED
        </span>
        {confidence > 0 && (
          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#000', background: '#ff3d71', padding: '2px 8px', borderRadius: '99px', letterSpacing: '1px' }}>
            {confidence}% CONF
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.72rem', color: 'rgba(255,61,113,0.75)', lineHeight: 1.4 }}>
        Forensic analysis identified face swap artifacts: boundary seams, skin tone mismatch, or texture discontinuities detected.
      </p>
    </div>
  </motion.div>
)

// ── Nudity Alert ─────────────────────────────────────────────────────────────
const NudityAlert = ({ confidence }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    style={{
      background: 'rgba(255, 107, 107, 0.08)',
      border: '1px solid rgba(255, 107, 107, 0.4)',
      borderRadius: '16px', padding: '1.2rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '1rem',
      position: 'relative', overflow: 'hidden',
    }}
  >
    <div style={{
      width: '44px', height: '44px', borderRadius: '50%',
      background: 'rgba(255,107,107,0.15)', border: '2px solid rgba(255,107,107,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <ShieldAlert size={20} color="#ff6b6b" />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ff6b6b', fontFamily: 'Outfit', letterSpacing: '1px', textTransform: 'uppercase' }}>
          ⚠ NSFW / NUDITY CONTENT DETECTED
        </span>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#000', background: '#ff6b6b', padding: '2px 8px', borderRadius: '99px', letterSpacing: '1px' }}>
          {confidence}% CONF
        </span>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'rgba(255,107,107,0.75)', lineHeight: 1.4 }}>
        Forensic neural scan identified explicit content. This media may violate standard safety guidelines.
      </p>
    </div>
  </motion.div>
)

// ── Source Chips ─────────────────────────────────────────────────────────────
const SourceChips = ({ sources }) => {
  if (!sources || sources.length === 0) return null
  const iconMap = { 
    'Gemini 2.0 Flash': <Zap size={10} />, 
    'Groq Llama-4 Scout': <Cpu size={10} />, 
    'OpenRouter (Gemini 2.0)': <Shield size={10} />, 
    'OpenRouter': <Shield size={10} />,
    'Hive AI': <Activity size={10} />
  }
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
      {sources.map(s => (
        <div key={s} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '0.6rem', fontWeight: 800, letterSpacing: '1px',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '3px 8px', borderRadius: '99px', color: 'var(--text-secondary)'
        }}>
          {iconMap[s] || <Shield size={10} />} {s}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DetectPage({ config, onReset }) {
  const [file, setFile]             = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const [result, setResult]         = useState(null)
  const [stage, setStage]           = useState('')
  const [consoleLog, setConsoleLog] = useState([])
  const [dragging, setDragging]     = useState(false)
  const [expandedPoint, setExpandedPoint] = useState(null)

  const fileInputRef    = useRef()
  const stageIntervalRef = useRef()

  const addLog = (cmd, text, type = 'info') => {
    const colors = { info: 'var(--accent-cyan)', warn: '#fbbf24', error: '#ef4444', success: '#10b981' }
    setConsoleLog(prev => [{ id: Math.random(), time: new Date().toLocaleTimeString().split(' ')[0], cmd, text, color: colors[type] }, ...prev].slice(0, 7))
  }

  const handleFileChange = (f) => {
    if (!f) return
    setFile(f); setResult(null); setConsoleLog([])
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview({ src: e.target.result })
      reader.readAsDataURL(f)
      addLog('SYS', `Evidence Loaded: ${f.name.slice(0, 18)}...`, 'success')
    }
  }

  const runAnalysis = async () => {
    if (!file) return
    setAnalyzing(true); setResult(null); setConsoleLog([])

    const stages = ['SYNCHRONIZING_CORES', 'RGB_GRID_EXTRACTION', 'NOISE_PATTERN_MAP', 'FACE_SWAP_SCAN', 'VERDICT_SYNTHESIS']
    addLog('CMD', `STAGING_FORENSIC_ENGINE`, 'info')
    let i = 0
    stageIntervalRef.current = setInterval(() => {
      setStage(stages[i % stages.length])
      addLog('SCAN', stages[i % stages.length], 'warn')
      i++
    }, 1200)

    try {
      const formData = new FormData()
      formData.append('file', file)
      // Always send all three keys — backend uses whichever are non-empty.
      // This ensures OpenRouter-only users don't get silent failures in fusion mode.
      formData.append('gemini_key',     config.provider === 'gemini'      ? config.apiKey : '')
      formData.append('groq_key',       config.provider === 'groq'        ? config.apiKey : '')
      formData.append('openrouter_key', config.provider === 'openrouter'  ? config.apiKey : '')
      formData.append('hive_access_key',config.hiveAccessKey || '')
      formData.append('hive_secret_key',config.hiveSecretKey || '')
      formData.append('mode', config.provider || 'fusion')

      const response = await axios.post(`${API_BASE}/api/analyze`, formData)
      clearInterval(stageIntervalRef.current)
      setResult(response.data)

      if (response.data.face_swap_detected) addLog('ALERT', 'FACE_SWAP_DETECTED ⚠', 'error')
      addLog('RES', 'FORENSIC_PAYLOAD_READY', 'success')

      if (response.data.verdict?.toLowerCase().includes('real')) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors: ['#6366f1', '#a855f7', '#06b6d4'] })
      }

      // Save to IndexedDB history
      try {
        const dbReq = indexedDB.open('AID_History', 1)
        dbReq.onupgradeneeded = (e) => {
          const db = e.target.result
          if (!db.objectStoreNames.contains('analyses'))
            db.createObjectStore('analyses', { keyPath: 'id', autoIncrement: true })
        }
        dbReq.onsuccess = (e) => {
          const db = e.target.result
          db.transaction('analyses', 'readwrite').objectStore('analyses').add({
            ...response.data, imageUrl: filePreview?.src, timestamp: new Date().toISOString()
          })
          addLog('SYS', 'ARCHIVE_RECORD_STORED', 'success')
        }
      } catch (_) { /* silently skip history save errors */ }

    } catch (err) {
      clearInterval(stageIntervalRef.current)
      addLog('ERR', 'NEURAL_LINK_SEVERED', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!result) return
    try {
      addLog('SYS', 'GENERATING_DOCX_REPORT...', 'info')
      const response = await axios.post(`${API_BASE}/api/generate-report`, {
        ...result, imageUrl: filePreview?.src || null
      }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Forensic_Report_${result.id || 'export'}.docx`)
      document.body.appendChild(link); link.click(); link.remove()
      addLog('SYS', 'REPORT_DOWNLOAD_STARTED', 'success')
    } catch (err) {
      addLog('ERR', 'REPORT_GENERATION_FAILED', 'error')
    }
  }

  const verdict    = result?.verdict?.toLowerCase() ?? ''
  const isReal     = verdict.includes('real')
  const isEnhanced = verdict.includes('enhanced')
  const isSuspicious = verdict.includes('suspicious')
  const isFaceSwap = result?.face_swap_detected === true || verdict.includes('face swap') || verdict.includes('deepfake');
  const vColor     = result
    ? (isFaceSwap ? '#ff3d71' : isReal ? 'var(--success)' : (isSuspicious ? 'var(--danger)' : 'var(--warning)'))
    : 'var(--accent-primary)'
  const mb = result?.model_breakdown || {}

  const forensicLabels = {
    face_geometry: 'Face Geometry', eye_iris: 'Eye & Iris', hair: 'Hair Coherence',
    skin_texture: 'Skin Texture', lighting_shadows: 'Lighting & Shadows',
    background_blend: 'Background', hands_fingers: 'Hands & Fingers',
    ear_nose_teeth: 'Ear/Nose/Teeth', compression: 'Compression', gan_diffusion: 'GAN/Diffusion',
    watermark_metadata: 'Watermark', text_in_image: 'Text in Image',
    reflections: 'Reflections', object_physics: 'Object Physics',
    overall_coherence: 'Overall Coherence', face_swap_analysis: '⚠ Face Swap Analysis',
    hive_natural: 'Hive Natural Texture', hive_animated: 'Hive Synthetic Signature',
    hive_hybrid: 'Hive Hybrid Artifacts', hive_deepfake_signal: 'Hive Forensic Signal',
    hive_nsfw_head: 'NSFW Content Detector', hive_suggestive: 'Suggestive Imagery Content'
  }

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass"
        style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}
      >
        <div className="scan-line" />

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem' }}>
          <div>
            <h2 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>Investigation Room</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div className="neon-glow" style={{ padding: '0.2rem 0.8rem', borderRadius: '4px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '1px' }}>{config.provider.toUpperCase()}_LINK_STABLE</span>
              </div>
              <Activity size={14} className="cyan-text" />
            </div>
          </div>
          <button onClick={onReset} className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.7rem' }}>
            <RefreshCw size={14} /> TERMINATE_SESSION
          </button>
        </div>

        {/* ── Content Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '3rem' }}>

          {/* Left: Upload + Console */}
          <div>
            {/* Telemetry Log */}
            <div className="glass" style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Terminal size={14} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '2px' }}>TELEMETRY_LOG</span>
                </div>
                <div style={{ width: '40px', height: '2px', background: analyzing ? 'var(--accent-cyan)' : 'var(--text-muted)', opacity: 0.5, borderRadius: '99px' }} />
              </div>
              <div style={{ height: '130px', display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'hidden' }}>
                {consoleLog.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>AWAITING_INPUT_SIGNAL...</span>
                )}
                {consoleLog.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', fontFamily: 'JetBrains Mono' }}>
                    <span style={{ color: 'var(--text-muted)' }}>[{log.time}]</span>
                    <span style={{ color: log.color, fontWeight: 700 }}>{log.cmd}:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{log.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Drop Zone ── */}
            <div
              onClick={() => !analyzing && fileInputRef.current.click()}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileChange(e.dataTransfer.files[0]) }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              style={{
                position: 'relative',
                borderRadius: '20px',
                cursor: analyzing ? 'not-allowed' : 'pointer',
                background: dragging
                  ? 'rgba(6,182,212,0.07)'
                  : file ? 'rgba(99,102,241,0.04)' : 'rgba(0,0,0,0.3)',
                border: `2px dashed ${dragging ? 'var(--accent-cyan)' : file ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'border-color 0.15s ease, background 0.15s ease',
                overflow: 'hidden',
                minHeight: file ? '0' : '260px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={e => handleFileChange(e.target.files[0])} />

              {/* Corner accents — visible only in empty state */}
              {!file && <>
                {[['0','0','borderTop','borderLeft'],['0','auto','borderTop','borderRight'],['auto','0','borderBottom','borderLeft'],['auto','auto','borderBottom','borderRight']].map(([t,r,b1,b2], idx) => (
                  <div key={idx} style={{
                    position:'absolute', top:t!=='auto'?8:undefined, right:r!=='auto'&&r!=='0'?8:undefined,
                    bottom:t==='auto'?8:undefined, left:r==='0'?8:undefined,
                    width:18, height:18,
                    borderTop: b1==='borderTop' ? '2px solid var(--accent-cyan)' : 'none',
                    borderBottom: b1==='borderBottom' ? '2px solid var(--accent-cyan)' : 'none',
                    borderLeft: b2==='borderLeft' ? '2px solid var(--accent-cyan)' : 'none',
                    borderRight: b2==='borderRight' ? '2px solid var(--accent-cyan)' : 'none',
                    opacity: dragging ? 1 : 0.4,
                    transition: 'opacity 0.15s',
                  }} />
                ))}
              </>}

              <AnimatePresence mode="wait">
                {file ? (
                  /* ── LOADED STATE ── */
                  <motion.div
                    key="loaded"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ width: '100%', padding: '1.8rem 2rem' }}
                  >
                    <div style={{ display: 'flex', gap: '1.8rem', alignItems: 'center' }}>
                      {/* Preview thumbnail */}
                      {filePreview && (
                        <div style={{
                          flexShrink: 0, width: '120px', height: '120px',
                          borderRadius: '14px', overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.12)',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          background: 'rgba(0,0,0,0.4)',
                        }}>
                          <img
                            src={filePreview.src}
                            alt="preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}

                      {/* File metadata */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Status badge */}
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: '99px', padding: '2px 10px', marginBottom: '10px',
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                          <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--success)', letterSpacing: '1px' }}>FILE LOADED</span>
                        </div>

                        {/* Filename */}
                        <h4 style={{
                          fontSize: '1rem', color: 'white', fontWeight: 800,
                          fontFamily: 'Outfit', marginBottom: '6px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {file.name}
                        </h4>

                        {/* Meta row */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                            padding: '2px 8px', borderRadius: '6px',
                          }}>
                            {file.type.split('/')[1]?.toUpperCase() || 'IMAGE'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                            {file.size >= 1024 * 1024
                              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                              : `${(file.size / 1024).toFixed(0)} KB`}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(99,102,241,0.7)', fontWeight: 700 }}>
                            {new Date(file.lastModified).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Change hint */}
                        <p style={{ marginTop: '10px', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                          Click or drop another image to replace
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ── EMPTY STATE ── */
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ textAlign: 'center', padding: '3rem 2rem' }}
                  >
                    {/* Animated upload icon wrapper */}
                    <div style={{
                      width: '72px', height: '72px', borderRadius: '50%',
                      background: dragging ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${dragging ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 1.5rem',
                      transition: 'all 0.15s ease',
                    }}>
                      <Upload size={30} color={dragging ? 'var(--accent-cyan)' : 'var(--text-muted)'} style={{ transition: 'color 0.15s ease' }} />
                    </div>

                    <h4 style={{
                      fontSize: '1.1rem', fontWeight: 900, fontFamily: 'Outfit',
                      color: dragging ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      letterSpacing: '0.5px', marginBottom: '8px',
                      transition: 'color 0.15s ease',
                    }}>
                      {dragging ? 'Release to Upload' : 'Drop Your Image Here'}
                    </h4>
                    <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      or <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>click to browse</span>
                    </p>

                    {/* Format chips */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {['JPG', 'PNG', 'WEBP', 'HEIC', 'AVIF', 'BMP'].map(fmt => (
                        <span key={fmt} style={{
                          fontSize: '0.58rem', fontWeight: 800, letterSpacing: '1px',
                          color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          padding: '2px 8px', borderRadius: '4px',
                        }}>{fmt}</span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Scan Button ── */}
            <button
              className="btn btn-primary shimmer neon-glow"
              style={{ width: '100%', height: '62px', marginTop: '1.5rem', fontSize: '1rem' }}
              disabled={analyzing || !file}
              onClick={runAnalysis}
            >
              {analyzing
                ? <><Loader2 className="animate-spin" size={20} /> RUNNING_DEEP_SCAN...</>
                : <><Scan size={20} /> COMMENCE_INVESTIGATION</>
              }
            </button>

            {/* ── Stage Indicator ── */}
            {analyzing && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p className="cyan-text" style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '0.8rem' }}>{stage}</p>
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: '40%', height: '100%',
                    background: 'var(--accent-cyan)',
                    boxShadow: '0 0 12px var(--accent-cyan)',
                    borderRadius: '999px',
                    animation: 'scan-sweep 2s linear infinite',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Results ── */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              >
                {/* Face Swap Alert */}
                {isFaceSwap && <FaceSwapAlert confidence={result.face_swap_confidence || 0} />}

                {/* Nudity Alert */}
                {result.nudity_detected && <NudityAlert confidence={result.nudity_confidence || 0} />}

                {/* Verdict Card */}
                <div className="glass" style={{
                  padding: '2rem',
                  border: `1px solid ${vColor}`,
                  background: `rgba(${isFaceSwap ? '255,61,113' : isReal ? '16,185,129' : isEnhanced ? '245,158,11' : '239,68,68'}, 0.05)`
                }}>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    <ConfidenceRing 
                      score={isReal ? 100 - result.confidence_score : result.confidence_score} 
                      color={vColor} 
                      label={isReal ? 'CONFIDENCE' : 'AI CONF'}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem' }}>
                        {isFaceSwap   ? <AlertTriangle size={22} color="#ff3d71" />
                          : isReal    ? <CheckCircle   size={22} color="var(--success)" />
                          : isEnhanced? <Info          size={22} color="var(--warning)" />
                          :             <ShieldAlert   size={22} color="var(--danger)" />
                        }
                        <h3 style={{ fontSize: '1.6rem', color: vColor, lineHeight: 1 }}>
                          {result.verdict?.toUpperCase()}
                        </h3>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.6 }}>
                        {result.error ? `API Error: ${result.error}` : (result.explanation || 'Awaiting forensic synthesis...')}
                      </p>
                      {result._fusion_note?.includes('rate-limit') && (
                        <div style={{ marginTop: '8px', fontSize: '0.65rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', padding: '4px 8px', border: '1px solid rgba(245,158,11,0.2)' }}>
                          ⚡ {result._fusion_note}
                        </div>
                      )}
                      <SourceChips sources={result._sources_used} />
                    </div>
                  </div>
                </div>

                {/* Model Stats */}
                <div className="glass" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    <BarChart2 size={16} className="cyan-text" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '2px' }}>NEURAL_BROKERS</span>
                  </div>
                  <ModelBar label="NPR_FORENSICS"  score={100 - (mb.npr     || 0)} color="var(--accent-primary)" />
                  <ModelBar label="UFD_SIGNATURE"  score={100 - (mb.ufd     || 0)} color="var(--accent-secondary)" />
                  <ModelBar label="CROSS_EFF_VIT"  score={100 - (mb.crossvit || 0)} color="var(--accent-cyan)" />
                </div>

                {/* Forensic Points */}
                {result.forensic_points && Object.keys(result.forensic_points).length > 0 && (
                  <div className="glass" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                      <Scan size={16} className="cyan-text" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '2px' }}>FORENSIC_POINTS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(result.forensic_points).map(([key, value]) => {
                        if (!value) return null
                        if (key === 'face_swap_analysis' && result.verdict !== 'Face Swap') return null
                        const isFsPoint = key === 'face_swap_analysis'
                        return (
                          <div
                            key={key}
                            onClick={() => setExpandedPoint(expandedPoint === key ? null : key)}
                            style={{
                              padding: '0.7rem 1rem', borderRadius: '10px', cursor: 'pointer',
                              background: isFsPoint ? 'rgba(255,61,113,0.07)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isFsPoint ? 'rgba(255,61,113,0.2)' : 'rgba(255,255,255,0.05)'}`,
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isFsPoint ? '#ff3d71' : 'var(--accent-cyan)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                {forensicLabels[key] || key}
                              </span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{expandedPoint === key ? '▲' : '▼'}</span>
                            </div>
                            {expandedPoint === key && (
                              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '8px' }}>
                                {value}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => { setResult(null); setFile(null); setFilePreview(null) }}
                    className="btn btn-outline"
                    style={{ flex: 1, height: '52px' }}
                  >
                    NEW_CASE
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="btn btn-primary"
                    style={{ flex: 1, height: '52px' }}
                  >
                    <Download size={18} /> DOWNLOAD_REPORT
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
