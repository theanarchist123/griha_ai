from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.connection import init_db
from config import settings
from api.routes import router as api_router

# We will initialize the global scheduler here later
# scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print("Starting up Griha AI Backend...")
    await init_db()
    
    # scheduler.start()
    
    yield
    
    # Shutdown actions
    print("Shutting down Griha AI Backend...")
    # scheduler.shutdown()

app = FastAPI(
    title="Griha AI API",
    description="Backend API for Griha AI property platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS framework for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint to prevent 404 when visiting the backend URL directly."""
    return {"message": "Griha AI Backend API is running. Visit /docs for the API documentation."}

@app.get("/health")
async def health_check():
    """Render and generic health check endpoint."""
    return {"status": "ok", "app_env": settings.app_env}

app.include_router(api_router)
