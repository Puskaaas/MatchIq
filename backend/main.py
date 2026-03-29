from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import matches, stats, odds

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


@app.get("/health")
async def health():
    return {"status": "ok"}
