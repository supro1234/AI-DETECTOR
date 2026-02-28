import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ThreeHero({ intensity = 1, density = 1 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ─── Core Scene Setup ──────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(65, mount.clientWidth / mount.clientHeight, 0.1, 2000)
    camera.position.z = 35

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0) // Fully transparent background
    mount.appendChild(renderer.domElement)

    const COLORS = {
      primary: 0x6366f1,   // Ultraviolet
      secondary: 0x22d3ee, // Cyan
      accent: 0xa855f7,    // Purple
      vivid: 0xec4899,     // Magenta (Interaction Pulse)
      bg: 0x020204
    }

    // ─── 1. Multi-Phase Neural Hub (Counter-Rotating Geometry) ──────────────
    const hubGroup = new THREE.Group()
    scene.add(hubGroup)

    // Inner Core (Pulsing Solid)
    const innerGeom = new THREE.OctahedronGeometry(2, 2)
    const innerMat = new THREE.MeshPhongMaterial({
      color: COLORS.secondary,
      emissive: COLORS.secondary,
      emissiveIntensity: 2 * intensity,
      transparent: true,
      opacity: 0.3
    })
    const innerCore = new THREE.Mesh(innerGeom, innerMat)
    hubGroup.add(innerCore)

    // Middle Lattice (Wireframe)
    const latticeGeom = new THREE.IcosahedronGeometry(6, 4)
    const latticeMat = new THREE.MeshPhongMaterial({
      color: COLORS.primary,
      emissive: COLORS.primary,
      emissiveIntensity: 0.8 * intensity,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    })
    const lattice = new THREE.Mesh(latticeGeom, latticeMat)
    hubGroup.add(lattice)

    // Outer Orbital (Thin line shell)
    const orbitGeom = new THREE.IcosahedronGeometry(12, 1)
    const orbitMat = new THREE.MeshBasicMaterial({
      color: COLORS.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.1
    })
    const orbit = new THREE.Mesh(orbitGeom, orbitMat)
    hubGroup.add(orbit)

    // ─── 2. Cyber Particle Network ──────────────────────────────────────────
    const baseCount = 4000 // Reduced from 10000 for performance
    const particleCount = Math.floor(baseCount * density)
    const positions = new Float32Array(particleCount * 3)
    const originalPositions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount)
    const particleColors = new Float32Array(particleCount * 3)
    const baseColors = new Float32Array(particleCount * 3)
    
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 150
      const y = (Math.random() - 0.5) * 150
      const z = -Math.random() * 1000

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      
      originalPositions[i * 3] = x
      originalPositions[i * 3 + 1] = y
      originalPositions[i * 3 + 2] = z

      velocities[i] = (0.1 + Math.random() * 0.2) * intensity // Ultra-premium slow drift

      const color = Math.random() > 0.7 ? new THREE.Color(COLORS.secondary) : new THREE.Color(COLORS.primary)
      particleColors[i * 3] = baseColors[i * 3] = color.r
      particleColors[i * 3 + 1] = baseColors[i * 3 + 1] = color.g
      particleColors[i * 3 + 2] = baseColors[i * 3 + 2] = color.b
    }

    const pGeom = new THREE.BufferGeometry()
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pGeom.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))
    
    const pMat = new THREE.PointsMaterial({
      size: 0.15, 
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    })
    const particles = new THREE.Points(pGeom, pMat)
    scene.add(particles)

    // ─── 3. Dynamic Connectivity (Neural Lines) ─────────────────────────────
    const lineMaxConnections = 1200
    const linePosArr = new Float32Array(lineMaxConnections * 2 * 3)
    const lineGeom = new THREE.BufferGeometry()
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePosArr, 3))
    const lineMat = new THREE.LineBasicMaterial({
      color: COLORS.primary,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    })
    const connectivityLines = new THREE.LineSegments(lineGeom, lineMat)
    scene.add(connectivityLines)

    // ─── 4. Atmosphere (Floor & Lighting) ───────────────────────────────────
    const floorGrid = new THREE.GridHelper(300, 60, COLORS.secondary, 0x050510)
    floorGrid.position.y = -40
    floorGrid.material.transparent = true
    floorGrid.material.opacity = 0.15
    scene.add(floorGrid)

    const glowLight = new THREE.PointLight(COLORS.secondary, 15 * intensity, 100)
    scene.add(glowLight)

    scene.add(new THREE.AmbientLight(0xffffff, 0.03))

    // ─── Interactivity Utils ────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 }
    const targetMouse = { x: 0, y: 0 }
    const onMouseMove = (e) => {
      targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2
      targetMouse.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    // ─── Animation Loop ─────────────────────────────────────────────────────
    let frameId
    const clock = new THREE.Clock()
    const vividColor = new THREE.Color(COLORS.vivid)

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const time = clock.getElapsedTime()

      // Smooth mouse damping
      mouse.x += (targetMouse.x - mouse.x) * 0.03
      mouse.y += (targetMouse.y - mouse.y) * 0.03

      // I. Hub Dynamics
      innerCore.rotation.y += 0.008
      innerCore.scale.setScalar(1 + Math.sin(time * 3) * 0.15)
      lattice.rotation.z -= 0.003
      orbit.rotation.z += 0.002

      // II. Particle Dynamics & AI Neural Interaction
      const posAttr = pGeom.attributes.position.array
      const colorAttr = pGeom.attributes.color.array
      let lineIdx = 0
      const stride = 60 // Optimized connection stride

      // Interactive focal point in 3D
      const interactionX = mouse.x * 60
      const interactionY = mouse.y * 60

      for (let i = 0; i < particleCount; i++) {
        const ix = i * 3
        const iy = i * 3 + 1
        const iz = i * 3 + 2

        posAttr[iz] += velocities[i]

        // Proximity Check
        const dx = posAttr[ix] - interactionX
        const dy = posAttr[iy] - interactionY
        const dist = Math.sqrt(dx*dx + dy*dy)
        
        // INTERACTION ZONE (AI NEURAL PULSE)
        if (dist < 20) {
          const influence = (1- dist/20)
          
          // 1. Color Warp to Magenta
          colorAttr[ix] = THREE.MathUtils.lerp(baseColors[ix], vividColor.r, influence)
          colorAttr[iy] = THREE.MathUtils.lerp(baseColors[iy], vividColor.g, influence)
          colorAttr[iz] = THREE.MathUtils.lerp(baseColors[iz], vividColor.b, influence)

          // 2. Repulsion
          const force = influence * 0.08
          posAttr[ix] += dx * force
          posAttr[iy] += dy * force
        } else {
          // Restore Base Color
          colorAttr[ix] += (baseColors[ix] - colorAttr[ix]) * 0.05
          colorAttr[iy] += (baseColors[iy] - colorAttr[iy]) * 0.05
          colorAttr[iz] += (baseColors[iz] - colorAttr[iz]) * 0.05

          // Soft return to flow stream
          posAttr[ix] += (originalPositions[ix] - posAttr[ix]) * 0.01
          posAttr[iy] += (originalPositions[iy] - posAttr[iy]) * 0.01
        }

        // Reset
        if (posAttr[iz] > 100) {
          posAttr[iz] = -900
          originalPositions[iz] = -900
        }

        // III. Dynamic Connectivity
        if (i % stride === 0 && lineIdx < lineMaxConnections) {
          const nextIx = ((i + 1) % particleCount) * 3
          const dConnect = Math.sqrt(
            Math.pow(posAttr[ix] - posAttr[nextIx], 2) + 
            Math.pow(posAttr[iy] - posAttr[nextIx+1], 2)
          )

          // Proximity enhances connection chance/visibility
          const proximalToMouse = dist < 25
          const threshold = proximalToMouse ? 35 : 25

          if (dConnect < threshold) {
            linePosArr[lineIdx * 6] = posAttr[ix]
            linePosArr[lineIdx * 6 + 1] = posAttr[iy]
            linePosArr[lineIdx * 6 + 2] = posAttr[iz]
            linePosArr[lineIdx * 6 + 3] = posAttr[nextIx]
            linePosArr[lineIdx * 6 + 4] = posAttr[nextIx + 1]
            linePosArr[lineIdx * 6 + 5] = posAttr[nextIx + 2]
            lineIdx++
          }
        }
      }

      pGeom.attributes.position.needsUpdate = true
      pGeom.attributes.color.needsUpdate = true
      lineGeom.attributes.position.needsUpdate = true
      connectivityLines.visible = lineIdx > 0
      
      // Update line color based on mouse proximity for "active neural analysis" pulse
      lineMat.color.lerp(proximalToFocal() ? vividColor : new THREE.Color(COLORS.primary), 0.1)

      function proximalToFocal() {
        return Math.sqrt(Math.pow(interactionX, 2) + Math.pow(interactionY, 2)) < 30
      }

      // IV. Global Environment
      glowLight.position.set(interactionX, interactionY, 15)
      glowLight.color.lerp(vividColor, 0.05)
      floorGrid.position.z = (time * 5) % 10

      camera.position.x += (mouse.x * 12 - camera.position.x) * 0.01
      camera.position.y += (mouse.y * 12 - camera.position.y) * 0.01
      camera.lookAt(hubGroup.position)

      renderer.render(scene, camera)
    }

    animate()

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
    <div ref={mountRef} style={{ 
      position:'fixed', inset:0, zIndex:-1, pointerEvents:'none',
      background: 'radial-gradient(circle at center, #04040c 0%, #010102 100%)' 
    }} />
  )
}
