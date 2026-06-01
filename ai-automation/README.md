# AI Job Distribution Agent

An AI-powered headless browser automation server that uses **Playwright** and **LLMs (Groq/Claude)** to automatically post jobs on third-party platforms.

## How It Works

1. Your React app triggers a job distribution
2. The Supabase Edge Function sends a request to this server
3. This server launches a headless Chromium browser
4. The AI agent navigates the target website, fills out the job posting form, and submits it
5. The AI verifies the posting was successful via screenshot analysis
6. Results are logged back to Supabase

## Local Development

```bash
cd ai-automation
python -m venv venv
source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
playwright install chromium

# Copy and fill in your .env
cp .env.example .env

# Run the server
python main.py
```

The server starts at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

## Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your repo and set the root directory to `ai-automation`
4. Set **Docker** as the environment
5. Add your environment variables from `.env.example`
6. Deploy!

## API

### `POST /post-job`

```json
{
  "platform": "linkedin",
  "posting_id": 42,
  "credentials": {
    "username": "your@email.com",
    "password": "your_password"
  }
}
```

**Headers:**
- `x-api-key`: Your `AUTOMATION_API_KEY`

### `GET /health`
Returns `{"status": "ok"}` for health checks.
