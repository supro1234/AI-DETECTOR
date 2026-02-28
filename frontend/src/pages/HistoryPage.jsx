import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { History, Trash2, Calendar, FileText, Activity, ShieldCheck, ShieldAlert, ChevronDown, Filter, Loader2 } from 'lucide-react'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('AID_History', 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('analyses')) {
        db.createObjectStore('analyses', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess  = (e) => resolve(e.target.result)
    req.onerror    = () => reject(req.error)
  })
}

async function getAllAnalyses() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction('analyses', 'readonly')
    const req = tx.objectStore('analyses').getAll()
    req.onsuccess = () => resolve(req.result.reverse())
  })
}

async function deleteAnalysis(id) {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction('analyses', 'readwrite')
    tx.objectStore('analyses').delete(id)
    tx.oncomplete = resolve
  })
}

async function clearAll() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction('analyses', 'readwrite')
    tx.objectStore('analyses').clear()
    tx.oncomplete = resolve
  })
}

const FILTERS = ['ALL', 'REAL', 'FAKE', 'AI GENERATED', 'DEEPFAKE']

export default function HistoryPage() {
  const [items, setItems]     = useState([])
  const [filter, setFilter]   = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setItems(await getAllAnalyses())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'ALL' ? items : items.filter(i =>
    i.verdict?.toLowerCase()?.includes(filter.toLowerCase()) ?? false
  )

  const doDelete = async (id) => {
    await deleteAnalysis(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const doClear = async () => {
    if (!confirm('EXTERMINATE ALL REMAINING ARCHIVES?')) return
    await clearAll()
    setItems([])
    setSelected(null)
  }

  return (
    <div className="page-container">
      {/* Header Unit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>Forensic Archives</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Activity size={14} className="cyan-text" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '2px' }}>
              {items.length} RECORDS_LOCAL_SYNC
            </span>
          </div>
        </div>
        {items.length > 0 && (
          <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.65rem' }} onClick={doClear}>
            <Trash2 size={12} /> PURGE_DATABASE
          </button>
        )}
      </div>

      {/* Filter Matrix */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
         <div style={{ display:'flex', alignItems:'center', gap:8 }}>
           <Filter size={14} color="var(--accent-cyan)" />
           <span style={{ fontSize: '0.65rem', fontWeight:900, color: 'var(--text-muted)', letterSpacing: '1px' }}>FILTER_BY:</span>
         </div>
         <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s',
                  background: filter === f ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  borderColor: filter === f ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: filter === f ? 'white' : 'var(--text-muted)'
                }}
              >
                {f}
              </button>
            ))}
         </div>
      </div>

      {loading ? (
        <div style={{ height: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass" style={{ padding: '6rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.05)', background: 'transparent' }}>
          <History size={48} color="var(--text-muted)" style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '1px' }}>NO ARCHIVE RECORDS DETECTED IN NODE</h4>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filtered.map(item => {
            const isReal = item.verdict?.toLowerCase().includes('real')
            const vColor = isReal ? 'var(--success)' : 'var(--danger)'
            return (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className="glass-card"
                style={{ 
                  background: 'var(--glass-bg)', padding: '1.5rem', cursor: 'pointer',
                  border: selected?.id === item.id ? `1px solid ${vColor}` : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: selected?.id === item.id ? `0 0 20px ${vColor}22` : 'none'
                }}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
              >
                {/* Thumbnail Layer */}
                {item.imageUrl && (
                  <div style={{ position: 'relative', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="shimmer" style={{ width: '100%', height: '100%' }}>
                      <img src={item.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.8)' }} alt="" 
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none' }}
                      />
                    </div>
                    <div className="neon-glow" style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '0.4rem 0.85rem', borderRadius: '6px', border: `1px solid ${vColor}` }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: vColor, letterSpacing: '1px' }}>{item.verdict.toUpperCase()}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 900, color: 'white', letterSpacing: '0.5px', marginBottom: '0.4rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {item.file_name || "Neural Reconstruction"}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={12} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {new Date(item.timestamp || item.analyzed_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: vColor, fontFamily: 'Outfit' }}>
                      {item.confidence || item.confidence_score}<span style={{ fontSize: '0.8rem', opacity: 0.6 }}>%</span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {selected?.id === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                           <FileText size={14} color="var(--accent-cyan)" />
                           <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing:'1px' }}>CASE_EXPLANATION</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{item.explanation}</p>
                        
                        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem' }}>
                          <button onClick={(e) => { e.stopPropagation(); doDelete(item.id) }} style={{ flex: 1, padding: '0.6rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', borderRadius: '6px' }}>
                            PURGE_RECORD
                          </button>
                          <button style={{ flex: 1, padding: '0.6rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', borderRadius: '6px' }}>
                            EXPORT_AS_PDF
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
