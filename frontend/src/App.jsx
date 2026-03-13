import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import DetectPage from './pages/DetectPage'
import HistoryPage from './pages/HistoryPage'
import UpcomingPage from './pages/UpcomingPage'
import SetupPage from './pages/SetupPage'
import ThreeHero from './components/ThreeHero'
import { AnimatePresence } from 'framer-motion'

function AnimatedRoutes({ session, setSession }) {
  const location = useLocation()
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"         element={<DetectPage config={session} onReset={() => setSession(null)} />} />
        <Route path="/history"  element={<HistoryPage />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    console.log('[SESSION_DEBUG] Initializing App session check');
    const gemini = sessionStorage.getItem('gemini_key')
    const groq   = sessionStorage.getItem('groq_key')
    const openrouter = sessionStorage.getItem('openrouter_key')
    const hiveSecret = sessionStorage.getItem('hive_secret_key')
    const hiveAccess = sessionStorage.getItem('hive_access_key')
    const hiveKey = sessionStorage.getItem('hive_key')
    
    if (gemini) {
      console.log('[SESSION_DEBUG] Found Gemini key in storage');
      setSession({ provider: 'gemini', apiKey: gemini, hiveAccessKey: hiveAccess, hiveSecretKey: hiveSecret })
    } else if (groq) {
      console.log('[SESSION_DEBUG] Found Groq key in storage');
      setSession({ provider: 'groq', apiKey: groq, hiveAccessKey: hiveAccess, hiveSecretKey: hiveSecret })
    } else if (openrouter) {
      console.log('[SESSION_DEBUG] Found OpenRouter key in storage');
      setSession({ provider: 'openrouter', apiKey: openrouter, hiveAccessKey: hiveAccess, hiveSecretKey: hiveSecret })
    } else if (hiveKey || hiveSecret) {
      console.log('[SESSION_DEBUG] Found Hive key in storage');
      setSession({ provider: 'hive', apiKey: hiveKey || hiveSecret, hiveAccessKey: hiveAccess, hiveSecretKey: hiveSecret || hiveKey })
    } else {
      console.log('[SESSION_DEBUG] No existing session found');
    }
    
    setChecking(false)
  }, [])

  const handleConnect = (conf) => {
    console.log('[SESSION_DEBUG] Connecting with provider:', conf.provider);
    setSession(conf);
  }

  if (checking) return null

  return (
    <div className="app-container" key={session ? 'authenticated' : 'setup'}>
      <ThreeHero intensity={session ? 1.5 : 0.8} density={session ? 1.2 : 1} />
      
      {!session ? (
        <SetupPage onConnect={handleConnect} />
      ) : (
        <>
          <Navbar provider={session.provider} onReset={() => setSession(null)} />
          <main style={{ position: 'relative', zIndex: 10, width: '100%', flex: 1, display:'flex', flexDirection:'column' }}>
            <AnimatedRoutes session={session} setSession={setSession} />
          </main>
        </>
      )}
    </div>
  )
}
