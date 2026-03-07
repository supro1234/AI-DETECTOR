import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ShieldCheck, Zap, AlertCircle, ArrowRight, Loader2, Eye, EyeOff, Key, Terminal, Star, ExternalLink, Crown } from 'lucide-react'
import axios from 'axios'

export default function SetupPage({ onConnect }) {
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const handleTestConnection = async () => {
    if (!apiKey) {
      setStatus({ type: 'error', message: 'CRITICAL: Neural Access Token Required' })
      return
    }
    setTesting(true)
    setStatus({ type: 'info', message: 'Synchronizing neural link...' })

    try {
      console.log('[CONN_DEBUG] Cleaning previous session identifiers');
      sessionStorage.removeItem('gemini_key')
      sessionStorage.removeItem('groq_key')
      sessionStorage.removeItem('openrouter_key')

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8301';
      console.log(`[CONN_DEBUG] Requesting connection sync for: ${provider} at ${API_BASE}`);
      const response = await axios.post(`${API_BASE}/api/test-connection`, { 
        provider, 
        api_key: apiKey 
      })
      
      if (response.data.success) {
        console.log('[CONN_DEBUG] Connection verified by backend');
        setStatus({ type: 'success', message: 'SYNERGY ESTABLISHED. Accessing Laboratory...' })
        sessionStorage.setItem(`${provider}_key`, apiKey)
        
        console.log('[CONN_DEBUG] Triggering onConnect transition');
        onConnect({ provider, apiKey })
      } else {
        console.warn('[CONN_DEBUG] Backend rejected connection:', response.data.message);
        setStatus({ type: 'error', message: response.data.message || 'LINK ARCHITECTURE REJECTED' })
      }
    } catch (error) {
      console.error('[CONN_DEBUG] Error during connection sync:', error);
      const errorMsg = error.response?.data?.message || error.message || 'CONNECTION SEVERED';
      setStatus({ type: 'error', message: `ERROR: ${errorMsg}` })
    } finally {
      setTesting(false)
    }
  }

  // Provider definitions — Gemini is flagged as enterprise
  const providers = [
    { 
      id: 'gemini', 
      label: 'Gemini 2.0', 
      sub: 'Google AI Studio', 
      icon: Zap, 
      color: '#f59e0b',
      enterprise: true,
      enterpriseLabel: 'ENTERPRISE BEST',
      apiLink: 'https://aistudio.google.com/apikey',
      apiLinkLabel: 'Get Enterprise Key →'
    },
    { 
      id: 'groq', 
      label: 'Groq Llama', 
      sub: 'Scout Array', 
      icon: Cpu, 
      color: 'var(--accent-cyan)',
      enterprise: false
    },
    { 
      id: 'openrouter', 
      label: 'OpenRouter', 
      sub: 'Multi-Model Gateway', 
      icon: ShieldCheck, 
      color: 'var(--accent-primary)',
      enterprise: false
    },
  ]

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, perspective: '1000px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="glass"
        style={{ width: '100%', maxWidth: '500px', padding: '3rem 2.5rem', position: 'relative' }}
      >
        {/* Cinematic Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{ marginBottom: '1.5rem', display: 'inline-block' }}
          >
            <div style={{ 
              padding: '1rem', 
              borderRadius: '50%', 
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.2)'
            }}>
              <ShieldCheck size={42} className="gradient-text" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </motion.div>
          
          <h1 className="gradient-text" style={{ fontSize: '3.2rem', marginBottom: '0.2rem' }}>
            AI DETECTOR
          </h1>
          <div style={{ color: 'var(--accent-cyan)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 700, opacity: 0.8 }}>
            NEURAL FORENSIC COMMAND
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginTop: '1.2rem' }}>
            <div className="neon-glow" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--success)', letterSpacing: '2px', fontWeight: 800 }}>D-LINK SECURE</span>
          </div>
        </div>

        {/* Intelligence Selection */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <Terminal size={14} color="var(--accent-cyan)" />
            <span style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text-secondary)', letterSpacing:'1px', textTransform:'uppercase' }}>INIT_PROVIDER</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {providers.map(({ id, label, sub, icon: Icon, color, enterprise, enterpriseLabel, apiLink, apiLinkLabel }) => (
              <motion.div key={id} style={{ position: 'relative' }}>
                {/* Enterprise Crown Badge */}
                {enterprise && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.25 }}
                    style={{
                      position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                      zIndex: 10, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                      borderRadius: '99px', padding: '2px 10px',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      boxShadow: '0 0 16px rgba(245,158,11,0.5)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Crown size={9} color="#000" />
                    <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#000', letterSpacing: '1px' }}>{enterpriseLabel}</span>
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setProvider(id)}
                  className="glass-card"
                  style={{
                    width: '100%',
                    padding: enterprise ? '1.8rem 0.8rem 1.2rem' : '1.5rem 0.8rem',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem',
                    border: '1px solid',
                    cursor:'pointer',
                    borderColor: provider === id ? color : enterprise ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                    background: provider === id 
                      ? enterprise ? `rgba(245,158,11,0.08)` : `rgba(255,255,255,0.03)` 
                      : enterprise ? 'rgba(245,158,11,0.03)' : 'transparent',
                    boxShadow: provider === id ? `0 0 30px ${color}25` : enterprise ? '0 0 20px rgba(245,158,11,0.1)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  }}
                >
                  <Icon size={22} color={provider === id ? color : enterprise ? '#f59e0b88' : 'var(--text-muted)'} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: provider === id ? 'white' : enterprise ? '#f0c060' : 'var(--text-secondary)', textAlign:'center' }}>{label}</span>
                  <span style={{ fontSize: '0.55rem', color: enterprise ? 'rgba(245,158,11,0.6)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', textAlign:'center' }}>{sub}</span>
                </motion.button>
              </motion.div>
            ))}
          </div>

          {/* Enterprise Gemini Info Panel */}
          <AnimatePresence>
            {provider === 'gemini' && (
              <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 14 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  overflow: 'hidden',
                  borderRadius: '12px',
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  padding: '1rem 1.2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Star size={13} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px' }}>RECOMMENDED FOR ENTERPRISE & PROFESSIONAL USE</span>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'rgba(245,158,11,0.7)', lineHeight: 1.5, marginBottom: '8px' }}>
                  Google Gemini 2.0 Flash delivers the highest accuracy multimodal vision for production forensic workloads. For high-volume use, upgrade via Google AI Studio.
                </p>
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b',
                    textDecoration: 'none', letterSpacing: '1px',
                    background: 'rgba(245,158,11,0.12)', padding: '4px 10px',
                    borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)'
                  }}
                >
                  <ExternalLink size={10} /> GET API KEY → AI STUDIO
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Access Token */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <Key size={14} color="var(--accent-cyan)" />
            <span style={{ fontSize:'0.75rem', fontWeight:800, color:'var(--text-secondary)', letterSpacing:'1px', textTransform:'uppercase' }}>AUTH_TOKEN</span>
          </div>
          
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              className="neural-input"
              placeholder="ENTER API KEY"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestConnection()}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          className={`btn btn-primary shimmer ${testing || !apiKey ? 'disabled' : ''}`}
          style={{ 
            width: '100%', height: '60px', borderRadius: '12px', opacity: testing || !apiKey ? 0.6 : 1,
            background: provider === 'gemini' && apiKey ? 'linear-gradient(135deg, #f59e0b22, rgba(99,102,241,0.15))' : undefined,
            borderColor: provider === 'gemini' && apiKey ? '#f59e0b' : undefined,
          }}
          disabled={testing || !apiKey}
          onClick={handleTestConnection}
        >
          {testing ? (
            <><Loader2 className="animate-spin" size={20} /> INITIALIZING LINK...</>
          ) : (
            <>SYNC CONNECTION <ArrowRight size={18} /></>
          )}
        </button>

        {/* Feedback Messages */}
        <AnimatePresence>
          {status.message && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', gap: '0.8rem',
                fontSize: '0.75rem',
                fontFamily: 'JetBrains Mono, monospace',
                ...(status.type === 'error'
                  ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
                  : status.type === 'success'
                  ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
                  : { background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)' })
              }}
            >
              {status.type === 'error' ? <AlertCircle size={16} /> : status.type === 'success' ? <ShieldCheck size={16} /> : <Loader2 className="animate-spin" size={16} />}
              <span style={{ fontWeight: 700 }}>{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
