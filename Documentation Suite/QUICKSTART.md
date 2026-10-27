# ⚡ Quick Start (2 Minutes)

Get the demo running immediately. Full documentation is in **README.md**.

---

## 🖥️ On Your Computer (Mac/Linux)

```bash
cd goat-collar-demo
chmod +x start.sh
./start.sh
```

Opens automatically at: **http://localhost:3000**

---

## 🪟 On Windows

```cmd
cd goat-collar-demo
start.bat
```

Opens automatically at: **http://localhost:3000**

---

## ☁️ Online (In 10 Minutes)

Choose one:

### **Easiest: Render**
1. Go to **render.com** → Sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your goat-collar-demo repo
4. Deploy both `backend` and `frontend` folders
5. Get public URLs ✓

### **Or: Vercel + Railway**
- **Vercel** for frontend (vercel.com)
- **Railway** for backend (railway.app)
- Free tier, instant deployment

See **DEPLOYMENT.md** for step-by-step details.

---

## 🧪 Test It Works

```bash
# In new terminal (backend must be running):
curl http://localhost:5000/health
```

Should return: `{"status": "ok", "m1_ready": true, "m2_ready": true}`

---

## 🎯 What to Show Your Lecturer

**URL:** `https://your-frontend-url`

1. **M1: Motion Classifier Tab**
   - Click "Run M1 Demo" 
   - Shows eating detection with 93.6% accuracy ✓

2. **M2: Plant Classifier Tab**
   - Click "Start Camera" or upload image
   - Shows plant species with 96.4% accuracy ✓

3. **Model Specs Tab**
   - All metrics displayed ✓

---

## 📁 File Structure

```
goat-collar-demo/
├── backend/
│   ├── app.py                   ← Flask API
│   ├── M1_collar_model.joblib   ← Motion classifier
│   ├── M2_plant_model.tflite    ← Plant classifier  
│   └── requirements.txt          ← Python packages
├── frontend/
│   ├── src/App.js               ← React component
│   ├── package.json             ← Node packages
│   └── public/index.html        ← HTML template
├── README.md                    ← Full docs
├── DEPLOYMENT.md                ← Deploy instructions
├── DEMO_GUIDE.md                ← Your demo script
└── start.sh / start.bat         ← Quick start
```

---

## ⚠️ Troubleshooting

**"Connection refused"**
- Backend not running? Run `./start.sh` first

**"M1 model not loaded"**
- Check `backend/M1_collar_model.joblib` exists
- It's 469 KB - should be there from uploads

**"Camera won't work"**
- Local: Fine with HTTP
- Production: Must use HTTPS (Vercel/Railway provide this)

**"Slow to start"**
- First run takes time (installs dependencies)
- Subsequent runs are fast

---

## 🚀 Next Steps

1. **Get it running locally** (30 seconds)
   - Run `./start.sh` or `start.bat`
   - Test at `http://localhost:3000`

2. **Deploy online** (10 minutes)
   - Recommended: Render (all-in-one)
   - Or: Vercel + Railway (separate)
   - See DEPLOYMENT.md for details

3. **Demo to lecturer** (5 minutes)
   - Follow DEMO_GUIDE.md for talking points
   - Have URLs and phone ready
   - Show both models working

---

**Questions?** Check README.md for complete documentation.

Good luck! 🐐🌿
