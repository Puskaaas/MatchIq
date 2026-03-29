from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import matches, stats, odds
import os

app = FastAPI(
    title="MatchIQ API",
    description="Serie A fixtures, odds, and advanced stats (xG, xA) powered by Flashscore and Understat.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(matches.router)
app.include_router(odds.router)
app.include_router(stats.router)


frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/css", StaticFiles(directory=os.path.join(frontend_path, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(frontend_path, "js")), name="js")
app.mount("/icons", StaticFiles(directory=os.path.join(frontend_path, "icons")), name="icons")


@app.get("/manifest.json")
async def serve_manifest():
    return FileResponse(os.path.join(frontend_path, "manifest.json"))


@app.get("/sw.js")
async def serve_sw():
    return FileResponse(os.path.join(frontend_path, "sw.js"), media_type="application/javascript")


@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(frontend_path, "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok"}
