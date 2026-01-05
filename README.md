# AI Assistant

A Generative UI chatbot for document analysis, built with **Thesys C1**, **LangGraph**, **FastAPI**, and **React**.

## Features

- 📊 **Upload Documents**: Import Excel files for analysis
- 🤖 **AI-Powered Analysis**: Get intelligent insights using LangGraph agents
- 📈 **Interactive Visualizations**: Charts, tables, and cards generated dynamically
- 💬 **Natural Language Interface**: Ask questions in plain English
- 📄 **PDF Export**: Download analysis reports as PDF

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React Frontend │────▶│  FastAPI Backend │────▶│   Thesys C1 API  │
│   (Thesys SDK)   │◀────│   (LangGraph)    │◀────│                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

## Prerequisites

- Python 3.11+
- Node.js 22+
- Thesys API Key ([Get one here](https://console.thesys.dev/keys))

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables in .env file
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

### 3. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```
Backend runs at `http://localhost:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs at `http://localhost:3000`

## Configuration

### Backend (.env)

```env
THESYS_API_KEY=your_thesys_api_key_here
THESYS_MODEL=c1/openai/gpt-5/v-20251130
HOST=0.0.0.0
PORT=8000
DEBUG=True
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_TITLE=AI Assistant
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session/create` | POST | Create new session |
| `/api/upload` | POST | Upload file |
| `/api/chat` | POST | Send chat message (streaming) |
| `/api/session/{id}/stats` | GET | Get session statistics |
| `/api/export-pdf` | POST | Export analysis as PDF |
| `/api/health` | GET | Health check |

## Technologies Used

### Backend
- **FastAPI**: High-performance Python web framework
- **LangGraph**: Agent orchestration framework
- **LangChain**: LLM integration and document loaders
- **Thesys C1**: Generative UI and AI provider
- **ReportLab**: PDF generation

### Frontend
- **React**: UI framework
- **Thesys GenUI SDK**: Generative UI rendering
- **Vite**: Build tool
- **Tailwind CSS**: Styling

## License

MIT License
