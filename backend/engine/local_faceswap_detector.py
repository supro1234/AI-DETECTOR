"""
engine/local_faceswap_detector.py
──────────────────────────────────
Local forensic detector for InsightFace / inswapper_128 face swaps.

Primary Method: Error Level Analysis (ELA)
  ELA is the gold-standard image forensics technique. It works by:
  1. Resaving the image at a known JPEG quality level
  2. Computing pixel-wise difference between original and resaved
  3. Neural-network-processed regions (inswapper face) have DIFFERENT
     compression error levels than camera-captured regions

  Face swaps created with inswapper_128 will show:
  - Higher ELA in face region if GFPGAN sharpened it (more detail = more error)
  - OR different ELA pattern in face vs body (different processing history)

Secondary Methods:
  - Noise residual: GFPGAN removes sensor noise → face smoother than body
  - Color temperature: source/target had different white balance
  - Sharpness ratio: face vs clothing Laplacian

Requires: opencv-python, numpy, Pillow
"""

import cv2
import numpy as np
import os
import io
import tempfile


# ─────────────────────────────────────────────────────────────────────────── #
# Haar Cascade face locator                                                     #
# ─────────────────────────────────────────────────────────────────────────── #
def _get_cascade():
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    return cv2.CascadeClassifier(cascade_path)


def _detect_face_roi(img_bgr):
    cascade = _get_cascade()
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50)
    )
    if len(faces) == 0:
        return None
    return max(faces, key=lambda f: f[2] * f[3])


def _safe_crop(arr, y1, y2, x1, x2):
    H, W = arr.shape[:2]
    y1, y2 = max(0, y1), min(H, y2)
    x1, x2 = max(0, x1), min(W, x2)
    if y2 <= y1 or x2 <= x1:
        return None
    return arr[y1:y2, x1:x2]


# ─────────────────────────────────────────────────────────────────────────── #
# CHECK 1: Error Level Analysis (ELA) — PRIMARY METHOD                        #
# ─────────────────────────────────────────────────────────────────────────── #
def _check_ela(img_bgr: np.ndarray, face_roi) -> dict:
    """
    ELA: Resave image at 75% JPEG quality, compute difference.
    Works on both JPEG and PNG by normalizing through JPEG first.
    For PNG: save as JPEG 90% first (baseline), then resave at 75% (test),
             compare the two JPEG versions — reveals neural-network processing.
    """
    x, y, w, h = face_roi

    try:
        from PIL import Image as PILImage
        import io

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = PILImage.fromarray(img_rgb)

        # Baseline: save at 90% JPEG (normalize PNG → JPEG history)
        buf90 = io.BytesIO()
        pil_img.save(buf90, format='JPEG', quality=90)
        buf90.seek(0)
        img_90 = np.array(PILImage.open(buf90).convert('RGB'))

        # Test: resave the 90% version at 75%
        buf75 = io.BytesIO()
        PILImage.fromarray(img_90).save(buf75, format='JPEG', quality=75)
        buf75.seek(0)
        img_75 = np.array(PILImage.open(buf75).convert('RGB'))

        # ELA = difference between 90% and 75% saves
        ela_map = np.abs(img_90.astype(np.float32) - img_75.astype(np.float32)).mean(axis=2)

        pad_x, pad_y = w // 6, h // 6
        face_ela = _safe_crop(ela_map, y + pad_y, y + h - pad_y, x + pad_x, x + w - pad_x)
        body_ela = _safe_crop(ela_map, y + h, y + h + int(h * 0.7), x + w // 6, x + w - w // 6)
        bg_ela   = _safe_crop(ela_map, max(0, y - int(h * 0.5)), y, x + w // 6, x + w - w // 6)

        if face_ela is None or body_ela is None or face_ela.size == 0 or body_ela.size == 0:
            return {"score": 0, "detail": "Could not extract ELA regions"}

        face_mean = float(face_ela.mean())
        face_std  = float(face_ela.std())
        body_mean = float(body_ela.mean())
        body_std  = float(body_ela.std())
        bg_mean   = float(bg_ela.mean()) if (bg_ela is not None and bg_ela.size > 0) else body_mean

        ela_mean_diff = abs(face_mean - body_mean)
        ela_std_diff  = abs(face_std  - body_std)
        bg_norm_diff  = ela_mean_diff / (bg_mean + 1.0)

        # Lowered divisors: diff of 5 now scores ~28, diff of 10 ~56
        score = min(90, int(
            (ela_mean_diff / 5.0) * 45 +
            (ela_std_diff  / 4.0) * 30 +
            min(15, bg_norm_diff * 12)
        ))

        detail = (
            f"ELA(90vs75%) face_mean={face_mean:.2f} body_mean={body_mean:.2f} "
            f"diff={ela_mean_diff:.2f} | face_std={face_std:.2f} body_std={body_std:.2f} "
            f"std_diff={ela_std_diff:.2f} bg_norm={bg_norm_diff:.2f}"
        )

        return {"score": score, "detail": detail,
                "ela_mean_diff": ela_mean_diff, "ela_std_diff": ela_std_diff}

    except Exception as e:
        return {"score": 0, "detail": f"ELA failed: {e}"}


# ─────────────────────────────────────────────────────────────────────────── #
# CHECK 2: Noise Residual — GFPGAN denoises face                              #
# ─────────────────────────────────────────────────────────────────────────── #
def _check_noise_residual(img_bgr: np.ndarray, face_roi) -> dict:
    """
    High-frequency residual: orig - Gaussian_blur.
    GFPGAN denoises the swapped face → face has much less HF noise than body.
    """
    x, y, w, h = face_roi
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blurred = cv2.GaussianBlur(gray, (15, 15), 0)
    residual = np.abs(gray - blurred)

    pad_x, pad_y = w // 6, h // 6
    face_r = _safe_crop(residual, y + pad_y, y + h - pad_y, x + pad_x, x + w - pad_x)
    neck_r = _safe_crop(residual, y + h, y + h + int(h * 0.5), x + w // 5, x + w - w // 5)

    if face_r is None or neck_r is None or face_r.size == 0 or neck_r.size == 0:
        return {"score": 0, "detail": "Could not extract noise regions"}

    face_n = float(face_r.mean())
    neck_n = float(neck_r.mean())

    if neck_n < 0.5:
        return {"score": 0, "detail": "Neck region trivially smooth — cannot compare"}

    ratio = face_n / (neck_n + 1e-6)

    # KEY SAFEGUARD: if neck is ALSO very smooth (neck_n < 5.0), the whole
    # image was AI-processed (camera enhancement / beauty filter applied to
    # entire photo). This is NOT a face swap — reduce score significantly.
    whole_image_smooth = neck_n < 5.0

    # Lowered threshold: ratio < 0.75 now scores meaningfully
    if ratio < 0.75:
        base_score = min(90, int((1.0 - ratio) / 0.75 * 95))
        if whole_image_smooth:
            # Whole image smooth: definitely AI camera enhanced / beauty filter
            # Face swaps do not smooth the entire neck/body.
            score = 0  # Zero it out. It's too ambiguous and causes false Face Swaps.
            detail = (
                f"Face smoother than neck — but neck ALSO heavily smoothed (neck={neck_n:.2f}), "
                f"suggesting Beauty Filter / Portrait Mode (not face swap). face={face_n:.2f} ratio={ratio:.2f}"
            )
        else:
            score = base_score
            detail = (
                f"Selective denoising (e.g. GFPGAN): face_noise={face_n:.2f} neck={neck_n:.2f} "
                f"ratio={ratio:.2f} — face is {(1-ratio)*100:.0f}% smoother than neck"
            )
    elif ratio < 0.88:
        score = 18
        detail = f"Mild smoothing: face={face_n:.2f} neck={neck_n:.2f} ratio={ratio:.2f}"
    else:
        score = 0
        detail = f"Noise consistent ratio={ratio:.2f} — real or uniformly-enhanced photo"

    return {"score": score, "detail": detail, "noise_ratio": ratio,
            "whole_image_smooth": whole_image_smooth}


# ─────────────────────────────────────────────────────────────────────────── #
# CHECK 3: Color Temperature (LAB) — face vs. neck                            #
# ─────────────────────────────────────────────────────────────────────────── #
def _check_color_mismatch(img_bgr: np.ndarray, face_roi) -> dict:
    x, y, w, h = face_roi

    pad_x, pad_y = w // 5, h // 5
    face_p = _safe_crop(img_bgr, y + pad_y, y + h - pad_y, x + pad_x, x + w - pad_x)
    neck_p = _safe_crop(img_bgr, y + h, y + h + int(h * 0.45), x + w // 5, x + w - w // 5)

    if face_p is None or neck_p is None or face_p.size == 0 or neck_p.size == 0:
        return {"score": 0, "detail": "Could not extract color regions"}

    lab_f = cv2.cvtColor(face_p, cv2.COLOR_BGR2LAB).astype(np.float32).mean(axis=(0, 1))
    lab_n = cv2.cvtColor(neck_p, cv2.COLOR_BGR2LAB).astype(np.float32).mean(axis=(0, 1))

    # Skip uniform warm cast
    if lab_n[2] > 140 and lab_f[2] > 140:
        return {"score": 0, "detail": "Uniform warm/yellow — natural incandescent lighting"}

    dA = abs(float(lab_f[1]) - float(lab_n[1]))
    dB = abs(float(lab_f[2]) - float(lab_n[2]))
    dL = abs(float(lab_f[0]) - float(lab_n[0]))

    score = min(80, int(dA / 9.0 * 35 + dB / 11.0 * 35 + dL / 16.0 * 10))
    detail = (
        f"Face LAB L={lab_f[0]:.0f} A={lab_f[1]:.0f} B={lab_f[2]:.0f} | "
        f"Neck LAB L={lab_n[0]:.0f} A={lab_n[1]:.0f} B={lab_n[2]:.0f} | "
        f"Δ A={dA:.1f} B={dB:.1f} L={dL:.1f}"
    )

    return {"score": score, "detail": detail, "delta_a": dA, "delta_b": dB}


# ─────────────────────────────────────────────────────────────────────────── #
# CHECK 4: GFPGAN Sharpness Boost — face vs. clothing                        #
# ─────────────────────────────────────────────────────────────────────────── #
def _check_sharpness_mismatch(img_bgr: np.ndarray, face_roi) -> dict:
    x, y, w, h = face_roi
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    pad_x, pad_y = w // 7, h // 7
    face_g  = _safe_crop(gray, y + pad_y, y + h - pad_y, x + pad_x, x + w - pad_x)
    cloth_g = _safe_crop(gray, y + h, y + h + int(h * 0.35), x + w // 6, x + w - w // 6)

    if face_g is None or cloth_g is None or face_g.size == 0 or cloth_g.size == 0:
        return {"score": 0, "detail": "Could not extract sharpness regions"}

    fv = cv2.Laplacian(face_g,  cv2.CV_64F).var()
    cv = cv2.Laplacian(cloth_g, cv2.CV_64F).var()
    ratio = fv / (cv + 1e-6)

    if ratio > 2.2:
        # Face SHARPER than clothing: could be Portrait Mode (AI camera enhanced).
        # Portrait Mode sharpens face while blurring background/clothing.
        # This direction is completely ambiguous, so score must be 0 to prevent
        # AI Camera images from being falsely flagged as Face Swaps.
        score = 0
        detail = f"Face {ratio:.1f}x SHARPER than clothing — normal for Portrait Mode / AI Camera"
    elif ratio < 0.38:
        # Face BLURRIER than clothing: strong face swap signal.
        # AI camera enhancement makes the WHOLE image sharp/processed —
        # it almost never makes the face blurrier than the clothing.
        score = min(75, int((1.0 - ratio) / 0.62 * 65 + 20))
        detail = f"Face {ratio:.2f}x BLURRIER than clothing — inswapper paste signature (face={fv:.0f} cloth={cv:.0f})"
    else:
        score = 0
        detail = f"Sharpness ratio {ratio:.2f} — normal range"

    return {"score": score, "detail": detail, "ratio": ratio}


# ─────────────────────────────────────────────────────────────────────────── #
# CHECK 5: Boundary Seam (background-normalized)                              #
# ─────────────────────────────────────────────────────────────────────────── #
def _check_boundary_seam(img_bgr: np.ndarray, face_roi) -> dict:
    x, y, w, h = face_roi
    H, W = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    cx, cy = x + w // 2, y + h // 2
    ax_out = (w // 2, h // 2)
    ax_in  = (max(1, w // 2 - 14), max(1, h // 2 - 14))

    ring  = np.zeros(gray.shape, np.uint8)
    cv2.ellipse(ring, (cx, cy), ax_out, 0, 0, 360, 255, -1)
    cv2.ellipse(ring, (cx, cy), ax_in,  0, 0, 360,   0, -1)
    inner = np.zeros(gray.shape, np.uint8)
    cv2.ellipse(inner, (cx, cy), ax_in,  0, 0, 360, 255, -1)
    bg    = np.ones(gray.shape, np.uint8) * 255
    ax_bg = (min(W // 2 - 1, w), min(H // 2 - 1, h))
    cv2.ellipse(bg, (cx, cy), ax_bg, 0, 0, 360, 0, -1)

    sx  = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sy  = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad = np.sqrt(sx**2 + sy**2)

    rp = grad[ring  == 255]
    ip = grad[inner == 255]
    bp = grad[bg    == 255]

    if len(rp) == 0 or len(ip) == 0:
        return {"score": 0, "detail": "Cannot compute gradient"}

    rm = float(rp.mean())
    im = float(ip.mean())
    bm = float(bp.mean()) if len(bp) > 0 else rm
    sr = rm / (im + 1e-6)
    bgn = rm / (bm + 1e-6)

    if sr > 2.5 and bgn < 1.4:
        score = min(80, int((sr - 2.5) * 20 + 35))
        detail = f"Seam: ring={rm:.1f} inner={im:.1f} sr={sr:.2f} bgn={bgn:.2f}"
    elif sr > 2.0 and bgn < 1.2:
        score = 25
        detail = f"Mild seam (sr={sr:.2f} bgn={bgn:.2f})"
    else:
        score = 0
        detail = f"No seam (sr={sr:.2f} bgn={bgn:.2f} — background explains gradients)"

    return {"score": score, "detail": detail, "seam_ratio": sr}


# ─────────────────────────────────────────────────────────────────────────── #
# Main Detector                                                                 #
# ─────────────────────────────────────────────────────────────────────────── #
def run_local_faceswap_detection(image_path: str) -> dict:
    """
    Run multi-method face swap detection tuned for InsightFace inswapper_128.
    Primary: ELA (Error Level Analysis)
    Secondary: Noise residual, color mismatch, sharpness, seam
    """
    try:
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            return _empty("Could not read image")

        face_roi = _detect_face_roi(img_bgr)
        if face_roi is None:
            return _empty("No face detected by Haar cascade")

        # Run all checks
        checks = {
            "ela":                _check_ela(img_bgr, face_roi),
            "noise_residual":     _check_noise_residual(img_bgr, face_roi),
            "color_mismatch":     _check_color_mismatch(img_bgr, face_roi),
            "sharpness_mismatch": _check_sharpness_mismatch(img_bgr, face_roi),
            "boundary_seam":      _check_boundary_seam(img_bgr, face_roi),
        }

        scores = {k: v["score"] for k, v in checks.items()}

        # ELA is the most reliable — double weight it
        ela_score   = scores["ela"]
        noise_score = scores["noise_residual"]

        # Count checks fired at threshold 30
        fired_scores = [s for s in scores.values() if s >= 30]
        num_fired    = len(fired_scores)

        # Confidence = average of FIRED checks (not all 5) + num_fired bonus
        # This correctly reflects: 2 checks at 50 and 65 → ~65% confidence
        if num_fired > 0:
            avg_fired    = sum(fired_scores) / len(fired_scores)
            weighted_conf = min(90, int(avg_fired * 0.85 + num_fired * 8))
        else:
            # No checks fired: use soft weighted average as fallback
            soft_sum = (
                ela_score   * 2.5 +
                noise_score * 2.0 +
                scores["color_mismatch"]     +
                scores["sharpness_mismatch"] +
                scores["boundary_seam"]
            )
            weighted_conf = min(35, int(soft_sum / 8.5))

        # ── Detection decision ───────────────────────────────────────────── #
        # Key rules to separate face swap vs AI camera enhanced:
        #
        # Face swap:    face noise LOWER than neck (GFPGAN processes face ONLY)
        # AI enhanced:  neck ALSO smooth → whole_image_smooth=True → score halved
        # Portrait mode: face SHARPER than clothing (ratio>1), not blurrier
        #
        # Detection requires corroboration — sharpness alone is not enough
        # because Portrait Mode also creates face/clothing sharpness difference.

        noise_whole_smooth = checks["noise_residual"].get("whole_image_smooth", False)
        sharpness_ratio    = checks["sharpness_mismatch"].get("ratio", 1.0)
        sharpness_blurrier = sharpness_ratio < 0.38  # face blurrier = swap, not portrait
        max_score = max(scores.values()) if scores else 0

        detected = (
            # ELA strong alone (compression history matches swap)
            ela_score >= 45
            # Noise alone very strong AND neck not smooth (= face-only GFPGAN)
            or (noise_score >= 50 and not noise_whole_smooth)
            # Sharpness showing face BLURRIER + any second signal
            or (sharpness_blurrier and num_fired >= 2)
            # Any single check very strong (>=65) + noise at least mild
            or (max_score >= 65 and scores["noise_residual"] >= 18)
            # 2+ checks fired and weighted conf meaningful
            or (num_fired >= 2 and weighted_conf >= 45)
        )

        fired_details = [
            f"  [{k.upper()} score={v['score']}]: {v['detail']}"
            for k, v in checks.items() if v["score"] >= 30
        ]

        if fired_details:
            summary = (
                f"LOCAL DETECTOR: {num_fired}/5 checks fired "
                f"(weighted conf: {weighted_conf}%):\n" + "\n".join(fired_details)
            )
        else:
            summary = (
                f"Local detector: {num_fired} checks fired, "
                f"weighted conf={weighted_conf}%. No strong face swap signals."
            )

        return {
            "local_faceswap_detected":    detected,
            "local_faceswap_confidence":  weighted_conf,
            "local_forensic_summary":     summary,
            "local_checks_fired":         num_fired,
            "checks": {k: {"score": v["score"], "detail": v["detail"]} for k, v in checks.items()},
        }

    except Exception as e:
        return _empty(f"Detector error: {str(e)}")


def _empty(reason: str) -> dict:
    return {
        "local_faceswap_detected":   False,
        "local_faceswap_confidence": 0,
        "local_forensic_summary":    reason,
        "local_checks_fired":        0,
        "checks":                    {}
    }
