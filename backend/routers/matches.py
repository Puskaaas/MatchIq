from fastapi import APIRouter, HTTPException
from services.flashscore import get_serie_a_fixtures, get_match_details, get_live_matches
from models.schemas import Match

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/", response_model=list[Match])
async def list_fixtures():
    """Return all upcoming Serie A fixtures."""
    try:
        return await get_serie_a_fixtures()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch fixtures: {e}")


@router.get("/live", response_model=list[Match])
async def list_live():
    """Return currently live Serie A matches."""
    try:
        return await get_live_matches()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch live matches: {e}")


@router.get("/{match_id}", response_model=Match)
async def match_detail(match_id: str):
    """Return details for a specific match."""
    try:
        return await get_match_details(match_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch match {match_id}: {e}")
