"""
Goat Collar Demo Backend
Serves M1 (motion classifier) inference via REST API
M2 (plant classifier) runs client-side in TensorFlow.js
"""

import os
import json
import numpy as np
import joblib
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from typing import Dict, List
import io

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ============================================================================
# LOAD MODELS AND METADATA
# ============================================================================

# Load M1 model (Random Forest bundle)
try:
    m1_bundle = joblib.load("M1_collar_model.joblib")
    M1_READY = True
    M1_THRESHOLD = m1_bundle["threshold"]
    M1_FEATURE_NAMES = m1_bundle["feature_names"]
    M1_MODEL = m1_bundle["model"]
    print(f"✓ M1 model loaded: {m1_bundle['name']}")
    print(f"  Threshold: {M1_THRESHOLD:.2f}, Features: {len(M1_FEATURE_NAMES)}")
except Exception as e:
    M1_READY = False
    print(f"✗ M1 model failed to load: {e}")

# Load M2 metadata (model runs in browser, but we serve metadata)
try:
    with open("M2_plant_model.json") as f:
        M2_META = json.load(f)
    M2_READY = True
    print(f"✓ M2 metadata loaded: {M2_META['model']}")
    print(f"  Species: {M2_META['names']}")
except Exception as e:
    M2_READY = False
    print(f"✗ M2 metadata failed to load: {e}")

# ============================================================================
# FEATURE EXTRACTION FOR M1 (from the notebook)
# ============================================================================

FS = 200  # Sample rate in Hz
BANDS = [(0, 2), (2, 5), (5, 10), (10, 20), (20, FS / 2)]
SIG_NAMES = ["ax", "ay", "az", "gx", "gy", "gz"] + ["acc_mag", "gyr_mag"]
STATS = (["mean", "median", "min", "max", "range", "std", "iqr", "rms",
          "skew", "kurt", "jerk", "zcr", "dom_freq"]
         + [f"band_{int(a)}_{int(b)}Hz" for a, b in BANDS]
         + ["spec_entropy", "p90"])
PAIRS = [(0, 1), (0, 2), (1, 2), (3, 4), (3, 5), (4, 5)]


def extract_features(X_batch: np.ndarray) -> np.ndarray:
    """
    Extract 166 features from motion windows.
    Input: (n, 400, 6) raw sensor readings (400 samples × 6 channels)
    Output: (n, 166) feature table
    """
    X_batch = X_batch.astype(np.float64)
    n, T, _ = X_batch.shape

    # Magnitude of acceleration and gyroscope
    acc_mag = np.linalg.norm(X_batch[:, :, 0:3], axis=2, keepdims=True)
    gyr_mag = np.linalg.norm(X_batch[:, :, 3:6], axis=2, keepdims=True)
    S = np.concatenate([X_batch, acc_mag, gyr_mag], axis=2)  # (n, T, 8)

    # Temporal statistics
    mean = S.mean(1)
    std = S.std(1)
    cen = S - mean[:, None, :]
    q25, q50, q75, q90 = np.percentile(S, [25, 50, 75, 90], axis=1)
    mn, mx = S.min(1), S.max(1)
    rms = np.sqrt((S ** 2).mean(1))
    eps = 1e-9
    skew = (cen ** 3).mean(1) / (std ** 3 + eps)
    kurt = (cen ** 4).mean(1) / (std ** 4 + eps) - 3.0
    jerk = np.abs(np.diff(S, axis=1)).mean(1)
    zcr = (np.diff(np.signbit(cen), axis=1)).mean(1)

    # Frequency domain features
    power = np.abs(np.fft.rfft(cen, axis=1)) ** 2
    freqs = np.fft.rfftfreq(T, 1.0 / FS)
    total = power.sum(1) + eps
    dom = freqs[power[:, 1:, :].argmax(1) + 1]
    bands = [power[:, (freqs >= a) & (freqs < b), :].sum(1) / total for a, b in BANDS]
    p = power / total[:, None, :]
    ent = -(p * np.log(p + eps)).sum(1) / np.log(power.shape[1])

    # Stack per-signal features
    per_signal = [mean, q50, mn, mx, mx - mn, std, q75 - q25, rms,
                  skew, kurt, jerk, zcr, dom] + bands + [ent, q90]
    block = np.stack(per_signal, axis=2).reshape(n, -1)

    # Cross-axis correlations
    corrs = [(cen[:, :, i] * cen[:, :, j]).mean(1) / (std[:, i] * std[:, j] + eps)
             for i, j in PAIRS]

    return np.concatenate([block, np.stack(corrs, axis=1)], axis=1).astype(np.float32)


# ============================================================================
# ROUTES
# ============================================================================

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "m1_ready": M1_READY,
        "m2_ready": M2_READY
    })


@app.route("/m1/spec", methods=["GET"])
def m1_spec():
    """Return M1 model specifications."""
    if not M1_READY:
        return jsonify({"error": "M1 model not loaded"}), 400

    return jsonify({
        "model": m1_bundle["name"],
        "setting": m1_bundle["setting"],
        "threshold": float(M1_THRESHOLD),
        "test_accuracy": m1_bundle["test_pr_auc"],
        "test_f1": m1_bundle["test_f1"],
        "features": len(M1_FEATURE_NAMES),
        "sample_rate_hz": FS,
        "window_ms": int(m1_bundle["window_samples"] * 1000 / FS),
    })


@app.route("/m1/infer", methods=["POST"])
def m1_infer():
    """
    Run M1 inference on motion window(s).

    Input JSON:
    {
        "windows": [list of motion windows, each 400×6 array]
    }

    Output JSON:
    {
        "p_eating": [list of P(eating) values],
        "threshold": 0.43,
        "decisions": ["eating", "not eating", ...],
        "features_extracted": 166
    }
    """
    if not M1_READY:
        return jsonify({"error": "M1 model not loaded"}), 400

    try:
        data = request.get_json()
        windows = np.array(data.get("windows", []), dtype=np.float32)

        if len(windows.shape) == 2:
            # Single window: reshape to (1, 400, 6)
            windows = windows.reshape(1, 400, 6)

        if windows.shape[1] != 400 or windows.shape[2] != 6:
            return jsonify({
                "error": f"Expected shape (n, 400, 6), got {windows.shape}"
            }), 400

        # Extract features
        features = extract_features(windows)

        # Get feature indices (if the model was trained on a subset)
        if "feature_idx" in m1_bundle:
            features = features[:, m1_bundle["feature_idx"]]

        # Run inference
        if m1_bundle["kind"] == "int_forest":
            # Integer quantized model: convert features to int16
            f_min = m1_bundle["f_min"]
            f_scale = m1_bundle["f_scale"]
            f_max = f_min + 65535 * f_scale  # Calculate the 16-bit integer maximum
            Q = np.round((np.clip(features, f_min, f_max) - f_min) / f_scale) - 32768
            Q = Q.astype(np.int16)

            # Predict using the integer model
            leaves = m1_bundle["model"].apply(Q.astype(np.float32))
            leaf_q = m1_bundle["leaf_q"]
            votes = np.stack([leaf_q[t][leaves[:, t]] for t in range(len(leaf_q))], axis=1)
            p_eating = votes.astype(np.float64).mean(1) / 255.0
        else:
            # Regular model
            p_eating = m1_bundle["model"].predict_proba(features)[:, 1]

        # Apply threshold
        decisions = ["eating" if p > M1_THRESHOLD else "not eating" for p in p_eating]

        return jsonify({
            "p_eating": p_eating.tolist(),
            "threshold": float(M1_THRESHOLD),
            "decisions": decisions,
            "features_extracted": int(features.shape[1])
        })

    except Exception as e:
        print(f"M1 inference error: {e}")
        return jsonify({"error": str(e)}), 400


@app.route("/m2/spec", methods=["GET"])
def m2_spec():
    """Return M2 model specifications."""
    if not M2_READY:
        return jsonify({"error": "M2 model not loaded"}), 400

    return jsonify({
        "model": M2_META["model"],
        "setting": M2_META["setting"],
        "species": M2_META["names"],
        "image_size": M2_META["image_size"],
        "theta": M2_META.get("theta", 0.5),
        "test_accuracy": M2_META.get("test_accuracy", 0.96),
        "test_macro_f1": M2_META.get("test_macro_f1", 0.96),
        "file_mb": M2_META.get("file_mb", 0.034)
    })


@app.route("/m2/model", methods=["GET"])
def m2_model():
    """
    Serve the TensorFlow Lite model file for M2.
    Browser will use this to run client-side inference.
    """
    try:
        # Check if file exists
        if not os.path.exists("M2_plant_model.tflite"):
            print(f"❌ Model file not found at: {os.path.abspath('M2_plant_model.tflite')}")
            print(f"Current directory: {os.getcwd()}")
            print(f"Available files: {os.listdir('.')}")
            return jsonify({"error": "M2 model file not found"}), 404

        # Read the model file
        with open("M2_plant_model.tflite", "rb") as f:
            model_bytes = f.read()

        print(f"✓ Serving M2 model ({len(model_bytes)} bytes)")

        # Return as binary with proper headers
        return send_file(
            io.BytesIO(model_bytes),
            mimetype="application/octet-stream",
            as_attachment=False,
            download_name="M2_plant_model.tflite"
        )

    except Exception as e:
        print(f"❌ Error serving M2 model: {e}")
        return jsonify({"error": f"Failed to serve model: {str(e)}"}), 500


if __name__ == "__main__":
    # Print startup info
    print("\n" + "=" * 70)
    print("🐐 GOAT COLLAR DEMO BACKEND")
    print("=" * 70)
    print(f"M1 (Motion Classifier):  {'✓ Ready' if M1_READY else '✗ Not loaded'}")
    print(f"M2 (Plant Classifier):   {'✓ Ready' if M2_READY else '✗ Not loaded'}")
    print("\nAPI Endpoints:")
    print("  GET  /health         - Health check")
    print("  GET  /m1/spec        - M1 model specification")
    print("  POST /m1/infer       - Run M1 inference on motion windows")
    print("  GET  /m2/spec        - M2 model specification")
    print("  GET  /m2/model       - Download M2 TensorFlow Lite model (for browser)")
    print("=" * 70 + "\n")

    # Run server
    app.run(debug=False, port=5000, host="0.0.0.0")
