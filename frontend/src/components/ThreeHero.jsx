import { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'

export default function ThreeHero({ intensity = 1, density = 1 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ─── Renderer — optimised for performance ───────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'lowp',   // lowest precision for background — saves fillrate
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.3)) // hard cap at 1.3x
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // ─── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x020208, 0.012) // depth fog for 3D feel

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 800)
    camera.position.set(0, 0, 40)

    // ─── Palette ───────────────────────────────────────────────────────────
    const C = {
      indigo:   0x6366f1,
      cyan:     0x06b6d4,
      purple:   0xa855f7,
      magenta:  0xec4899,
      amber:    0xf59e0b,
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1.  CENTRAL HUB — layered sacred geometry with MeshStandardMaterial
    //     (emissive glow is GPU-rendered, no per-pixel cost on background)
    // ─────────────────────────────────────────────────────────────────────────
    const hubGroup = new THREE.Group()
    scene.add(hubGroup)

    // Core: glowing solid dodecahedron
    const coreGeo = new THREE.DodecahedronGeometry(3, 0)
    const coreMat = new THREE.MeshStandardMaterial({
      color: C.cyan, emissive: C.cyan, emissiveIntensity: 3 * intensity,
      transparent: true, opacity: 0.25, roughness: 0.2, metalness: 0.8,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    hubGroup.add(core)

    // Ring 1 — icosahedron wireframe (medium)
    const ring1Geo = new THREE.IcosahedronGeometry(7, 1)
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: C.indigo, wireframe: true, transparent: true, opacity: 0.18,
    })
    hubGroup.add(new THREE.Mesh(ring1Geo, ring1Mat))

    // Ring 2 — octahedron wireframe (large, slow)
    const ring2Geo = new THREE.OctahedronGeometry(13, 2)
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: C.purple, wireframe: true, transparent: true, opacity: 0.08,
    })
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat)
    hubGroup.add(ring2)

    // Toroidal ring (new!) — adds a sci-fi feel
    const torusGeo = new THREE.TorusGeometry(9, 0.18, 8, 80)
    const torusMat = new THREE.MeshStandardMaterial({
      color: C.cyan, emissive: C.cyan, emissiveIntensity: 1.5 * intensity,
      transparent: true, opacity: 0.35, roughness: 0.1, metalness: 1,
    })
    const torus = new THREE.Mesh(torusGeo, torusMat)
    torus.rotation.x = Math.PI / 2
    hubGroup.add(torus)

    // Second torus tilted 45°
    const torus2Geo = new THREE.TorusGeometry(9, 0.12, 8, 80)
    const torus2Mat = new THREE.MeshStandardMaterial({
      color: C.purple, emissive: C.purple, emissiveIntensity: 1.2 * intensity,
      transparent: true, opacity: 0.25, roughness: 0.1, metalness: 1,
    })
    const torus2 = new THREE.Mesh(torus2Geo, torus2Mat)
    torus2.rotation.set(Math.PI / 4, Math.PI / 4, 0)
    hubGroup.add(torus2)

    // ─────────────────────────────────────────────────────────────────────────
    // 2.  PARTICLES — GPU efficient, NO per-frame Math.sqrt, use squaredDist
    //     Reduced count: 2000 well-tuned particles look better than 4000 noisy ones
    // ─────────────────────────────────────────────────────────────────────────
    const PC = Math.floor(1200 * density) // 1200: visible but fast
    const pos  = new Float32Array(PC * 3)
    const col  = new Float32Array(PC * 3)
    const vel  = new Float32Array(PC)       // z-drift speed
    const orig = new Float32Array(PC * 3)   // home positions for x/y restore

    const cCyan   = new THREE.Color(C.cyan)
    const cIndigo = new THREE.Color(C.indigo)
    const cPurple = new THREE.Color(C.purple)

    for (let i = 0; i < PC; i++) {
      const x = (Math.random() - 0.5) * 160
      const y = (Math.random() - 0.5) * 100
      const z = -Math.random() * 600

      pos[i*3] = orig[i*3] = x
      pos[i*3+1] = orig[i*3+1] = y
      pos[i*3+2] = z

      vel[i] = (0.08 + Math.random() * 0.18) * intensity

      // 3-way colour split for depth variation
      const r = Math.random()
      const c = r < 0.5 ? cIndigo : r < 0.8 ? cCyan : cPurple
      col[i*3]   = c.r
      col[i*3+1] = c.g
      col[i*3+2] = c.b
    }

    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pGeo.setAttribute('color',    new THREE.BufferAttribute(col, 3))

    // Custom circle texture for round particles (no expensive point sprites needed)
    const pMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    scene.add(new THREE.Points(pGeo, pMat))

    // ─────────────────────────────────────────────────────────────────────────
    // 3.  STATIC NEURAL GRID — replaces dynamic connectivity lines
    //     Pre-baked geometry: zero JS cost per frame, GPU draws it once
    // ─────────────────────────────────────────────────────────────────────────
    const gridFar = new THREE.GridHelper(400, 40, C.indigo, 0x080820)
    gridFar.position.y = -50
    gridFar.position.z = -80
    gridFar.material.transparent = true
    gridFar.material.opacity = 0.12
    scene.add(gridFar)

    const gridNear = new THREE.GridHelper(120, 20, C.cyan, 0x04041a)
    gridNear.position.y = -50
    gridNear.material.transparent = true
    gridNear.material.opacity = 0.2
    scene.add(gridNear)

    // ─────────────────────────────────────────────────────────────────────────
    // 4.  FLOATING ORBITAL NODES — 6 small glowing spheres on parametric paths
    //     These are the "premium 3D effect" that looks great at zero JS cost
    // ─────────────────────────────────────────────────────────────────────────
    const nodes = []
    const nodeColors = [C.cyan, C.indigo, C.purple, C.magenta, C.cyan, C.amber]
    const nodeRadii  = [15, 18, 13, 20, 16, 14]
    const nodeSpeeds = [0.28, -0.18, 0.35, -0.22, 0.15, -0.3]
    const nodeTilts  = [0, Math.PI/4, Math.PI/3, Math.PI/6, Math.PI/2, Math.PI/5]
    const nodeSizes  = [0.5, 0.35, 0.6, 0.4, 0.45, 0.3]

    for (let i = 0; i < 6; i++) {
      const geo = new THREE.SphereGeometry(nodeSizes[i], 8, 8)
      const mat = new THREE.MeshStandardMaterial({
        color: nodeColors[i], emissive: nodeColors[i],
        emissiveIntensity: 4 * intensity,
        roughness: 0.1, metalness: 0.9,
      })
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)
      nodes.push({ mesh, r: nodeRadii[i], speed: nodeSpeeds[i], tilt: nodeTilts[i], phase: (Math.PI * 2 / 6) * i })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5.  LIGHTING
    // ─────────────────────────────────────────────────────────────────────────
    const ambLight = new THREE.AmbientLight(0x111133, 1.5)
    scene.add(ambLight)

    const pointA = new THREE.PointLight(C.cyan, 30 * intensity, 120)
    pointA.position.set(0, 0, 20)
    scene.add(pointA)

    const pointB = new THREE.PointLight(C.purple, 15 * intensity, 80)
    pointB.position.set(-20, 20, 5)
    scene.add(pointB)

    // ─────────────────────────────────────────────────────────────────────────
    // 6.  MOUSE — throttled, no sqrt, using squared dist
    // ─────────────────────────────────────────────────────────────────────────
    const mouse    = { x: 0, y: 0 }
    const target   = { x: 0, y: 0 }
    let   lastMove = 0

    const onMouseMove = (e) => {
      const now = performance.now()
      if (now - lastMove < 16) return  // throttle to ~60fps max
      lastMove = now
      target.x = (e.clientX / window.innerWidth  - 0.5) * 2
      target.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    // ─────────────────────────────────────────────────────────────────────────
    // 7.  ANIMATION LOOP — minimal JS work, GPU-heavy visuals
    // ─────────────────────────────────────────────────────────────────────────
    let frameId
    const clock = new THREE.Clock()
    const vividC = new THREE.Color(C.magenta)
    // 30fps cap: only render when ≥33ms have elapsed
    const TARGET_MS = 33
    let lastFrameTime = 0

    const animate = (now = 0) => {
      frameId = requestAnimationFrame(animate)

      // Skip if tab is hidden
      if (document.hidden) return

      // 30fps gate — skip frame if called too soon
      if (now - lastFrameTime < TARGET_MS) return
      lastFrameTime = now

      const t = clock.getElapsedTime()

      // Smooth mouse damping (cheap lerp)
      mouse.x += (target.x - mouse.x) * 0.04
      mouse.y += (target.y - mouse.y) * 0.04

      hubGroup.children[1].rotation.y -= 0.004
      hubGroup.children[1].rotation.x += 0.002
      ring2.rotation.z += 0.0015
      ring2.rotation.x -= 0.001

      torus.rotation.z  += 0.003
      torus2.rotation.y += 0.004

      hubGroup.rotation.y  = mouse.x * 0.3
      hubGroup.rotation.x  = mouse.y * 0.2

      // ── Orbital Nodes ────────────────────────────────────────────────────
      for (const n of nodes) {
        const angle = t * n.speed + n.phase
        n.mesh.position.set(
          Math.cos(angle) * n.r,
          Math.sin(angle * 1.3 + n.tilt) * n.r * 0.4,
          Math.sin(angle) * n.r * 0.6
        )
        // Gentle pulse
        const s = 1 + Math.sin(t * 3 + n.phase) * 0.3
        n.mesh.scale.setScalar(s)
      }

      // ── Particles — NO Math.sqrt ─────────────────────────────────────────
      const posArr = pGeo.attributes.position.array
      const interX = mouse.x * 50
      const interY = mouse.y * 40
      const THRESH2 = 400 // 20^2 — squared distance threshold

      for (let i = 0; i < PC; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2

        // Z drift (main motion)
        posArr[iz] += vel[i]
        if (posArr[iz] > 80) { posArr[iz] = -500; orig[iz] = -500 }

        // Mouse repulsion (squared dist — no sqrt!)
        const dx = posArr[ix] - interX
        const dy = posArr[iy] - interY
        const d2 = dx * dx + dy * dy

        if (d2 < THRESH2) {
          const inv = 1 - d2 / THRESH2
          posArr[ix] += dx * inv * 0.06
          posArr[iy] += dy * inv * 0.06
        } else {
          // Gentle home restore
          posArr[ix] += (orig[ix] - posArr[ix]) * 0.008
          posArr[iy] += (orig[iy] - posArr[iy]) * 0.008
        }
      }
      pGeo.attributes.position.needsUpdate = true

      // ── Grid scrolls forward ──────────────────────────────────────────────
      gridFar.position.z  = ((t * 3) % 10) - 80
      gridNear.position.z = ((t * 4) % 6)  - 2

      // ── Camera parallax ──────────────────────────────────────────────────
      camera.position.x += (mouse.x * 8 - camera.position.x) * 0.015
      camera.position.y += (mouse.y * 6 - camera.position.y) * 0.015
      camera.lookAt(0, 0, 0)

      // ── Lights follow mouse ───────────────────────────────────────────────
      pointA.position.x = mouse.x * 30
      pointA.position.y = mouse.y * 20

      renderer.render(scene, camera)
    }

    animate()

    // ─────────────────────────────────────────────────────────────────────────
    // Resize
    // ─────────────────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [intensity, density])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
        // Multi-stop deep space radial gradient — replaces flat black
        background: `
          radial-gradient(ellipse 120% 80% at 50% 0%,   #0d0620 0%, transparent 60%),
          radial-gradient(ellipse 80%  60% at 80% 100%, #020d1a 0%, transparent 50%),
          radial-gradient(ellipse 60%  50% at 20% 80%,  #100818 0%, transparent 50%),
          linear-gradient(180deg, #04030e 0%, #020208 100%)
        `,
      }}
    />
  )
}
