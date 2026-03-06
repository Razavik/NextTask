from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from app.database.database import engine, Base
from app.api.v1 import auth, workspaces, tasks, profile, comments, invites, chat, me, task_time_tracks, task_planning

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 NextTask Server is starting...")
    yield
    print("🛑 NextTask Server is shutting down...")

app = FastAPI(
    title="NextTask API",
    description="API для системы управления задачами и рабочими пространствами",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
origins = os.getenv("ALLOWED_ORIGINS", "*")
allow_origins_list = ["*"] if origins == "*" else [o.strip() for o in origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статические файлы
if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Конфигурация роутеров
ROUTER_CONFIG = [
    (auth.router, ["/api/v1/auth", "/api/v1", "/auth", ""], ["auth"]),
    (workspaces.router, ["/api/v1/workspaces", "/workspaces"], ["workspaces"]),
    (tasks.router, ["/api/v1/tasks", "/tasks"], ["tasks"]),
    (tasks.workspace_router, ["/api/v1/workspaces", "/workspaces"], ["workspace-tasks"]),
    (profile.router, ["/api/v1/profile", "/profile"], ["profile"]),
    (comments.router, ["/api/v1/comments", "/comments"], ["comments"]),
    (comments.router, ["/api/v1/tasks", "/tasks"], ["task-comments"]),
    (invites.router, ["/api/v1/invites", "/invites"], ["invites"]),
    (chat.router, ["/api/v1/chat", "/chat"], ["chat"]),
    (chat.workspace_chat_router, ["/api/v1/workspace-chat", "/workspace-chat"], ["workspace-chat"]),
    (me.router, ["/api/v1/me", "/me"], ["me"]),
    (task_time_tracks.router, ["/api/v1/tasks", "/tasks"], ["time-tracking"]),
    (task_planning.router, ["/api/v1", ""], ["planning"]),
]

for router, prefixes, tags in ROUTER_CONFIG:
    for prefix in prefixes:
        app.include_router(router, prefix=prefix, tags=tags)

@app.get("/")
def root():
    return {
        "message": "Welcome to NextTask API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "NextTask API"}

@app.get("/debug/routes")
def debug_routes():
    return {
        "routes": [
            {"path": r.path, "methods": list(r.methods or []), "name": getattr(r, 'name', 'unknown')}
            for r in app.routes if hasattr(r, 'path') and hasattr(r, 'methods')
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
