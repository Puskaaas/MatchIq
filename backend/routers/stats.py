from fastapi import APIRouter, HTTPException, Query
from services.understat import get_serie_a_team_stats, get_serie_a_player_stats, get_match_stats
from models.schemas import TeamStats, PlayerStats, MatchStats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/teams", response_model=list[TeamStats])
async def team_stats(season: str = Query(default="2024", description="Season year, e.g. 2024")):
    """Return per-match averaged team stats for Serie A from Understat."""
    try:
        return await get_serie_a_team_stats(season)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch team stats: {e}")


@router.get("/players", response_model=list[PlayerStats])
async def player_stats(season: str = Query(default="2024", description="Season year, e.g. 2024")):
    """Return player stats (goals, assists, xG, xA) for Serie A from Understat."""
    try:
        return await get_serie_a_player_stats(season)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch player stats: {e}")


@router.get("/match/{understat_match_id}", response_model=MatchStats)
async def match_stats(understat_match_id: str):
    """Return xG and shot stats for a specific match from Understat."""
    try:
        return await get_match_stats(understat_match_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch match stats: {e}")
