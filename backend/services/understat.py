import json
import re
from cachetools import TTLCache
from playwright.async_api import async_playwright
from config import CACHE_TTL_STATS
from models.schemas import TeamStats, PlayerStats, MatchStats

BASE_URL = "https://understat.com"

_team_stats_cache: TTLCache = TTLCache(maxsize=32, ttl=CACHE_TTL_STATS)
_player_stats_cache: TTLCache = TTLCache(maxsize=32, ttl=CACHE_TTL_STATS)
_match_stats_cache: TTLCache = TTLCache(maxsize=128, ttl=CACHE_TTL_STATS)


def _extract_json_var(html: str, var_name: str) -> list | dict:
    pattern = rf"var {var_name}\s*=\s*JSON\.parse\('(.+?)'\);"
    match = re.search(pattern, html)
    if not match:
        return []
    raw = match.group(1).encode("utf-8").decode("unicode_escape")
    return json.loads(raw)


async def _fetch_page(url: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        content = await page.content()
        await browser.close()
    return content


async def get_serie_a_team_stats(season: str = "2024") -> list[TeamStats]:
    cache_key = f"teams_{season}"
    if cache_key in _team_stats_cache:
        return _team_stats_cache[cache_key]

    html = await _fetch_page(f"{BASE_URL}/league/Serie_A/{season}")
    raw_teams = _extract_json_var(html, "teamsData")

    teams = []
    for team_id, data in raw_teams.items():
        history = data.get("history", [])
        if not history:
            continue

        wins = sum(1 for m in history if m.get("result") == "w")
        draws = sum(1 for m in history if m.get("result") == "d")
        losses = sum(1 for m in history if m.get("result") == "l")
        goals_scored = sum(m.get("scored", 0) for m in history)
        goals_conceded = sum(m.get("missed", 0) for m in history)
        xg = sum(float(m.get("xG", 0)) for m in history)
        xga = sum(float(m.get("xGA", 0)) for m in history)
        clean_sheets = sum(1 for m in history if m.get("missed", 1) == 0)
        failed_to_score = sum(1 for m in history if m.get("scored", 1) == 0)
        n = len(history)

        teams.append(TeamStats(
            team_name=data.get("title", ""),
            matches_played=n,
            wins=wins,
            draws=draws,
            losses=losses,
            goals_scored=round(goals_scored / n, 2) if n else 0,
            goals_conceded=round(goals_conceded / n, 2) if n else 0,
            xg=round(xg / n, 2) if n else None,
            xga=round(xga / n, 2) if n else None,
            clean_sheets=clean_sheets,
            failed_to_score=failed_to_score,
        ))

    teams.sort(key=lambda t: t.wins, reverse=True)
    _team_stats_cache[cache_key] = teams
    return teams


async def get_serie_a_player_stats(season: str = "2024") -> list[PlayerStats]:
    cache_key = f"players_{season}"
    if cache_key in _player_stats_cache:
        return _player_stats_cache[cache_key]

    html = await _fetch_page(f"{BASE_URL}/league/Serie_A/{season}")
    raw_players = _extract_json_var(html, "playersData")

    players = []
    for p in raw_players:
        players.append(PlayerStats(
            player_name=p.get("player_name", ""),
            team_name=p.get("team_title", ""),
            matches=int(p.get("games", 0)),
            goals=int(p.get("goals", 0)),
            assists=int(p.get("assists", 0)),
            xg=round(float(p.get("xG", 0)), 2),
            xa=round(float(p.get("xA", 0)), 2),
            minutes=int(p.get("time", 0)),
        ))

    players.sort(key=lambda x: x.xg or 0, reverse=True)
    _player_stats_cache[cache_key] = players
    return players


async def get_match_stats(understat_match_id: str) -> MatchStats:
    if understat_match_id in _match_stats_cache:
        return _match_stats_cache[understat_match_id]

    html = await _fetch_page(f"{BASE_URL}/match/{understat_match_id}")

    shot_data = _extract_json_var(html, "shotsData")
    home_shots = [s for s in shot_data if s.get("h_a") == "h"]
    away_shots = [s for s in shot_data if s.get("h_a") == "a"]

    match_info = _extract_json_var(html, "match_info") or {}

    stats = MatchStats(
        match_id=understat_match_id,
        home_xg=round(sum(float(s.get("xG", 0)) for s in home_shots), 2),
        away_xg=round(sum(float(s.get("xG", 0)) for s in away_shots), 2),
        home_shots=len(home_shots),
        away_shots=len(away_shots),
        home_shots_on_target=sum(1 for s in home_shots if s.get("result") in ("Goal", "SavedShot")),
        away_shots_on_target=sum(1 for s in away_shots if s.get("result") in ("Goal", "SavedShot")),
    )

    _match_stats_cache[understat_match_id] = stats
    return stats
