import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const WINDOW_MS = 2000; // the collar reads motion every 2 seconds

function App() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Idle. Press Start Camera.');
  const [error, setError] = useState(null);
  const [liveM1, setLiveM1] = useState(null);   // latest M1 result
  const [liveM2, setLiveM2] = useState(null);   // latest M2 result (only after M1 says eating)
  const [log, setLog] = useState([]);           // detections log, newest first
  const [specs, setSpecs] = useState({ m1: null, m2: null });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);     // stops a slow cycle from overlapping the next one
  const specsRef = useRef({ m1: null, m2: null });
  const tfliteModelRef = useRef(null); // TFLite model is downloaded once per session
  const eventsRef = useRef(0);

  useEffect(() => {
    fetchSpecs();
    return () => stopPipeline(); // stop the camera if the page is left
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSpecs = async () => {
    try {
      const [m1Res, m2Res] = await Promise.all([
        axios.get(`${API_BASE}/m1/spec`),
        axios.get(`${API_BASE}/m2/spec`)
      ]);
      specsRef.current = { m1: m1Res.data, m2: m2Res.data };
      setSpecs({ m1: m1Res.data, m2: m2Res.data });
    } catch (err) {
      console.error('Failed to load specs:', err);
    }
  };

  // ---------------------------------------------------------------------
  // Simulated collar motion (400 samples x 6 channels = 2 s at 200 Hz).
  // Replace with real collar data when the hardware is connected.
  // ---------------------------------------------------------------------
  const generateMotionWindow = (eating) => {
    const window = [];
    for (let i = 0; i < 400; i++) {
      const t = i / 200;
      const ax = eating ? Math.sin(t * 6) * 2 : Math.random() - 0.5;
      const ay = eating ? Math.cos(t * 5) * 1.5 : Math.random() - 0.5;
      const az = eating ? Math.sin(t * 4) * 1.2 : Math.random() - 0.5;
      const gx = eating ? Math.sin(t * 8) * 50 : (Math.random() - 0.5) * 10;
      const gy = eating ? Math.cos(t * 7) * 50 : (Math.random() - 0.5) * 10;
      const gz = eating ? Math.sin(t * 6) * 50 : (Math.random() - 0.5) * 10;
      window.push([ax, ay, az, gx, gy, gz]);
    }
    return window;
  };

  // M1: ask the backend whether the goat is eating.
  const runM1 = async (eating) => {
    const response = await axios.post(`${API_BASE}/m1/infer`, {
      windows: [generateMotionWindow(eating)]
    });
    return {
      eating: response.data.decisions[0] === 'eating',
      pEating: response.data.p_eating[0],
      threshold: response.data.threshold
    };
  };

  // M2: classify the current camera frame in the browser (TensorFlow.js TFLite).
  const runM2 = async (videoEl) => {
    const tf = window.tf;
    const tflite = window.tflite;
    if (!tf || !tflite) throw new Error('TensorFlow.js not found. Check index.html scripts.');
    const m2 = specsRef.current.m2;
    if (!m2) throw new Error('M2 specifications not loaded yet.');

    tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.8/dist/');

    if (!tfliteModelRef.current) {
      tfliteModelRef.current = await tflite.loadTFLiteModel(`${API_BASE}/m2/model`);
    }
    const model = tfliteModelRef.current;

    // Copy the current video frame onto the hidden canvas.
    const canvas = canvasRef.current;
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0);

    let probabilities;
    tf.tidy(() => {
      const size = Array.isArray(m2.image_size) ? m2.image_size[0] : m2.image_size;
      let tensor = tf.browser.fromPixels(canvas);
      tensor = tf.image.resizeBilinear(tensor, [size, size]);
      tensor = tensor.expandDims(0).cast('int32');

      const outputTensor = model.predict(tensor);
      const rawData = Array.from(outputTensor.dataSync());
      // Quantized output (0-255) is converted back to 0.0-1.0.
      probabilities = rawData.some(v => v > 1) ? rawData.map(v => v / 255.0) : rawData;
    });

    const confidence = {};
    m2.species.forEach((species, idx) => {
      confidence[species] = probabilities[idx];
    });
    const top = m2.species.reduce((best, s) =>
      confidence[s] > confidence[best] ? s : best, m2.species[0]);
    const topConfidence = confidence[top];
    const threshold = m2.theta || 0.5;

    return {
      plant: topConfidence < threshold ? null : top, // null means "not sure"
      topConfidence,
      confidence
    };
  };

  // One cycle: M1 every 2 s; if eating, capture the frame and run M2.
  const runCycle = async () => {
    if (busyRef.current || !videoRef.current) return;
    busyRef.current = true;
    try {
      // Simulated scenario: about 1 in 3 windows is eating.
      const m1 = await runM1(Math.random() < 0.33);
      setLiveM1(m1);
      setError(null);

      if (!m1.eating) {
        setLiveM2(null);
        setStatus('Watching. Goat not eating.');
        return;
      }

      setStatus('Eating detected. Identifying plant…');
      const m2 = await runM2(videoRef.current);
      setLiveM2(m2);
      eventsRef.current += 1;
      setStatus('Running: both models active');

      const time = new Date().toLocaleTimeString();
      setLog(prev => [
        {
          time,
          pEating: m1.pEating,
          plant: m2.plant,
          confidence: m2.topConfidence
        },
        ...prev
      ].slice(0, 50));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message);
    } finally {
      busyRef.current = false;
    }
  };

  const startPipeline = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setRunning(true);
      setStatus('Running: both models active');
      setLiveM1(null);
      setLiveM2(null);
      eventsRef.current = 0;
      timerRef.current = setInterval(runCycle, WINDOW_MS);
      runCycle();
    } catch (err) {
      setError('Camera access denied: ' + err.message);
    }
  };

  function stopPipeline() {
    clearInterval(timerRef.current);
    timerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  const handleStop = () => {
    stopPipeline();
    setRunning(false);
    setStatus(`Stopped. ${eventsRef.current} eating event(s) detected.`);
    setLiveM1(null);
    setLiveM2(null);
  };

  // ---------------------------------------------------------------------
  const renderSpecs = () => (
    <>
      {specs.m1 && (
        <div className="specs-card">
          <h3>M1: Motion Classifier</h3>
          <table className="specs-table">
            <tbody>
              <tr><td>Model</td><td>{specs.m1.model}</td></tr>
              <tr><td>Setting</td><td>{specs.m1.setting}</td></tr>
              <tr><td>Test PR-AUC</td><td>{(specs.m1.test_accuracy * 100).toFixed(2)}%</td></tr>
              <tr><td>Test F1 Score</td><td>{(specs.m1.test_f1 * 100).toFixed(2)}%</td></tr>
              <tr><td>Features</td><td>{specs.m1.features}</td></tr>
              <tr><td>Sample Rate</td><td>{specs.m1.sample_rate_hz} Hz</td></tr>
              <tr><td>Window Duration</td><td>{specs.m1.window_ms} ms (2 seconds)</td></tr>
              <tr><td>Decision Threshold</td><td>{specs.m1.threshold.toFixed(3)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {specs.m2 && (
        <div className="specs-card">
          <h3>M2: Plant Classifier</h3>
          <table className="specs-table">
            <tbody>
              <tr><td>Model</td><td>{specs.m2.model}</td></tr>
              <tr><td>Setting</td><td>{specs.m2.setting}</td></tr>
              <tr><td>Test Accuracy</td><td>{(specs.m2.test_accuracy * 100).toFixed(2)}%</td></tr>
              <tr><td>Test Macro F1</td><td>{(specs.m2.test_macro_f1 * 100).toFixed(2)}%</td></tr>
              <tr><td>Species</td><td>{specs.m2.species.join(', ')}</td></tr>
              <tr><td>Image Size</td><td>{specs.m2.image_size}×{specs.m2.image_size} px</td></tr>
              <tr><td>Model Size</td><td>{specs.m2.file_mb.toFixed(3)} MB</td></tr>
              <tr><td>Classification Threshold</td><td>{specs.m2.theta.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <div className="App">
      <header className="app-header">
        <h1>🐐 Goat Collar Demo</h1>
        <p>Motion &amp; Plant Classification System</p>
      </header>

      <main className="tab-content">
        <div className="tab-pane single-panel">
          <div className="demo-section">
            {!running ? (
              <button className="action-btn primary" onClick={startPipeline}>
                📷 Start Camera
              </button>
            ) : (
              <button className="action-btn secondary" onClick={handleStop}>
                ⏹ Stop
              </button>
            )}
            <p className="status-line">{status}</p>
          </div>

          <div className="video-section">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="live-video"
              style={{ display: running ? 'block' : 'none' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="result-box">
            <h3>Live result</h3>
            <div className="live-row">
              <span className="live-label">Eating (M1)</span>
              {liveM1 ? (
                <span className={`decision ${liveM1.eating ? 'eating' : 'not eating'}`}>
                  {liveM1.eating ? 'EATING' : 'NOT EATING'} ({(liveM1.pEating * 100).toFixed(1)}%)
                </span>
              ) : (
                <span className="hint">Waiting for motion…</span>
              )}
            </div>
            <div className="live-row">
              <span className="live-label">Plant (M2)</span>
              {liveM2 ? (
                liveM2.plant ? (
                  <span className="decision eating">{liveM2.plant} ({(liveM2.topConfidence * 100).toFixed(1)}%)</span>
                ) : (
                  <span className="decision uncertain">
                    Not sure, sent to review ({(liveM2.topConfidence * 100).toFixed(1)}%)
                  </span>
                )
              ) : (
                <span className="hint">Runs only when M1 detects eating.</span>
              )}
            </div>
          </div>

          <div className="result-box">
            <h3>Detections log</h3>
            {log.length === 0 ? (
              <p className="hint">No detections yet.</p>
            ) : (
              <table className="specs-table log-table">
                <thead>
                  <tr><th>Time</th><th>Eating (M1)</th><th>Plant (M2)</th><th>Confidence</th></tr>
                </thead>
                <tbody>
                  {log.map((row, i) => (
                    <tr key={i}>
                      <td>{row.time}</td>
                      <td>Yes ({(row.pEating * 100).toFixed(0)}%)</td>
                      <td>{row.plant ?? 'Not sure'}</td>
                      <td>{(row.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="hint">
            Motion is simulated. The camera stands in for the collar camera.
          </p>

          <details className="specs-toggle">
            <summary>Model specifications</summary>
            {renderSpecs()}
          </details>
        </div>
      </main>

      <footer className="app-footer">
        <p>Goat Collar System Demo • Makerere University CSC 3118</p>
        <p>Backend: {API_BASE}</p>
      </footer>
    </div>
  );
}

export default App;
