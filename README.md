# 🛡️ AI Image Detector: Forensic Investigation Suite

![Project Banner](https://img.shields.io/badge/AI-Forensics-blueviolet?style=for-the-badge&logo=shield)
![Status](https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge)
![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20Python-blue?style=for-the-badge&logo=react)

**AI Image Detector** is a high-performance, professional-grade forensic tool designed to distinguish between real photographs, AI-enhanced images, and fully synthetic deepfakes. It uses a **Cross‑API Fusion Engine** across **Gemini 2.0 Flash**, **Groq Llama‑4 Scout**, **OpenRouter**, and **Hive AI V3 Vesta** to deliver a 16‑point forensic scoring system with deepfake, face‑swap, and nudity detection.

---

## 🚀 Key Features

- **🔍 Cross‑API Fusion Analysis**: Gemini + Groq + OpenRouter + Hive AI V3 Vesta fused for veracity scoring.
- **🧠 16‑Point Forensic Scoring System**: Full neural checklist scoring for synthetic artifacts.
- **⚠️ Deepfake + Face‑Swap Detection**: Boundary seams, texture inconsistencies, and facial identity artifacts.
- **🔥 Nudity/NSFW Detection**: Hive‑based NSFW scanning for safety‑critical audits.
- **📊 NPR / UFD / CrossViT Markers**: Neural forensic markers shown in the UI dashboard.
- **⚡ Intuitive Veracity Dashboard**: Dark‑mode 3D UI that maps results to “Realness” (Veracity) scores.
- **🎨 Glassmorphism Design**: Smooth transitions with interactive 3D particle backgrounds.
- **🧪 Multi‑Provider Support**: API key support for Gemini, Groq, OpenRouter, and Hive AI.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Framer Motion (Animations), Three.js (3D Backdrop), Lucide‑React (Icons).
- **Backend**: Node.js (Express), Multer (File Handling), Axios.
- **Forensic Engine**: Python 3, Google Generative AI (Gemini), Groq SDK, OpenRouter API, Hive AI V3 Vesta.

---

## 📦 Installation & Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16.x or higher)
- [Python 3.9+](https://www.python.org/)
- API Keys from **Google AI Studio**, **Groq Console**, **OpenRouter**, and **Hive AI**.

### 2. Clone the Repository
```bash
git clone https://github.com/yourusername/AI-Image-Detector.git
cd AI-Image-Detector
```

### 3. Install Dependencies
```bash
# Install root dependencies
npm install

# Install Frontend dependencies
cd frontend
npm install

# Install Backend dependencies
cd ../backend
npm install
pip install -r requirements.txt
```

### 4. Direct Launch
From the project root:
```bash
npm run dev
```
The app will launch on `http://localhost:5173`.

---

## 🔬 Forensic Methodology

The engine evaluates images using a 16‑point clinical analysis matrix:

1.  **Anatomical Logic**: Finger counts, joint angles, and eye symmetry.
2.  **Skin Texture**: Pore‑level detail vs. over‑smoothed AI sheen.
3.  **Lighting Physics**: Shadow alignment with environmental light sources.
4.  **Edge Consistency**: Hair strands and silhouette blending.
5.  **Face‑Swap Forensics**: Boundary seams, jawline blending, and identity mismatch.
6.  **Nudity / NSFW Signals**: Hive V3 Vesta content safety scanning.
7.  **Neural Forensic Markers**: NPR, UFD, and CrossViT anomaly scoring.
8.  **GAN Signatures (Planned)**: Frequency domain patterns and checkerboard artifacts.

### Verdict Interpretation:
- **Verified Real (80‑100%)**: Raw sensor noise and natural lens physics present.
- **AI Camera / Enhanced (40‑69%)**: Real photo with aggressive AI post‑processing.
- **Highly Suspicious (20‑39%)**: Likely synthetic or heavily manipulated.
- **AI Generated Proof (0‑19%)**: Irrefutable synthetic artifacts detected.

---

Developed with ❤️ by the SSA Team