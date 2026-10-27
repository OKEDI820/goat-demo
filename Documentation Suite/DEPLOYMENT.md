# 🚀 Deployment Guide

Complete instructions for deploying the Goat Collar demo to production.

---

## 📋 Prerequisites for All Platforms

1. **GitHub Repository** (optional but recommended)
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Goat Collar demo"
   git remote add origin https://github.com/YOUR_USERNAME/goat-collar-demo.git
   git push -u origin main
   ```

2. **Verify Local Setup Works**
   ```bash
   # Start locally first
   ./start.sh  # On Mac/Linux
   # or
   start.bat   # On Windows
   
   # Check health
   curl http://localhost:5000/health
   ```

---

## Option 1: Vercel (Frontend) + Railway (Backend) ⭐ Recommended

**Best for:** Student projects, low traffic, automatic scaling

### Frontend to Vercel (5 minutes)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy Frontend**
   ```bash
   cd frontend
   vercel --prod
   ```
   - When asked, link to Vercel account (create free account if needed)
   - Set build command: `npm run build`
   - Set output directory: `build`
   - When deployment completes, you get a URL like: `https://goat-collar-demo.vercel.app`

### Backend to Railway (5 minutes)

1. **Go to railway.app**
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub"
   - Connect your repository
   - Select `backend` as root directory

2. **Configure Environment**
   - Python Version: `3.9`
   - Install Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn --bind 0.0.0.0:$PORT --timeout 120 app:app`
   - In `backend/requirements.txt`, add `gunicorn==20.1.0`

3. **Get Backend URL**
   - After deploy, Railway shows your URL: `https://goat-collar-backend-production.railway.app`

### Connect Frontend to Backend

In `frontend/.env.production`:
```
REACT_APP_API_URL=https://goat-collar-backend-production.railway.app
```

Then redeploy frontend:
```bash
cd frontend
vercel --prod
```

**Total Cost:** $0 (both free tier)

---

## Option 2: Render (Full Stack) ⭐⭐ Simplest

**Best for:** One-click deployment, bundled service

### Create Render Account

1. Go to **render.com**
2. Sign up with GitHub
3. Authorize Render to access your repository

### Deploy Backend Service

1. Click **New** → **Web Service**
2. Select your GitHub repository
3. Configure:
   - **Name:** `goat-collar-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3.9
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --bind 0.0.0.0:$PORT --timeout 120 app:app`
   - **Plan:** Free

4. Click **Create Web Service**
5. Wait ~2 minutes for deployment
6. Copy the backend URL from dashboard

### Deploy Frontend Service

1. Click **New** → **Web Service**
2. Select your GitHub repository again
3. Configure:
   - **Name:** `goat-collar-frontend`
   - **Root Directory:** `frontend`
   - **Runtime:** Node 16
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     ```
     REACT_APP_API_URL=https://goat-collar-backend-xxxxx.onrender.com
     ```
   - **Plan:** Free

4. Click **Create Web Service**
5. Your app is now at `https://goat-collar-frontend-xxxxx.onrender.com`

**Total Cost:** $0 (both free tier)

---

## Option 3: Docker + Any Cloud Provider

**Best for:** Maximum control, custom configurations

### Build Docker Images Locally

```bash
# Build backend image
cd backend
docker build -t goat-collar-backend .

# Build frontend image
cd ../frontend
docker build -t goat-collar-frontend .

# Test locally
docker-compose up
# Visit http://localhost:3000
```

### Push to Docker Hub

```bash
# Create Docker Hub account at docker.com

docker login

# Tag and push backend
docker tag goat-collar-backend YOUR_DOCKERHUB_USERNAME/goat-collar-backend:latest
docker push YOUR_DOCKERHUB_USERNAME/goat-collar-backend:latest

# Tag and push frontend
docker tag goat-collar-frontend YOUR_DOCKERHUB_USERNAME/goat-collar-frontend:latest
docker push YOUR_DOCKERHUB_USERNAME/goat-collar-frontend:latest
```

### Deploy to Cloud Run (Google Cloud) - Free Tier

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Deploy backend
gcloud run deploy goat-collar-backend \
  --image YOUR_DOCKERHUB_USERNAME/goat-collar-backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Deploy frontend (update API_URL first)
# Edit frontend/nginx.conf to set REACT_APP_API_URL
gcloud run deploy goat-collar-frontend \
  --image YOUR_DOCKERHUB_USERNAME/goat-collar-frontend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**Total Cost:** $0-$1/month (generous free tier)

---

## Option 4: Heroku (Legacy - Paid)

**Note:** Heroku free tier discontinued. Now requires paid dyno.

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

heroku login

# Create backend app
heroku create goat-collar-backend
cd backend
git push heroku main

# Create frontend app
cd ../frontend
heroku create goat-collar-frontend
heroku config:set REACT_APP_API_URL=https://goat-collar-backend.herokuapp.com
git push heroku main
```

**Cost:** $5-7/month per dyno

---

## 🔐 Environment Variables

### Backend (Create `.env` in `backend/` directory)

```env
FLASK_ENV=production
FLASK_DEBUG=False
```

### Frontend (Create `.env.production` in `frontend/` directory)

```env
REACT_APP_API_URL=https://your-backend-url.com
```

**Never commit `.env` files to Git!** (Already in `.gitignore`)

---

## 🧪 Testing Deployed Version

After deployment, test all endpoints:

```bash
# Health check
curl https://YOUR_BACKEND_URL/health

# M1 Specs
curl https://YOUR_BACKEND_URL/m1/spec

# M2 Specs  
curl https://YOUR_BACKEND_URL/m2/spec

# M1 Inference (requires motion data)
curl -X POST https://YOUR_BACKEND_URL/m1/infer \
  -H "Content-Type: application/json" \
  -d '{"windows": [[[0.1, 0.2, 0.3, 10, 20, 30], ...]]}'
```

---

## 🎯 Recommended Deployment Path (for your project)

1. **Start with Render** (simplest, everything in one place)
   - Takes 10 minutes total
   - Free tier is generous
   - Perfect for demo to lecturer

2. **Or use Vercel + Railway** if you want to keep frontend and backend separate

3. **Add Docker later** if you want full control or to deploy elsewhere

---

## 📊 Comparison

| Platform | Frontend | Backend | Cost | Setup Time |
|----------|----------|---------|------|-----------|
| **Render** | ✓ | ✓ | Free | 10 min |
| **Vercel + Railway** | ✓ | ✓ | Free | 15 min |
| **Google Cloud Run** | ✓ | ✓ | ~Free | 20 min |
| **Heroku** | ✓ | ✓ | $7+/mo | 10 min |
| **AWS** | ✓ | ✓ | ~$1/mo | 30 min |

---

## 🛠️ Troubleshooting Deployments

### "Backend returns 502 Bad Gateway"

**Cause:** Backend crashed or startup failed

**Fix:**
```bash
# Check logs (Render/Railway dashboard)
# Common: Missing M1_collar_model.joblib in deployment

# Ensure model files are in Git:
git add backend/M1_collar_model.joblib
git commit -m "Add model files"
git push
```

### "Frontend shows blank page"

**Cause:** API_URL not set correctly

**Fix:**
```bash
# Update environment variable
REACT_APP_API_URL=https://your-actual-backend-url

# Verify in browser console:
# Should show API calls to correct backend
```

### "Camera permission denied"

**Cause:** HTTPS not enabled (security requirement)

**Fix:**
- Local development: Fine with HTTP
- Production: All hosting above provides HTTPS automatically
- If custom domain: Add SSL certificate

### "Slow startup time"

**Cause:** Free tier resources, cold start

**Fix:**
- Expected on free tier (5-30 seconds first request)
- Pay tier starts instantly
- Or: Keep backend "warm" with uptime monitor

---

## 📱 Demo Day Checklist

- [ ] Deployed and accessible via public URL
- [ ] Can access M1 specs from phone
- [ ] Can access M2 specs from phone  
- [ ] M1 demo button works (generates test data)
- [ ] Camera works on phone (for M2)
- [ ] Model Specs tab shows all metrics
- [ ] Response time < 2 seconds
- [ ] Works on both WiFi and cellular
- [ ] Tested on iPhone and Android

---

## 🎓 Share with Lecturer

**Send this URL:**
```
https://goat-collar-frontend-xxxxx.vercel.app
```

Or if using Render:
```
https://goat-collar-frontend-xxxxx.onrender.com
```

**Demo Script:** (5 minutes)

> "Sir, here's the system working live. You can test both models right now:
>
> **1. Motion Classifier (M1):** Click the button to run inference on test sensor data. It detects eating behavior with 93.6% accuracy.
>
> **2. Plant Classifier (M2):** Use the camera on your phone to take a picture of any plant. It identifies 5 species with 96.4% accuracy.
>
> **3. Model Specs:** Shows all the metrics and performance details.
>
> The backend API is running serverlessly and scales automatically. The models are compressed and optimized for edge deployment."

---

Good luck with your demo! 🐐🌿
