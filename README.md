# TaskFlow AI

> An AI-powered productivity platform — manage tasks, automate workflows, schedule meetings, analyse documents, generate content, and track team productivity — all in one dark-mode web app.

---

## 🚀 Features

| Module | Capabilities |
|---|---|
| **Auth** | Register / login with JWT |
| **Tasks** | CRUD, priorities, due dates, AI natural-language creation, AI subtask suggestions |
| **Workflows** | Event-driven automations (TASK_CREATED, TASK_COMPLETED, PRIORITY_CHANGED, TASK_OVERDUE) |
| **AI Assistant** | Gemini-powered chat with tool-calling (create tasks, query productivity data) |
| **Meetings** | Paste transcripts → Gemini summary + structured action items → convert to tasks |
| **Documents** | Upload PDF / DOCX / TXT → AI summary + key points extraction |
| **Content AI** | Generate emails, social posts, report snippets, team messages with Gemini |
| **Calendar** | Manual event booking, mock Google Calendar sync, Gemini smart-scheduling suggestions |
| **Analytics** | 30-day productivity dashboard: tasks completed, workflows triggered, AI usage, charts |
| **Team Space** | Create organisations, invite members, Kanban board for shared tasks |

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, Tailwind CSS, shadcn/ui, Lucide icons |
| **Backend** | Node.js 20, Express, Prisma ORM |
| **Database** | PostgreSQL (embedded locally via `@embedded-postgres`, managed on Render) |
| **GenAI** | Google Gemini API (`@google/generative-ai`) |
| **File parsing** | `multer`, `pdf-parse`, `mammoth` |
| **Scheduling** | `node-cron` |
| **Deployment** | Render (static frontend + Node web service + managed Postgres) |

---

## 📁 Project Structure

```
taskflow-ai/
├── client/                   # React + Vite frontend
│   └── src/
│       ├── pages/            # Dashboard, Workflows, Meetings, Documents,
│       │                     # ContentGenerator, Calendar, Analytics, Team
│       ├── components/       # Navigation (sidebar + mobile bar)
│       └── lib/api.js        # Axios instance
│
├── server/                   # Express backend
│   ├── prisma/               # Schema + migrations
│   └── src/
│       ├── controllers/      # tasks, workflows, meetings, documents,
│       │                     # content, calendar, analytics, organizations
│       ├── routes/           # One route file per controller
│       ├── services/
│       │   ├── genai.service.js      # All Gemini helpers
│       │   ├── analytics.service.js  # Metric tracking helpers
│       │   ├── scheduler.service.js  # Cron + event workflow runner
│       │   └── prisma.service.js     # Prisma client singleton
│       └── middleware/
│           └── auth.middleware.js    # JWT verification
│
└── render.yaml               # Render deployment blueprint
```

---

## ⚙️ Local Development

### Prerequisites
- Node.js ≥ 20
- `npm` ≥ 9

### 1 — Clone & install

```bash
git clone https://github.com/your-org/taskflow-ai.git
cd taskflow-ai
```

### 2 — Backend

```bash
cd server
cp .env.example .env          # fill in GEMINI_API_KEY and JWT_SECRET
npm install
node start-dev.js             # boots embedded Postgres, runs migrations, starts Express on :5000
```

### 3 — Frontend

```bash
cd client
npm install
npm run dev                   # Vite dev server on :5173
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🔑 Environment Variables

### `server/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (auto-set by embedded Postgres locally) |
| `JWT_SECRET` | Any random secret string |
| `GEMINI_API_KEY` | Your Google AI Studio key |
| `GENAI_API_KEY` | Alias for the above (either works) |
| `PORT` | Server port (default `5000`) |

---

## ☁️ Deploy to Render

1. Push the repo to GitHub.
2. In the [Render dashboard](https://render.com), click **New → Blueprint** and import `render.yaml`.
3. Set `GEMINI_API_KEY` and `GENAI_API_KEY` in the backend service's **Environment** tab.
4. Click **Deploy**. Render will:
   - Build and serve the React app as a static site with SPA rewrites.
   - Build the Node server, run `prisma migrate deploy`, and start it.
   - Provision a free managed Postgres database.
   - Mount a 1 GB persistent disk at `/app/uploads` for document uploads.

---

## 🤖 GenAI Feature Reference

| Function | Description |
|---|---|
| `parseTaskFromText` | Natural-language → structured task |
| `suggestSubtasks` | Task title/desc → 3-5 subtask suggestions |
| `generateDailySummary` | User data → daily productivity email |
| `parseWorkflowFromText` | Natural-language → workflow trigger + action |
| `executeChatWithTools` | Multi-turn chat with Gemini function-calling |
| `summarizeMeeting` | Transcript → summary + action items |
| `summarizeDocument` | Extracted text → summary + key points |
| `generateEmail` | Prompt → email subject + body |
| `generateContent` | Prompt + type → social post / message / report |
| `suggestTimeSlots` | Task + existing calendar → 2-3 open slot suggestions |

All functions have local **fallback** responses so the app works even without a valid Gemini key.

---

## 📱 Responsive Design

All pages are mobile-first Tailwind, tested at:
- **375 px** — full bottom nav, stacked layouts
- **768 px** — sidebar hidden, compact grids
- **1280 px** — full sidebar, multi-column layouts

---

## 📄 License

MIT
