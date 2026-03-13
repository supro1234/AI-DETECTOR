import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ShieldCheck, History, Sparkles, LogOut, ChevronDown, Activity, Terminal } from 'lucide-react'

const LINKS = [
  { to: '/',         label: 'ANALYSIS', icon: Terminal },
  { to: '/history',  label: 'ARCHIVES', icon: History },
  { to: '/upcoming', label: 'UPCOMING UPDATES', icon: Sparkles },
]

export default function Navbar({ provider, onReset }) {
  const [scrolled, setScrolled] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => {
      try {
        setScrolled(window.scrollY > 20)
      } catch (e) {
        console.warn('[NAV_DEBUG] Scroll listener error:', e);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      /* Only opacity/background change on scroll — no layout reflow */
      background: scrolled ? 'rgba(3, 3, 8, 0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      borderBottom: '1px solid ' + (scrolled ? 'rgba(255, 255, 255, 0.06)' : 'transparent'),
      /* Fixed padding — eliminates layout reflow on every scroll event */
      padding: '1rem 2.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transition: 'background 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease',
      /* GPU layer — no repaint from canvas below */
      willChange: 'background, opacity',
      transform: 'translateZ(0)',
    }}>
      
      {/* Brand Unit */}
      <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ 
          width: '32px', height: '32px', borderRadius: '8px', 
          background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)'
        }}>
          <ShieldCheck size={18} color="var(--accent-primary)" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ 
            fontFamily: 'Outfit', fontWeight: 900, fontSize: '1rem', color: 'white', 
            letterSpacing: '1px', textTransform: 'uppercase' 
          }}>
            AI DETECTOR
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--accent-cyan)', fontWeight: 800, letterSpacing: '2px' }}>FORENSIC_AI</span>
        </div>
      </NavLink>

      {/* Primary Links — Translucent Blur Tab Strip */}
      <div style={{
        display: 'flex', gap: '0.4rem',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        padding: '0.35rem',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)'
      }}>
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              padding: '0.45rem 1.1rem',
              borderRadius: '10px',
              fontSize: '0.68rem', fontWeight: 800,
              textDecoration: 'none', letterSpacing: '1px',
              transition: 'all 0.25s ease',
              /* Active: frosted glass highlight with accent glow */
              background: isActive
                ? 'rgba(99, 102, 241, 0.18)'
                : 'transparent',
              backdropFilter: isActive ? 'blur(12px)' : 'none',
              WebkitBackdropFilter: isActive ? 'blur(12px)' : 'none',
              color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
              border: isActive
                ? '1px solid rgba(99, 102, 241, 0.35)'
                : '1px solid transparent',
              boxShadow: isActive
                ? '0 0 16px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(255,255,255,0.08)'
                : 'none',
            })}
          >
            <Icon
              size={13}
              color={(location?.pathname === to || (to === '/' && location?.pathname === ''))
                ? 'var(--accent-primary)' : 'inherit'}
            />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Status Hub */}
      <div style={{ position: 'relative' }}>
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          className="glass-card"
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 1rem', 
            borderRadius: '10px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.05)', color: 'white'
          }}
        >
          <div className="neon-glow" style={{ 
            width: '6px', height: '6px', borderRadius: '50%', 
            background: provider === 'gemini' ? 'var(--accent-secondary)' : 'var(--accent-cyan)' 
          }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
            NODE: {provider || 'OFFLINE'}
          </span>
          <ChevronDown size={14} style={{ opacity: 0.5, transform: showDropdown ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              style={{ 
                position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: '220px',
                background: 'rgba(5, 5, 10, 0.98)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)', overflow: 'hidden'
              }}
            >
              <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <Activity size={12} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>LINK_STABILITY</span>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'white' }}>99.2% SECURE</div>
              </div>
              
              <button 
                onClick={() => {
                  sessionStorage.clear()
                  onReset()
                  navigate('/')
                }}
                style={{ 
                  width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem',
                  background: 'rgba(239, 68, 68, 0.05)', border: 'none', color: '#ef4444',
                  fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.3s'
                }}
              >
                <LogOut size={14} /> TERMINATE_LINK
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
