import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileImage, ShieldAlert, CheckCircle, Info, Scan, Loader2, RefreshCw, Link2, Download, X, BarChart2, Activity, Terminal } from 'lucide-react'
import axios from 'axios'
import confetti from 'canvas-confetti'

// ── Confidence Ring (Energy Pulse Version) ──────────────────────────────────
const ConfidenceRing = ({ score, color }) => {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(Math.max(parseFloat(score) || 0, 0), 100)
  const offset = circumference - (pct / 100) * circumference
  
  return (
    <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0 }}>
      <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
        <motion.circle
          cx="75" cy="75" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${color})` }}
        />
        {/* Pulsing Outer Ring */}
        <motion.circle
          cx="75" cy="75" r={radius + 6} fill="none"
          stroke={color} strokeWidth="1"
          animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ fontSize: '2rem', fontWeight: 900, color, fontFamily:'Outfit', lineHeight: 1 }}
        >
          {Math.round(pct)}%
        </motion.span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '4px', fontWeight: 700 }}>VERACITY</span>
      </div>
    </div>
  )
}

// ── Model Performance Bar ───────────────────────────────────────────────────
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
        transition={{ duration: 1, delay: 0.5 }}
        style={{ height: '100%', background: color, borderRadius: '999px', boxShadow: `0 0 10px ${color}44` }}
      />
    </div>
  </div>
)

export default function DetectPage({ config, onReset }) {
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [stage, setStage] = useState('')
  const [consoleLog, setConsoleLog] = useState([])
  const [tab, setTab] = useState('file')
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  
  const fileInputRef = useRef()
  const stageIntervalRef = useRef()

  const addLog = (cmd, text, type = 'info') => {
    const colors = { info: 'var(--accent-cyan)', warn: '#fbbf24', error: '#ef4444', success: '#10b981' }
    setConsoleLog(prev => [{ id: Math.random(), time: new Date().toLocaleTimeString().split(' ')[0], cmd, text, color: colors[type] }, ...prev].slice(0, 7))
  }

  const handleFileChange = (f) => {
    setFile(f); setResult(null); setConsoleLog([])
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview({ type: 'image', src: e.target.result })
      reader.readAsDataURL(f)
      addLog("SYS", `Evidence Loaded: ${f.name.slice(0, 15)}...`, 'success')
    }
  }

  const runAnalysis = async () => {
    setAnalyzing(true); setResult(null); setConsoleLog([])
    const stages = ["SYNCHRONIZING_CORES", "RGB_GRID_EXTRACTION", "NOISE_PATTERN_MAP", "VERDICT_SYNTHESIS"]
    addLog("CMD", "STAGING_FORENSIC_ENGINE", 'info')
    
    let i = 0
    stageIntervalRef.current = setInterval(() => {
      setStage(stages[i % stages.length])
      addLog("SCAN", stages[i % stages.length], 'warn')
      i++
    }, 1200)

    try {
      let response
      if (tab === 'url') {
        response = await axios.post('http://localhost:8301/api/analyze-url', {
          gemini_key: config.provider === 'gemini' ? config.apiKey : '',
          groq_key: config.provider === 'groq' ? config.apiKey : '',
          openrouter_key: config.provider === 'openrouter' ? config.apiKey : '',
          url: urlInput
        })
      } else {
        const formData = new FormData()
        formData.append('file', file)
        if (config.provider === 'gemini') formData.append('gemini_key', config.apiKey)
        else if (config.provider === 'groq') formData.append('groq_key', config.apiKey)
        else if (config.provider === 'openrouter') formData.append('openrouter_key', config.apiKey)
        response = await axios.post('http://localhost:8301/api/analyze', formData)
      }
      
      clearInterval(stageIntervalRef.current)
      setResult(response.data)
      addLog("RES", "FORENSIC_PAYLOAD_READY", 'success')
      
      if (response.data.verdict?.toLowerCase().includes('real')) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 }, colors: ['#6366f1', '#a855f7', '#06b6d4'] })
      }
    } catch (err) {
      clearInterval(stageIntervalRef.current)
      addLog("ERR", "NEURAL_LINK_SEVERED", 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const verdict = result?.verdict?.toLowerCase() ?? ''
  const isReal = verdict.includes('real')
  const isEnhanced = verdict.includes('enhanced') || verdict.includes('suspicious')
  
  const vColor = result 
    ? (isReal ? 'var(--success)' : isEnhanced ? 'var(--warning)' : 'var(--danger)')
    : 'var(--accent-primary)'
  const mb = result?.model_breakdown || {}

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass"
        style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}
      >
        <div className="scan-line" />

        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem' }}>
          <div>
            <h2 className="gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>Investigation Room</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div className="neon-glow" style={{ padding: '0.2rem 0.8rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                 <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '1px' }}>{config.provider.toUpperCase()}_LINK_STABLE</span>
              </div>
              <Activity size={14} className="cyan-text" />
            </div>
          </div>
          <button onClick={onReset} className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.7rem' }}>
            <RefreshCw size={14} /> TERMINATE_SESSION
          </button>
        </div>

        {/* Command Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '3rem' }}>
          
          {/* Left: Input Console */}
          <div>
            <div className="glass" style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Terminal size={14} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '2px' }}>TELEMETRY_LOG</span>
                 </div>
                 <div style={{ width: '40px', height: '2px', background: analyzing ? 'var(--accent-cyan)' : 'var(--text-muted)', opacity: 0.5 }} />
               </div>
               <div style={{ height: '140px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 {consoleLog.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>AWAITING_INPUT_SIGNAL...</span>}
                 {consoleLog.map(log => (
                   <div key={log.id} style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', fontFamily: 'JetBrains Mono' }}>
                     <span style={{ color: 'var(--text-muted)' }}>[{log.time}]</span>
                     <span style={{ color: log.color, fontWeight: 700 }}>{log.cmd}:</span>
                     <span style={{ color: 'var(--text-primary)' }}>{log.text}</span>
                   </div>
                 ))}
               </div>
            </div>

            {/* Sub-Tabs */}
            <div style={{ display:'flex', gap:8, marginBottom:24 }}>
               {[['file', Scan, 'LOCAL_UPLOAD'], ['url', Link2, 'NET_STREAM']].map(([t, Icon, label]) => (
                 <button key={t} onClick={() => setTab(t)} style={{
                   flex: 1, padding: '1rem', border: '1px solid', borderRadius: '12px', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'var(--transition)',
                   background: tab === t ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                   borderColor: tab === t ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                   color: tab === t ? 'white' : 'var(--text-muted)'
                 }}>
                    <Icon size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1px' }}>{label}</span>
                 </button>
               ))}
            </div>

            <div style={{ position: 'relative' }}>
               {tab === 'file' ? (
                 <div 
                   onClick={() => !analyzing && fileInputRef.current.click()}
                   onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileChange(e.dataTransfer.files[0]) }}
                   onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                   onDragLeave={() => setDragging(false)}
                   className="glass shimmer"
                   style={{ 
                     padding: '3rem 2rem', border: `2px dashed ${dragging ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)'}`,
                     textAlign: 'center', cursor: 'pointer', transition: 'var(--transition)', background: dragging ? 'rgba(6, 182, 212, 0.05)' : 'rgba(0,0,0,0.2)'
                   }}
                 >
                   <input type="file" ref={fileInputRef} hidden onChange={e => handleFileChange(e.target.files[0])} />
                   <AnimatePresence mode="wait">
                     {file ? (
                       <motion.div key="p" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                          {filePreview && <img src={filePreview.src} style={{ maxHeight: '140px', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)' }} alt="" />}
                          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{file.name}</h4>
                          <p style={{ color: 'var(--accent-cyan)', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>READY_FOR_SCAN</p>
                       </motion.div>
                     ) : (
                       <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '1px' }}>DEPOSIT_FILE_FOR_ANALYSIS</h4>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div style={{ position: 'relative' }}>
                     <Link2 size={16} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-cyan)' }} />
                     <input className="neural-input" style={{ paddingLeft: '3.5rem' }} placeholder="RESOURCE_URL (HTTPS://...)" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
                   </div>
                 </div>
               )}
            </div>

            <button 
              className={`btn btn-primary shimmer neon-glow`}
              style={{ width: '100%', height: '64px', marginTop: '2.5rem', fontSize: '1rem' }}
              disabled={analyzing || (tab === 'file' ? !file : !urlInput)}
              onClick={runAnalysis}
            >
              {analyzing ? <><Loader2 className="animate-spin" /> RUNNING_DEEP_SCAN...</> : <><Scan /> COMMENCE_INVESTIGATION</>}
            </button>

            {analyzing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '2rem', textAlign: 'center' }}>
                <p className="cyan-text" style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '2px', marginBottom: '1rem' }}>{stage}</p>
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                  <motion.div animate={{ left: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 2 }} style={{ position: 'relative', width: '40%', height: '100%', background: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-cyan)' }} />
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Forensic Reports */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Verdict Card */}
                <div className="glass" style={{ 
                  padding: '2rem', 
                  border: `1px solid ${vColor}`, 
                  background: `rgba(${isReal ? '16,185,129' : (isEnhanced ? '245,158,11' : '239,68,68')}, 0.05)` 
                }}>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <ConfidenceRing score={100 - result.confidence_score} color={vColor} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.6rem' }}>
                        {isReal ? <CheckCircle size={24} color="var(--success)" /> : isEnhanced ? <Info size={24} color="var(--warning)" /> : <ShieldAlert size={24} color="var(--danger)" />}
                        <h3 style={{ fontSize: '2rem', color: vColor }}>{result.verdict?.toUpperCase()}</h3>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.5', maxWidth: '300px' }}>
                        {result.explanation ? result.explanation.slice(0, 140) + '...' : 'Awaiting forensic synthesis...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Model Stats */}
                <div className="glass" style={{ padding: '2rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                     <BarChart2 size={16} className="cyan-text" />
                     <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '2px' }}>NEURAL_BROKERS</span>
                   </div>
                   <ModelBar label="NPR_FORENSICS" score={100 - (mb.npr || 0)} color="var(--accent-primary)" />
                   <ModelBar label="UFD_SIGNATURE" score={100 - (mb.ufd || 0)} color="var(--accent-secondary)" />
                   <ModelBar label="CROSS_EFF_VIT" score={100 - (mb.crossvit || 0)} color="var(--accent-cyan)" />
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap: '1rem' }}>
                  <button onClick={() => { setResult(null); setFile(null); setFilePreview(null) }} className="btn btn-outline" style={{ flex: 1, height: '54px' }}>NEW_CASE</button>
                  <button className="btn btn-primary" style={{ flex: 1, height: '54px' }}>
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
