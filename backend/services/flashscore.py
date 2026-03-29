import httpx
from cachetools import TTLCache
from config import (
    FLASHSCORE_API_KEY,
    FLASHSCORE_HOST,
    SERIE_A_TOURNAMENT_ID,
    SERIE_A_SEASON_ID,
    CACHE_TTL_FIXTURES,
    CACHE_TTL_ODDS,
)
from models.schemas import Match, Team, MatchOdds

BASE_URL = f"https://{FLASHSCORE_HOST}"

HEADERS = {
    "x-rapidapi-key": FLASHSCORE_API_KEY,
    "x-rapidapi-host": FLASHSCORE_HOST,
}

_fixtures_cache: TTLCache = TTLCache(maxsize=1, ttl=CACHE_TTL_FIXTURES)
_odds_cache: TTLCache = TTLCache(maxsize=128, ttl=CACHE_TTL_ODDS)


def _parse_match(raw: dict) -> Match:
    home = raw.get("homeTeam", {})
    away = raw.get("awayTeam", {})
    score = raw.get("homeScore", {})
    return Match(
        id=str(raw.get("id", "")),
        home_team=Team(
            id=str(home.get("id", "")),
            name=home.get("name", ""),
            short_name=home.get("shortName"),
        ),
        away_team=Team(
            id=str(away.get("id", "")),
            name=away.get("name", ""),
            short_name=away.get("shortName"),
        ),
        start_timestamp=raw.get("startTimestamp", 0),
        status=raw.get("status", {}).get("description", "unknown"),
        home_score=score.get("current") if score else None,
        away_score=raw.get("awayScore", {}).get("current") if raw.get("awayScore") else None,
        round=raw.get("roundInfo", {}).get("round"),
        venue=raw.get("venue", {}).get("name") if raw.get("venue") else None,
    )


async def get_serie_a_fixtures() -> list[Match]:
    cache_key = "fixtures"
    if cache_key in _fixtures_cache:
        return _fixtures_cache[cache_key]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/v1/events/schedule/league",
            headers=HEADERS,
            params={
                "tournamentId": SERIE_A_TOURNAMENT_ID,
                "seasonId": SERIE_A_SEASON_ID,
            },
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    events = data.get("events", [])
    matches = [_parse_match(e) for e in events]
    _fixtures_cache[cache_key] = matches
    return matches


async def get_match_details(match_id: str) -> Match:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/v1/event/{match_id}",
            headers=HEADERS,
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    return _parse_match(data.get("event", data))


async def get_match_odds(match_id: str) -> MatchOdds:
    if match_id in _odds_cache:
        return _odds_cache[match_id]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/v1/event/{match_id}/odds/1x2",
            headers=HEADERS,
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    markets = data.get("markets", [])
    odds = MatchOdds(match_id=match_id)

    for market in markets:
        choices = {c["name"]: c.get("fractionalValue") or c.get("odd") for c in market.get("choices", [])}
        market_name = market.get("marketName", "")

        if "1X2" in market_name or market_name == "Full time":
            odds.home_win = _to_decimal(choices.get("1") or choices.get("Home"))
            odds.draw = _to_decimal(choices.get("X") or choices.get("Draw"))
            odds.away_win = _to_decimal(choices.get("2") or choices.get("Away"))
            odds.bookmaker = market.get("sourceId", "")

        elif "Over/Under" in market_name and "2.5" in market_name:
            odds.over_2_5 = _to_decimal(choices.get("Over"))
            odds.under_2_5 = _to_decimal(choices.get("Under"))

        elif "Both Teams" in market_name or "BTTS" in market_name:
            odds.btts_yes = _to_decimal(choices.get("Yes"))
            odds.btts_no = _to_decimal(choices.get("No"))

    _odds_cache[match_id] = odds
    return odds


async def get_live_matches() -> list[Match]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/v1/events/live",
            headers=HEADERS,
            params={"sport": "football"},
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    events = data.get("events", [])
    serie_a_events = [
        e for e in events
        if str(e.get("tournament", {}).get("uniqueTournament", {}).get("id", "")) == SERIE_A_TOURNAMENT_ID
    ]
    return [_parse_match(e) for e in serie_a_events]


def _to_decimal(value) -> float | None:
    if value is None:
        return None
    try:
        if "/" in str(value):
            num, den = str(value).split("/")
            return round(int(num) / int(den) + 1, 2)
        return round(float(value), 2)
    except (ValueError, ZeroDivisionError):
        return None
