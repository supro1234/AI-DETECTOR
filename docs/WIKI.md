# 📚 AI Image Detector Wiki (GitHub Ready)

*Copy the sections below into your GitHub Project Wiki for a professional documentation suite.*

---

## 🏠 Home
Welcome to the official Wiki for the **AI Image Detector**. This tool is designed to be the "Reality Check" for the digital age, providing investigative tools to verify visual media.

### Quick Links
- [[Forensic Methodology]]
- [[API Orchestration]]
- [[Installation Guide]]
- [[Troubleshooting]]

---

## [[Forensic Methodology]]
Our engine doesn't just "guess"; it follows a rigorous 15-point inspection process.

### 1. RGB Noise Profiling
Real sensors produce a specific "grain" or noise pattern that is consistent across the image. AI-generated images often have "flat" zones or inconsistent noise distributions.

### 2. Anatomical Invariants
While models have improved, they often struggle with:
- **Digit Continuity**: Finger counts and joint placement.
- **Iris Symmetry**: Pupillary reflections must match the light source.
- **Ear Morphology**: Complex cartilaginous structures are often over-simplified.

### 3. Lighting Physics (Ray Tracing)
We analyze if the light hitting the subject's nose matches the reflections on the background furniture. AI often "paints" lighting that is visually pleasing but physically impossible.

---

## [[API Orchestration]]
The backend uses a **Broker Pattern** to manage multiple AI providers.

### How it Works:
1. **Request Hub**: Receives the image and distributes it to the available neural link (Gemini/Groq).
2. **Prompt Fusion**: We use a specialized system prompt that forces the AI to act as a forensic expert, returning a structured JSON payload.
3. **Verdict Synthesis**: The backend maps the raw "AI probability" into our colored "Veracity" scale before serving it to the React frontend.

---

## [[Installation Guide]]
This section covers detailed environment setup for various Operating Systems.

### Windows (PowerShell)
```powershell
# Set Python Path
$env:PYTHON_PATH="C:\Python39\python.exe"
npm run dev
```

### Linux/macOS
```bash
export PYTHON_PATH="/usr/bin/python3"
npm run dev
```

---

## [[Troubleshooting]]
### Common Issues
- **Blank Screen after Connection**: Usually caused by a missing API key in `sessionStorage`. Check the `Navbar.jsx` logs.
- **Laggy Interface**: Ensure your browser supports WebGL for the `ThreeHero.jsx` 3D background.
- **API Error**: Verify that your Google/Groq key has "Vision" permissions enabled.
