# 🛡️ AI Image Detector: Forensic Investigation Suite

![Project Banner](https://img.shields.io/badge/AI-Forensics-blueviolet?style=for-the-badge&logo=shield)
![Status](https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge)
![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20Python-blue?style=for-the-badge&logo=react)

**AI Image Detector** is a high-performance, professional-grade forensic tool designed to distinguish between real photographs, AI-enhanced images, and fully synthetic deepfakes. Utilizing a **Dual-API Fusion Engine**, it performs a clinical 15-point forensic analysis to verify image integrity.

---

## 🚀 Key Features

- **🔍 Dual-Fusion Analysis**: Connects to multiple high-end models simultaneously for cross-verified results.
- **⚡ Intuitive Veracity Dashboard**: A sleek, dark-mode 3D UI that maps results to "Realness" (Veracity) scores.
- **🛠️ 15-Point Forensic Checklist**: Inspects anatomical logic, skin texture, lighting physics, and GAN signatures.
- **🎨 Glassmorphism Design**: High-end aesthetic with smooth transitions and interactive 3D particle backgrounds.
- **🧪 Multi-Provider Support**: Compatible with Google Gemini, Groq, and OpenRouter API keys.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Framer Motion (Animations), Three.js (3D Backdrop), Lucide-React (Icons).
- **Backend**: Node.js (Express), Multer (File Handling), Axios.
- **Forensic Engine**: Python 3, Google Generative AI, Groq SDK, Concurrent Threading.

---

## 📦 Installation & Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16.x or higher)
- [Python 3.9+](https://www.python.org/)
- API Keys from [Google AI Studio](https://aistudio.google.com/) or [Groq Console](https://console.groq.com/).

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

The engine evaluates images based on the following clinical parameters:

1.  **Anatomical Logic**: Finger counts, joint angles, and eye symmetry.
2.  **Skin Texture**: Pore-level detail vs. over-smoothed "AI plastic" sheen.
3.  **Lighting Physics**: Shadow alignment with environmental light sources.
4.  **Edge Consistency**: Zoom-in analysis of hair strands and silhouette blending.

### Verdict Interpretation:
- **Verified Real (80-100%)**: Raw sensor noise and natural lens physics present.
- **AI Camera / Enhanced (40-69%)**: Real photo with aggressive mobile AI processing.
- **Highly Suspicious (20-39%)**: Likely synthetic or heavily manipulated.
- **AI Generated Proof (0-19%)**: Irrefutable synthetic artifacts detected.

---

## 📍 Roadmap & Wiki
For detailed project development goals, see [ROADMAP.md](ROADMAP.md).
For technical deep-dives and documentation, see [WIKI.md](WIKI.md).

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
