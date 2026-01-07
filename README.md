# GenUI Chatbot

A Generative UI chatbot for intelligent document analysis, built with **Crayon AI**, **FastAPI**, and **React**.

## ✨ Features

- 📊 **Document Upload & Analysis**: Import Excel files for comprehensive data analysis
- 🤖 **AI-Powered Insights**: Leverage Thesys C1 (GPT-5) for intelligent document understanding
- 📈 **Dynamic Visualizations**: Auto-generated charts (line, bar, pie), tables, KPI cards, and lists
- 💬 **Natural Language Interface**: Ask questions in plain English and get instant insights
- 📄 **Export Capabilities**: Download analysis reports as PDF or Word documents
- 🔄 **Real-time Communication**: WebSocket-based streaming for responsive interactions
- 🎨 **Generative UI**: Powered by Crayon AI's React UI components

## 🏗️ Architecture

```
┌──────────────────────┐     WebSocket      ┌──────────────────────┐
│   React Frontend     │◀─────────────────▶│  FastAPI Backend     │
│  (Crayon UI SDK)     │    (Real-time)     │  (Document Service)  │
└──────────────────────┘                    └──────────┬───────────┘
                                                       │
                                            ┌──────────▼───────────┐
                                            │    Thesys C1 API     │
                                            │  (OpenAI GPT-5)      │
                                            └──────────────────────┘
```

**Key Components:**
- **Frontend**: React + TypeScript with Crayon AI's Generative UI SDK
- **Backend**: FastAPI with WebSocket support for streaming responses
- **AI Engine**: Thesys C1 model (GPT-5) via OpenAI-compatible API
- **Document Processing**: Pandas, OpenPyXL for Excel analysis
- **Export Services**: ReportLab (PDF) and python-docx (Word)

## 📋 Prerequisites

- **Python 3.11+**
- **Node.js 22+**
- **Thesys API Key** - [Get one here](https://console.thesys.dev/keys)
- **OpenAI API Key** (for fallback LLM operations)

## 🚀 Quick Start

### Option 1: Using Start Scripts (Recommended)

**Windows:**
```bash
# Start backend
start-backend.bat

# In a new terminal, start frontend
start-frontend.bat
```

**macOS/Linux:**
```bash
# Start backend
./start-backend.sh

# In a new terminal, start frontend
./start-frontend.sh
```

### Option 2: Manual Setup

#### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# Windows (CMD):
venv\Scripts\activate.bat
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (see Configuration section below)

# Start the backend server
python main.py
```

Backend runs at `http://localhost:8000`

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file (optional, see Configuration section)

# Start development server
npm run dev
```

Frontend runs at `http://localhost:5173` (default Vite port)

## ⚙️ Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Required - Thesys API Configuration
THESYS_API_KEY=your_thesys_api_key_here
THESYS_MODEL=c1/openai/gpt-5/v-20251130

# Required - OpenAI Configuration (for fallback operations)
OPENAI_API_KEY=your_openai_api_key_here
LLM_MODEL=gpt-4o-mini

# Optional - Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=True

# Optional - CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

**Configuration Details:**
- `THESYS_API_KEY`: Your Thesys API key for accessing C1 models
- `THESYS_MODEL`: The Thesys C1 model to use (GPT-5)
- `OPENAI_API_KEY`: OpenAI API key for additional LLM operations
- `LLM_MODEL`: Fallback OpenAI model (e.g., gpt-4o-mini, gpt-4)
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Enable debug mode (default: True)
- `CORS_ORIGINS`: Comma-separated list of allowed CORS origins

### Frontend Environment Variables (Optional)

Create a `.env` file in the `frontend/` directory:

```env
VITE_WS_URL=ws://localhost:8000/ws
VITE_APP_TITLE=GenUI Chatbot
```

**Note:** If not specified, the frontend uses default values that work with local development.

## 🔌 API Reference

### WebSocket Communication

The application uses a single WebSocket endpoint for all real-time communication:

**Endpoint:** `ws://localhost:8000/ws`

#### Message Types

**1. Chat Message**
```json
{
  "type": "chat",
  "message": "Analyze the sales data by region"
}
```

**2. File Upload**
```json
{
  "type": "upload",
  "filename": "sales_data.xlsx",
  "content": "base64_encoded_file_content"
}
```

**3. Export PDF**
```json
{
  "type": "export_pdf"
}
```

**4. Export Word**
```json
{
  "type": "export_word"
}
```

#### Response Format

The server streams responses in real-time as JSON messages:

```json
{
  "type": "message",
  "content": "Generated UI components and analysis..."
}
```

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/ws` | WebSocket | Main WebSocket connection |

## 📚 Project Structure

```
GenUI_Chatbot/
├── backend/                    # FastAPI backend
│   ├── main.py                # Application entry point
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment configuration
│   └── app/
│       ├── config.py          # Settings and configuration
│       ├── api/
│       │   └── websocket.py   # WebSocket handler
│       ├── prompts/
│       │   └── system_prompt.py  # AI system prompts
│       └── services/
│           ├── document_service.py  # Excel/data processing
│           ├── pdf_service.py       # PDF export
│           └── word_service.py      # Word export
│
├── frontend/                   # React frontend
│   ├── package.json           # Node dependencies
│   ├── vite.config.ts         # Vite configuration
│   ├── tailwind.config.js     # Tailwind CSS config
│   └── src/
│       ├── App.tsx            # Main app component
│       ├── components/
│       │   ├── Chatbot.tsx    # Main chat interface
│       │   ├── FileUpload.jsx # File upload component
│       │   └── blocks/        # UI block components
│       │       ├── BarChartBlock.tsx
│       │       ├── LineChartBlock.tsx
│       │       ├── PieChartBlock.tsx
│       │       ├── DataTableBlock.tsx
│       │       ├── KPICard.tsx
│       │       ├── ListBlock.tsx
│       │       └── MarkdownBlock.tsx
│       ├── services/
│       │   ├── websocket.ts   # WebSocket client
│       │   └── responseParser.ts  # Parse AI responses
│       └── types/
│           └── index.ts       # TypeScript definitions
│
├── start-backend.bat          # Windows backend launcher
├── start-backend.sh           # Unix backend launcher
├── start-frontend.bat         # Windows frontend launcher
├── start-frontend.sh          # Unix frontend launcher
└── README.md                  # This file
```

## 🛠️ Technologies Used

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** - High-performance async web framework
- **[Thesys C1](https://thesys.dev/)** - Advanced AI model (GPT-5) for document analysis
- **[OpenAI API](https://openai.com/)** - Language model integration
- **[Pandas](https://pandas.pydata.org/)** - Data analysis and manipulation
- **[OpenPyXL](https://openpyxl.readthedocs.io/)** - Excel file processing
- **[ReportLab](https://www.reportlab.com/)** - PDF generation
- **[python-docx](https://python-docx.readthedocs.io/)** - Word document generation
- **[Uvicorn](https://www.uvicorn.org/)** - ASGI server
- **WebSockets** - Real-time bidirectional communication

### Frontend
- **[React](https://react.dev/)** 18.3+ - UI framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Crayon AI React UI](https://www.npmjs.com/package/@crayonai/react-ui)** - Generative UI components
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Recharts](https://recharts.org/)** - Chart library for data visualization
- **[React Markdown](https://github.com/remarkjs/react-markdown)** - Markdown rendering
- **[Lucide React](https://lucide.dev/)** - Beautiful icon library

## 💡 Usage

1. **Start the Application**: Use the start scripts or manual setup
2. **Upload a Document**: Click the upload button and select an Excel file
3. **Ask Questions**: Type natural language questions about your data
4. **View Insights**: Get AI-generated visualizations, tables, and KPI cards
5. **Export Results**: Download your analysis as PDF or Word document

### Example Queries

- "Show me the sales trends over the last 6 months"
- "What are the top 5 products by revenue?"
- "Create a pie chart of market share by region"
- "Calculate the total revenue and average order value"
- "Compare Q1 and Q2 performance"

## 🔧 Development

### Backend Development

```bash
cd backend

# Install dev dependencies
pip install black ruff

# Format code
black .

# Lint code
ruff check .

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

```bash
cd frontend

# Run dev server with auto-reload
npm run dev

# Type checking
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## 🐛 Troubleshooting

### Backend Issues

**Problem**: `ModuleNotFoundError` or import errors
- **Solution**: Ensure virtual environment is activated and dependencies are installed:
  ```bash
  pip install -r requirements.txt
  ```

**Problem**: API key errors
- **Solution**: Check that `.env` file exists in `backend/` with valid API keys

**Problem**: Port already in use
- **Solution**: Change the `PORT` in `.env` or stop the conflicting process

### Frontend Issues

**Problem**: Connection refused to WebSocket
- **Solution**: Ensure backend is running at `http://localhost:8000`

**Problem**: Dependencies installation fails
- **Solution**: Clear cache and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

**Problem**: TypeScript errors
- **Solution**: Run `npm run build` to see detailed type errors

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

---

**Built with ❤️ using Thesys C1 and Crayon AI**
