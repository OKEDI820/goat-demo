# 🐐 Goat Collar Demo - Mobile Web Application

A full-stack web application demonstrating two machine learning models for goat-borne zoopharmacognosy research:
- **M1**: Motion Classifier (Random Forest) - Detects eating behavior from accelerometer + gyroscope data
- **M2**: Plant Classifier (MobileNetV2 CNN) - Identifies 5 plant species from images

Built for Makerere University CSC 3118 Final Year Project.

---

## 🎯 Project Overview

### Models

**M1: Motion Classifier (Random Forest)**
- Input: 400 sensor samples × 6 channels (ax, ay, az, gx, gy, gz) at 200 Hz
- Features: 166 temporal & frequency-domain statistics
- Performance: 93.6% Test PR-AUC, 92.88% Recall (eating detection)
- File: `M1_collar_model.joblib` (469 KB)

**M2: Plant Classifier (MobileNetV2 Distilled CNN)**
- Input: 160×160 RGB images
- Classes: Hibiscus, Aloe Vera, Moringa, Neem, Tulsi
- Performance: 96.39% Test Accuracy, 0.9673 Macro F1
- File: `M2_plant_model.tflite` (33 KB - INT8 quantized)

### Architecture

```
┌─────────────────────────────┐
│   React Frontend (port 3000)│
│  - M1 Demo (test data)      │
│  - M2 Demo (camera/upload)  │
│  - Model Specs              │
└────────────┬────────────────┘
             │ HTTP/CORS
┌────────────▼────────────────┐
│  Flask Backend (port 5000)  │
│  - /m1/infer                │
│  - /m1/spec                 │
│  - /m2/spec                 │
│  - /m2/model (download)     │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│  M1: Random Forest (joblib) │
│  M2: TFLite Model (binary)  │
└─────────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- pip

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run Flask server (port 5000)
python app.py
```

You should see:
```
🐐 GOAT COLLAR DEMO BACKEND
✓ M1 model loaded: Random Forest (25 trees)
✓ M2 metadata loaded: 5 plant species
 * Running on http://0.0.0.0:5000
```

### 2. Frontend Setup (new terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start React dev server (port 3000)
npm start
```

The app opens at `http://localhost:3000`

---

## 🧪 Using the Demo

### M1: Motion Classifier Tab
1. Click **▶ Run M1 Demo**
2. App generates synthetic 2-second motion window (400 samples × 6 channels)
3. Backend extracts 166 features and runs Random Forest inference
4. Results show:
   - **Decision**: "EATING" or "NOT EATING"
   - **P(Eating)**: Probability (0-1)
   - **Threshold**: Decision boundary (0.43)
   - **Features Extracted**: 166

### M2: Plant Classifier Tab
1. Click **📷 Start Camera** or **📁 Upload Image**
2. Capture plant leaf image or select from file
3. Backend (or browser TFLite) classifies the image
4. Results show confidence scores for all 5 species

### Model Specs Tab
View accuracy metrics, feature counts, and model file sizes.

---

## 🌐 Deployment

### Option A: Vercel + Railway (Recommended)

#### Frontend to Vercel
```bash
cd frontend
npm run build

# Deploy to Vercel
npm i -g vercel
vercel --prod
```

#### Backend to Railway
```bash
cd backend

# Create Railway app
# Connect GitHub repo or use Railway CLI
# Set Python version: 3.9
# Add environment: PORT=5000
railway deploy
```

Then update frontend environment variable:
```bash
# frontend/.env.production
REACT_APP_API_URL=https://your-railway-backend.railway.app
```

### Option B: Render (All-in-One)

**Create Render Web Service:**

1. **Backend Service**
   - GitHub repo: your-repo
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - Add `gunicorn` to requirements.txt

2. **Frontend Service**
   - GitHub repo: your-repo
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `build`

### Option C: Heroku (Legacy)

```bash
# Install Heroku CLI and login
heroku login

# Backend
cd backend
heroku create your-app-backend
git push heroku main

# Frontend
cd ../frontend
heroku create your-app-frontend
REACT_APP_API_URL=https://your-app-backend.herokuapp.com npm run build
git push heroku main
```

### Option D: Docker (Local + Cloud)

**Dockerfile for Backend:**

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

**Dockerfile for Frontend:**

```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      FLASK_ENV: production

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

Run:
```bash
docker-compose up
```

---

## 📊 API Reference

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "m1_ready": true,
  "m2_ready": true
}
```

### M1 Inference
```
POST /m1/infer
Content-Type: application/json
```

**Request:**
```json
{
  "windows": [
    [[ax, ay, az, gx, gy, gz], [...], ...],  // 400 samples × 6 channels
    ...
  ]
}
```

**Response:**
```json
{
  "p_eating": [0.87],
  "threshold": 0.43,
  "decisions": ["eating"],
  "features_extracted": 166
}
```

### M1 Specifications
```
GET /m1/spec
```

**Response:**
```json
{
  "model": "Random Forest",
  "setting": "25 trees, depth 16",
  "threshold": 0.43,
  "test_accuracy": 0.936,
  "test_f1": 0.8210,
  "features": 166,
  "sample_rate_hz": 200,
  "window_ms": 2000
}
```

### M2 Specifications
```
GET /m2/spec
```

### Download M2 Model
```
GET /m2/model

Response: Binary TFLite file (33 KB)
```

---

## 📁 Project Structure

```
goat-collar-demo/
├── backend/
│   ├── app.py                    # Flask REST API
│   ├── requirements.txt           # Python dependencies
│   ├── M1_collar_model.joblib    # Random Forest model (469 KB)
│   ├── M2_plant_model.tflite     # TensorFlow Lite model (33 KB)
│   ├── M2_plant_model.json       # M2 metadata
│   └── test_split.csv            # Test data samples
├── frontend/
│   ├── package.json              # Node dependencies
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── App.js                # Main React component (tabs)
│       └── App.css               # Responsive styling
├── docker-compose.yml            # Docker orchestration
└── README.md
```

---

## 🔧 Development

### Testing Locally

**Test M1 endpoint:**
```bash
curl -X POST http://localhost:5000/m1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "windows": [[[0.1, 0.2, 0.3, 10, 20, 30], ...400 samples total...]]
  }'
```

**Test M2 specs:**
```bash
curl http://localhost:5000/m2/spec
```

### Environment Variables

**Frontend (.env):**
```
REACT_APP_API_URL=http://localhost:5000
```

**Backend (app.py):**
- Auto-loads models from current directory
- Set `debug=False` for production

---

## 📈 Performance Metrics

| Metric | M1 | M2 |
|--------|----|----|
| Test Accuracy | 93.6% PR-AUC | 96.39% |
| Test F1 | 82.10% | 96.73% (macro) |
| Model Size | 469 KB | 33 KB |
| Latency | <100ms | <200ms |
| Input | 400×6 sensors | 160×160 image |
| Features | 166 | 64,256 (CNN) |

---

## 🎓 System Demo Script (5 minutes)

**Narration:**

> "This is the Goat Collar system demo. We have two models working here:
> 
> **M1 (Motion Classifier):** This Random Forest model learns to detect when a goat is eating by analyzing accelerometer and gyroscope data from a collar-mounted device. It extracts 166 features - temporal statistics like mean, variance, skew, and frequency-domain features like spectral power and entropy. Let me run it on test data..."
> 
> [Click "Run M1 Demo" → show 93% confidence for eating]
> 
> "As you see, the model confidently predicts 'EATING' with 93% probability. It achieved 93.6% precision-recall AUC on held-out test data.
> 
> **M2 (Plant Classifier):** This is a distilled MobileNetV2 CNN optimized to identify plants the goats select. We have 5 species: Moringa, Neem, Tulsi, Hibiscus, and Aloe Vera. Let me upload a test image..."
> 
> [Upload plant image → show top-1 species with 96% accuracy]
> 
> "The plant model achieved 96.4% test accuracy. Both models run efficiently - the plant model is only 33 KB thanks to INT8 quantization and knowledge distillation.
> 
> This web app lets your team test both models without hardware - you can use your phone camera for plants and we generate motion windows for M1. The backend is deployed serverlessly, so it scales automatically."

---

## 🐛 Troubleshooting

**CORS Error:** Backend not running or on different port
```bash
# Verify backend is running
curl http://localhost:5000/health
```

**M1 Model Not Loaded:** Check `M1_collar_model.joblib` exists in backend directory
```bash
ls -lh backend/M1_collar_model.joblib
```

**Camera Permission Denied:** Browser security - use HTTPS in production
- Localhost works fine for development
- Production needs HTTPS or camera won't work

**Port Already in Use:**
```bash
# Kill process on port 5000
lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

---

## 📝 License

Makerere University CSC 3118 - Final Year Project

---

## 📞 Support

For issues or questions:
1. Check the demo is working: `npm start` (frontend) + `python app.py` (backend)
2. Verify API connectivity: Visit `http://localhost:5000/health`
3. Check browser console for errors (F12)
4. Ensure model files exist in `backend/` directory

---

**Ready to demo to your lecturer!** 🎉
