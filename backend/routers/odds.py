from fastapi import APIRouter, HTTPException
from services.flashscore import get_match_odds
from models.schemas import MatchOdds

router = APIRouter(prefix="/odds", tags=["odds"])


@router.get("/{match_id}", response_model=MatchOdds)
async def match_odds(match_id: str):
    """Return 1X2, Over/Under 2.5, and BTTS odds for a match."""
    try:
        return await get_match_odds(match_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch odds for {match_id}: {e}")
