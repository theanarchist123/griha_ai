<div align="center">

<br/>

<img src="https://img.shields.io/badge/griha-AI-gold?style=for-the-badge&labelColor=1a1a1a&color=C9922A" height="36" />

# griha**AI** — Find Your Home. Without the Headache.

**India's first AI-native property platform.**  
Searches listings, verifies legals, negotiates with brokers, and reviews contracts — so you just make the final call.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=flat-square&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Clerk](https://img.shields.io/badge/Clerk_Auth-6C47FF?style=flat-square&logo=clerk&logoColor=white)](https://clerk.com)
[![Vapi](https://img.shields.io/badge/Vapi_Voice-FF6B35?style=flat-square)](https://vapi.ai)

<br/>

</div>

---

## ✨ What is Griha AI?

Finding a home in India means fighting through **fake listings**, **opaque broker fees**, **dodgy legal documents**, and endless negotiation mind-games. Griha AI replaces the entire painful pipeline with a fleet of specialized AI agents that work 24/7 on your behalf.

> *"12,400+ properties verified · 8,200+ contracts reviewed · 94% of users found a home in under 3 weeks"*

---

## 🖼️ Screenshots

### 🏠 Landing Page

![Landing Page — Find Your Home Without The Headache](frontend/image/README/1776795271690.png)

---

### 📊 AI Dashboard — Smart Property Matches

Your personalized feed of AI-matched properties with match scores, live scraping, and pipeline tracking.

![Dashboard — AI Property Matches](frontend/image/README/1776795233728.png)

---

### 🏡 Property Detail — Deep AI Analysis

Every property gets a full AI breakdown: overview, location insights, investment signals, watch-outs, and negotiation tips.

![Property Detail — AI Overview](frontend/image/README/1776795307077.png)

---

### ⚖️ Side-by-Side Property Comparison

Compare up to 4 properties across 15+ data points with AI intelligence highlighted for the best value pick.

![Compare Properties](frontend/image/README/1776795363673.png)

---

### 🗺️ Neighbourhood Intelligence — Dark Map Explorer

Interactive map view with nearby parks, metro stations, hospitals, supermarkets, schools, and more — powered by OpenStreetMap.

![Neighbourhood Map](frontend/image/README/1776795854197.png)

---

### 🎙️ Voice Negotiation — AI Broker "Arjun" (Live Call)

Talk to Arjun, your AI property broker, in real time via voice call. He knows the market data, your budget, and your leverage — and negotiates accordingly.

![Voice Negotiation — Live Transcript](frontend/image/README/1776796576998.png)

![Voice Negotiation — Arjun Speaking](frontend/image/README/1776797704737.png)

---

### 🛡️ Legal Intelligence Report

AI-powered RERA verification, encumbrance status, property tax analysis, and builder track record — with a Clean / Caution / High Risk verdict.

![Legal Report — RERA & Encumbrance](frontend/image/README/1776824331541.png)

---

## 🤖 Agent Architecture

Griha AI runs a multi-agent backend where each agent owns a specialized domain:

| Agent | Role |
|-------|------|
| 🔍 **Scraper Agent** | Live property research via Gemini + DuckDuckGo + real estate sites |
| 🧠 **Matching Agent** | Scores every property against your preferences (0–100%) |
| ⚖️ **Legal Agent** | RERA check, encumbrance, tax status, builder track record |
| 📄 **Contract Agent** | OCR + clause-by-clause risk analysis of rental agreements |
| 🎙️ **Negotiation Agent** | Market research → opening offer → counter-offer state machine |
| 🗺️ **Neighbourhood Agent** | Locality reports: commute, amenities, AQI, sentiment, price trends |

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router) — TypeScript
- **Framer Motion** — micro-animations throughout
- **Lottie React** — animated AI soundwave visualization
- **Clerk** — auth (Google + email)
- **Vapi AI** — real-time voice call SDK
- **Leaflet + OpenStreetMap** — interactive neighbourhood maps

### Backend
- **FastAPI** — async Python API
- **Beanie + MongoDB Atlas** — ODM with reactive queries
- **Google Gemini** — Flash 2.0, Pro, and 1.5 Flash models
- **Twilio** — WhatsApp message delivery for broker contact
- **PyMuPDF + OCR.space** — PDF/image text extraction pipeline

---

## 🚀 Getting Started

### Prerequisites

```
Node.js 20+     (frontend)
Python 3.11+    (backend)
MongoDB Atlas   (connection string)
Gemini API key  (Google AI Studio)
Clerk account   (auth)
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # fill in your keys
uvicorn main:app --reload --port 8000
```

API runs at [http://localhost:8000](http://localhost:8000) · Docs at [/docs](http://localhost:8000/docs)

---

## 🔑 Environment Variables

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend (`.env`)

```env
MONGODB_URL=mongodb+srv://...
GEMINI_API_KEY=AIza...
CLERK_SECRET_KEY=sk_...
OCR_SPACE_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
```

---

## 📁 Project Structure

```
griha_ai/
├── frontend/               # Next.js 14 App Router
│   ├── src/app/
│   │   ├── page.tsx        # Landing page
│   │   ├── dashboard/      # Main property matches
│   │   ├── property/[id]/  # Property detail + AI analysis
│   │   ├── negotiate/[id]/ # Voice negotiation (Vapi)
│   │   ├── neighbourhood/  # Map + locality intelligence
│   │   ├── compare/        # Side-by-side comparison
│   │   ├── documents/      # Upload + AI clause analysis
│   │   ├── preferences/    # Search profile management
│   │   └── activity/       # Live activity feed
│   └── src/components/
│       └── shared/Navbar   # Sidebar + topbar
│
└── backend/                # FastAPI
    ├── main.py
    ├── api/routes/         # properties, negotiation, legal, documents, …
    ├── services/
    │   ├── scraper_agent.py
    │   ├── matching_agent.py
    │   ├── legal_agent.py
    │   ├── contract_agent.py
    │   ├── negotiation_agent.py
    │   └── neighbourhood_agent.py
    └── database/models/    # Beanie ODM documents
```

---

## 🗺️ Roadmap

- [ ] Saved / Shortlisted properties with pipeline persistence
- [ ] Schedule site visit from property detail
- [ ] Map-based property browsing
- [ ] Price drop alerts
- [ ] AI Chat Concierge (cross-property natural language Q&A)
- [ ] Mobile responsive layout
- [ ] Photo analysis agent (detect water damage, misleading photos)
- [ ] PDF report export (legal, neighbourhood, comparison)

---

## 📄 License

MIT — build freely, attribute kindly.

---

<div align="center">

Built with ♥ for Indian homebuyers who deserve better.

**griha AI** · *गृह* means *home* in Sanskrit

</div>
