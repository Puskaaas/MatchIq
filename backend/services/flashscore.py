import httpx
from datetime import datetime
from cachetools import TTLCache
from config import (
    FLASHSCORE_API_KEY,
    FLASHSCORE_HOST,
    SERIE_A_TOURNAMENT_ID,
    SERIE_A_SEASON_ID,
    CACHE_TTL_FIXTURES,
    CACHE_TTL_ODDS,
)
from models.schemas import Match, Team, MatchOdds, H2HMatch, H2HSummary

BASE_URL = f"https://{FLASHSCORE_HOST}"

HEADERS = {
    "x-rapidapi-key": FLASHSCORE_API_KEY,
    "x-rapidapi-host": FLASHSCORE_HOST,
    "Content-Type": "application/json",
}

_fixtures_cache: TTLCache = TTLCache(maxsize=1, ttl=CACHE_TTL_FIXTURES)
_odds_cache:     TTLCache = TTLCache(maxsize=128, ttl=CACHE_TTL_ODDS)
_details_cache:  TTLCache = TTLCache(maxsize=256, ttl=3600)
_h2h_cache:      TTLCache = TTLCache(maxsize=128, ttl=3600)
_form_cache:     TTLCache = TTLCache(maxsize=128, ttl=3600)


# ── helpers ──────────────────────────────────────────────────────────────────

def _ts_to_date(ts: int) -> str:
    try:
        return datetime.utcfromtimestamp(ts).strftime("%m/%Y")
    except Exception:
        return ""


def _parse_fixture(raw: dict) -> Match:
    """Parse v2 fixture list item."""
    home = raw.get("home_team") or {}
    away = raw.get("away_team") or {}
    return Match(
        id=str(raw.get("match_id") or raw.get("id", "")),
        home_team=Team(
            id=str(home.get("team_id") or home.get("id", "")),
            name=home.get("name", ""),
            short_name=home.get("short_name"),
            logo_url=home.get("small_image_path"),
        ),
        away_team=Team(
            id=str(away.get("team_id") or away.get("id", "")),
            name=away.get("name", ""),
            short_name=away.get("short_name"),
            logo_url=away.get("small_image_path"),
        ),
        start_timestamp=raw.get("timestamp") or 0,
        status=str(raw.get("status") or "Not started"),
        home_score=raw.get("scores", {}).get("home") if raw.get("scores") else None,
        away_score=raw.get("scores", {}).get("away") if raw.get("scores") else None,
        round=raw.get("round"),
        venue=None,
    )


# ── fixtures ─────────────────────────────────────────────────────────────────

async def get_serie_a_fixtures() -> list[Match]:
    cache_key = "fixtures"
    if cache_key in _fixtures_cache:
        return _fixtures_cache[cache_key]

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE_URL}/api/flashscore/v2/tournaments/fixtures",
            headers=HEADERS,
            params={"tournament_template_id": SERIE_A_TOURNAMENT_ID, "season_id": SERIE_A_SEASON_ID},
            timeout=15.0,
        )
        r.raise_for_status()
        data = r.json()

    events = data if isinstance(data, list) else data.get("data", data).get("events", [])
    matches = [_parse_fixture(e) for e in events]
    _fixtures_cache[cache_key] = matches
    return matches


# ── match details (v2) ────────────────────────────────────────────────────────

async def get_match_details_v2(match_id: str) -> dict:
    """Return raw v2 details dict (includes event_participant_id, team_id)."""
    if match_id in _details_cache:
        return _details_cache[match_id]

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE_URL}/api/flashscore/v2/matches/details",
            headers=HEADERS,
            params={"match_id": match_id},
            timeout=15.0,
        )
        r.raise_for_status()
        data = r.json()

    _details_cache[match_id] = data
    return data


async def get_match_details(match_id: str) -> Match:
    """Return Match schema from v2 details endpoint."""
    data = await get_match_details_v2(match_id)
    home = data.get("home_team", {})
    away = data.get("away_team", {})
    scores = data.get("scores", {}) or {}
    status_obj = data.get("match_status", {}) or {}
    status = status_obj.get("stage") or ("Live" if status_obj.get("is_in_progress") else "Not started")
    return Match(
        id=str(data.get("match_id", match_id)),
        home_team=Team(
            id=str(home.get("team_id", "")),
            name=home.get("name", ""),
            short_name=home.get("short_name"),
            logo_url=home.get("image_path"),
        ),
        away_team=Team(
            id=str(away.get("team_id", "")),
            name=away.get("name", ""),
            short_name=away.get("short_name"),
            logo_url=away.get("image_path"),
        ),
        start_timestamp=data.get("timestamp", 0),
        status=str(status),
        home_score=scores.get("home"),
        away_score=scores.get("away"),
        round=None,
        venue=None,
    )


# ── H2H ──────────────────────────────────────────────────────────────────────

async def get_match_h2h(match_id: str) -> tuple[list[H2HMatch], H2HSummary]:
    if match_id in _h2h_cache:
        return _h2h_cache[match_id]

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE_URL}/api/flashscore/v2/matches/h2h",
            headers=HEADERS,
            params={"match_id": match_id},
            timeout=15.0,
        )
        r.raise_for_status()
        data = r.json()

    raw_list = data if isinstance(data, list) else []
    meetings: list[H2HMatch] = []
    for m in raw_list:
        scores = m.get("scores") or {}
        h_score = scores.get("home")
        a_score = scores.get("away")
        if h_score is None or a_score is None:
            continue
        h_score, a_score = int(h_score), int(a_score)
        # status: "W"=home win, "D"=draw, "L"=home loss (same as away win)
        raw_status = m.get("status", "")
        if raw_status == "W":
            result = "H"
        elif raw_status == "D":
            result = "D"
        else:
            result = "A"

        home_t = m.get("home_team", {})
        away_t = m.get("away_team", {})
        meetings.append(H2HMatch(
            match_id=m.get("match_id", ""),
            date=_ts_to_date(m.get("timestamp", 0)),
            home_team=home_t.get("name", ""),
            home_logo=home_t.get("image_path"),
            away_team=away_t.get("name", ""),
            away_logo=away_t.get("image_path"),
            home_score=h_score,
            away_score=a_score,
            result=result,
            tournament=m.get("tournament_name", ""),
        ))

    home_wins = sum(1 for m in meetings if m.result == "H")
    draws     = sum(1 for m in meetings if m.result == "D")
    away_wins = sum(1 for m in meetings if m.result == "A")
    n = len(meetings) or 1
    home_goals_avg = round(sum(m.home_score for m in meetings) / n, 2)
    away_goals_avg = round(sum(m.away_score for m in meetings) / n, 2)

    summary = H2HSummary(
        home_wins=home_wins, draws=draws, away_wins=away_wins,
        home_goals_avg=home_goals_avg, away_goals_avg=away_goals_avg,
    )
    result_tuple = (meetings, summary)
    _h2h_cache[match_id] = result_tuple
    return result_tuple


# ── team form ─────────────────────────────────────────────────────────────────

async def get_team_form(team_id: str, count: int = 10) -> list[str]:
    """Return last `count` results as W/D/L strings for the given team."""
    cache_key = f"form_{team_id}_{count}"
    if cache_key in _form_cache:
        return _form_cache[cache_key]

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE_URL}/api/flashscore/v2/teams/results",
            headers=HEADERS,
            params={"team_id": team_id, "count": count},
            timeout=15.0,
        )
        r.raise_for_status()
        data = r.json()

    # Response: list of tournament groups each with "matches" list
    raw_groups = data if isinstance(data, list) else []
    all_matches = []
    for group in raw_groups:
        all_matches.extend(group.get("matches", []))

    # Sort descending by timestamp, keep completed only
    all_matches.sort(key=lambda m: m.get("timestamp", 0), reverse=True)

    form: list[str] = []
    for m in all_matches:
        if len(form) >= count:
            break
        scores = m.get("scores") or {}
        h = scores.get("home")
        a = scores.get("away")
        if h is None or a is None:
            continue
        h, a = int(h), int(a)
        ht_id = (m.get("home_team") or {}).get("team_id", "")
        if ht_id == team_id:
            form.append("W" if h > a else "D" if h == a else "L")
        else:
            form.append("W" if a > h else "D" if a == h else "L")

    _form_cache[cache_key] = form
    return form


# ── odds ─────────────────────────────────────────────────────────────────────

async def get_match_odds(match_id: str) -> MatchOdds:
    """Return best odds across all bookmakers for key markets."""
    if match_id in _odds_cache:
        return _odds_cache[match_id]

    # Need event_participant_ids to identify home/away in 1X2
    try:
        details = await get_match_details_v2(match_id)
        home_pid = (details.get("home_team") or {}).get("event_participant_id")
        away_pid = (details.get("away_team") or {}).get("event_participant_id")
    except Exception:
        home_pid = away_pid = None

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE_URL}/api/flashscore/v2/matches/odds",
            headers=HEADERS,
            params={"match_id": match_id},
            timeout=15.0,
        )
        r.raise_for_status()
        bookmakers = r.json()

    odds = MatchOdds(match_id=match_id)
    best_book = None

    for bk in (bookmakers if isinstance(bookmakers, list) else []):
        for market in bk.get("odds", []):
            bt = market.get("bettingType", "")
            bs = market.get("bettingScope", "")
            if bs != "FULL_TIME":
                continue
            items = market.get("odds", [])

            if bt == "HOME_DRAW_AWAY":
                for item in items:
                    val = _safe_float(item.get("value"))
                    if val is None:
                        continue
                    pid = item.get("eventParticipantId")
                    if pid == home_pid:
                        if odds.home_win is None or val > odds.home_win:
                            odds.home_win = val
                            best_book = bk.get("name")
                    elif pid == away_pid:
                        if odds.away_win is None or val > odds.away_win:
                            odds.away_win = val
                    elif pid is None:
                        if odds.draw is None or val > odds.draw:
                            odds.draw = val

            elif bt == "OVER_UNDER":
                for item in items:
                    hand = (item.get("handicap") or {}).get("value")
                    if hand != "2.5":
                        continue
                    val = _safe_float(item.get("value"))
                    sel = item.get("selection", "")
                    if sel == "OVER" and (odds.over_2_5 is None or val > odds.over_2_5):
                        odds.over_2_5 = val
                    elif sel == "UNDER" and (odds.under_2_5 is None or val > odds.under_2_5):
                        odds.under_2_5 = val

            elif bt == "BOTH_TEAMS_TO_SCORE":
                for item in items:
                    val = _safe_float(item.get("value"))
                    btts = item.get("bothTeamsToScore")
                    if btts is True and (odds.btts_yes is None or val > odds.btts_yes):
                        odds.btts_yes = val
                    elif btts is False and (odds.btts_no is None or val > odds.btts_no):
                        odds.btts_no = val

    odds.bookmaker = best_book
    _odds_cache[match_id] = odds
    return odds


# ── live ─────────────────────────────────────────────────────────────────────

async def get_live_matches() -> list[Match]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE_URL}/api/flashscore/v2/tournaments/fixtures",
            headers=HEADERS,
            params={"tournament_template_id": SERIE_A_TOURNAMENT_ID, "season_id": SERIE_A_SEASON_ID},
            timeout=15.0,
        )
        r.raise_for_status()
        data = r.json()

    events = data if isinstance(data, list) else []
    live = [_parse_fixture(e) for e in events if str(e.get("status", "")).upper() in ("LIVE", "IN PROGRESS", "1ST", "2ND", "HT")]
    return live


# ── utils ─────────────────────────────────────────────────────────────────────

def _safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (ValueError, TypeError):
        return None
