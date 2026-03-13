import cv2
import numpy as np
import os
from scipy.stats import entropy
import scipy.fftpack

def calculate_npr(image_path):
    """
    NPR (Neural Pixel Ratio / Radix)
    Idea: Measure abnormal frequency energy vs natural camera noise.
    NPR = sum(|F(u,v)| over high-freq band) / sum(|F(u,v)| over all)
    """
    try:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return 0.5
        
        # 2D FFT
        f_transform = np.fft.fft2(img)
        f_shift = np.fft.fftshift(f_transform)
        magnitude_spectrum = np.abs(f_shift)
        
        # Total energy
        total_energy = np.sum(magnitude_spectrum)
        
        # High-frequency band (outer ring)
        rows, cols = img.shape
        crow, ccol = rows // 2, cols // 2
        
        # Define high-freq band as anything outside the central 10%
        mask = np.ones((rows, cols), np.uint8)
        r_inner = int(min(rows, cols) * 0.1)
        cv2.circle(mask, (ccol, crow), r_inner, 0, -1)
        
        high_freq_energy = np.sum(magnitude_spectrum * mask)
        
        npr_value = high_freq_energy / (total_energy + 1e-6)
        
        # Normalize to 0-1 range (higher = more suspicious/unnatural)
        # Natural images usually have most energy in low frequencies
        # AI images often have high-frequency grid artifacts
        # We'll scale it so that anything above a threshold is "unnatural"
        # Typical natural image npr is very low (0.01 - 0.05)
        conf_score = min(1.0, npr_value * 10) 
        return float(conf_score)
    except Exception:
        return 0.5

def calculate_ufd(image_path):
    """
    UFD (Unnatural Face Detail)
    Idea: Compare skin texture statistics in face region vs background.
    UFD = |texture_entropy(face) - texture_entropy(nonface)|
    """
    try:
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            return 0.5
            
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        
        # Detect Face
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) == 0:
            return 0.5 # No face, neutral score
            
        # Get primary face
        (x, y, w, h) = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
        face_roi = gray[y:y+h, x:x+w]
        
        # Get background sample (top corner)
        bg_h, bg_w = min(h, y), min(w, x)
        if bg_h > 10 and bg_w > 10:
            bg_roi = gray[0:bg_h, 0:bg_w]
        else:
            # Fallback to a region far from face
            bg_roi = gray[0:50, 0:50]
            
        def get_entropy(roi):
            # Histogram entropy
            hist = cv2.calcHist([roi], [0], None, [256], [0, 256])
            hist = hist.ravel() / hist.sum()
            return entropy(hist)
            
        face_ent = get_entropy(face_roi)
        bg_ent = get_entropy(bg_roi)
        
        diff = abs(face_ent - bg_ent)
        
        # Normalize: large differences in entropy between face and bg suggest localized AI processing
        # (e.g., face swap or beauty filter only on face)
        ufd_score = min(1.0, diff / 2.0)
        return float(ufd_score)
    except Exception:
        return 0.5

def calculate_crossvit_proxy(image_path):
    """
    Cross-Efficient ViT Proxy
    ViT models are sensitive to patch-wise self-similarity and tiling.
    We proxy this by measuring local standard deviation consistency.
    """
    try:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return 0.5
            
        # Resize to standard size for patch analysis
        img = cv2.resize(img, (256, 256))
        
        # Split into 16x16 patches (like ViT)
        patch_size = 16
        patches = []
        for i in range(0, 256, patch_size):
            for j in range(0, 256, patch_size):
                patch = img[i:i+patch_size, j:j+patch_size]
                patches.append(patch.std())
        
        # Measure variance of the standard deviations
        # AI images often have too-consistent or too-jittery patch statistics
        stds = np.array(patches)
        std_of_stds = stds.std()
        
        # Natural images have moderate variation in local detail
        # Scaling: lower variation/extremely high variation = more suspicious
        if std_of_stds < 5: # Too flat (synthetic)
            score = 0.8
        elif std_of_stds > 40: # Too chaotic (high-freq artifacts)
            score = 0.9
        else:
            # Somewhere in the middle is natural-ish
            score = abs(std_of_stds - 20) / 20.0
            
        return float(min(1.0, score))
    except Exception:
        return 0.5
