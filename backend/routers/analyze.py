import asyncio
from math import exp, factorial
from fastapi import APIRouter, HTTPException
from services.flashscore import (
    get_match_details_v2,
    get_match_h2h,
    get_team_form,
    get_match_odds,
)
from services.understat import get_serie_a_team_stats
from models.schemas import (
    AnalysisResult,
    Recommendation,
    ProbableResult,
    MatchOdds,
)

router = APIRouter(prefix="/analyze", tags=["analyze"])


# ── Poisson helpers ──────────────────────────────────────────────────────────

def _poisson(lam: float, k: int) -> float:
    lam = max(lam, 0.01)
    return (lam ** k * exp(-lam)) / factorial(k)


def _match_probs(home_xg: float, away_xg: float) -> tuple[int, int, int]:
    """Return (prob_home, prob_draw, prob_away) as rounded percentages."""
    ph = pd = pa = 0.0
    for i in range(9):
        for j in range(9):
            p = _poisson(home_xg, i) * _poisson(away_xg, j)
            if i > j:   ph += p
            elif i == j: pd += p
            else:        pa += p
    total = ph + pd + pa or 1
    return (round(ph / total * 100), round(pd / total * 100), round(pa / total * 100))


def _most_likely_score(home_xg: float, away_xg: float) -> tuple[int, int]:
    best_p, best = 0.0, (1, 0)
    for i in range(6):
        for j in range(6):
            p = _poisson(home_xg, i) * _poisson(away_xg, j)
            if p > best_p:
                best_p, best = p, (i, j)
    return best


# ── form helpers ─────────────────────────────────────────────────────────────

def _form_score(form: list[str]) -> float:
    """0-1 score: recent wins weighted more heavily."""
    weights = [1.0, 0.9, 0.8, 0.7, 0.6]
    pts = {"W": 1.0, "D": 0.4, "L": 0.0}
    total = sum(pts.get(r, 0) * weights[i] for i, r in enumerate(form[:5]))
    max_w = sum(weights[:len(form[:5])])
    return total / max_w if max_w else 0.5


# ── recommendation builder ───────────────────────────────────────────────────

def _build_recommendations(
    odds: MatchOdds,
    home_form: list[str],
    away_form: list[str],
    home_xg: float,
    away_xg: float,
    home_name: str,
    away_name: str,
    h2h_goals_avg: float,
) -> list[Recommendation]:
    recs: list[Recommendation] = []
    home_fs = _form_score(home_form)
    away_fs = _form_score(away_form)

    # ── SICURA (1.10 – 1.60) ──────────────────────────────────────────────
    sicura_candidate = None
    if odds.home_win and 1.10 <= odds.home_win <= 1.60:
        conf = min(92, int(55 + home_fs * 35 + (1.60 - odds.home_win) * 20))
        sicura_candidate = Recommendation(
            type="safe", label="SICURA",
            text=f"Vittoria {home_name}",
            odds_value=odds.home_win, confidence=conf,
        )
    elif odds.away_win and 1.10 <= odds.away_win <= 1.60:
        conf = min(92, int(55 + away_fs * 35 + (1.60 - odds.away_win) * 20))
        sicura_candidate = Recommendation(
            type="safe", label="SICURA",
            text=f"Vittoria {away_name}",
            odds_value=odds.away_win, confidence=conf,
        )
    elif odds.over_2_5 and odds.over_2_5 <= 1.60 and (home_xg + away_xg) >= 2.0:
        conf = min(88, int(58 + (home_xg + away_xg - 2.0) * 12))
        sicura_candidate = Recommendation(
            type="safe", label="SICURA",
            text="Over 1.5 Gol",
            odds_value=None, confidence=conf,
        )
    else:
        # Double chance as fallback when no strong favourite
        stronger = home_name if home_fs >= away_fs else away_name
        label = f"1X – {home_name} non perde" if home_fs >= away_fs else f"X2 – {away_name} non perde"
        conf = int(60 + abs(home_fs - away_fs) * 25)
        sicura_candidate = Recommendation(
            type="safe", label="SICURA",
            text=label, odds_value=None, confidence=min(85, conf),
        )
    recs.append(sicura_candidate)

    # ── MEDIA (1.61 – 2.50) ──────────────────────────────────────────────
    media_candidate = None
    combined_xg = home_xg + away_xg
    if odds.over_2_5 and 1.61 <= odds.over_2_5 <= 2.50 and combined_xg >= 2.3:
        conf = min(75, int(42 + combined_xg * 10))
        media_candidate = Recommendation(
            type="medium", label="MEDIA",
            text="Over 2.5 Gol",
            odds_value=odds.over_2_5, confidence=conf,
        )
    elif odds.btts_yes and 1.61 <= odds.btts_yes <= 2.50 and home_xg >= 1.0 and away_xg >= 0.8:
        conf = int(45 + home_xg * 8 + away_xg * 8)
        media_candidate = Recommendation(
            type="medium", label="MEDIA",
            text="GG – Entrambe segnano",
            odds_value=odds.btts_yes, confidence=min(72, conf),
        )
    elif odds.home_win and 1.61 <= odds.home_win <= 2.50:
        conf = min(68, int(38 + home_fs * 28))
        media_candidate = Recommendation(
            type="medium", label="MEDIA",
            text=f"Vittoria {home_name}",
            odds_value=odds.home_win, confidence=conf,
        )
    elif odds.away_win and 1.61 <= odds.away_win <= 2.50:
        conf = min(68, int(38 + away_fs * 28))
        media_candidate = Recommendation(
            type="medium", label="MEDIA",
            text=f"Vittoria {away_name}",
            odds_value=odds.away_win, confidence=conf,
        )
    else:
        media_candidate = Recommendation(
            type="medium", label="MEDIA",
            text="Under 2.5 Gol" if combined_xg < 2.0 else "1X2 – Risultato esatto",
            odds_value=odds.under_2_5 if combined_xg < 2.0 else None,
            confidence=52,
        )
    recs.append(media_candidate)

    # ── RISCHIOSA (3.50+) ──────────────────────────────────────────────
    risky_candidate = None
    score_h, score_a = _most_likely_score(home_xg, away_xg)
    if odds.draw and odds.draw >= 3.50:
        conf = int(20 + _poisson(home_xg, score_h) * _poisson(away_xg, score_h) * 60)
        risky_candidate = Recommendation(
            type="risky", label="RISCHIOSA",
            text=f"Pareggio @ {odds.draw}",
            odds_value=odds.draw, confidence=min(38, conf),
        )
    elif odds.away_win and odds.away_win >= 3.50:
        conf = min(38, int(12 + away_fs * 25))
        risky_candidate = Recommendation(
            type="risky", label="RISCHIOSA",
            text=f"Vittoria {away_name} @ {odds.away_win}",
            odds_value=odds.away_win, confidence=conf,
        )
    elif odds.home_win and odds.home_win >= 3.50:
        conf = min(38, int(12 + home_fs * 25))
        risky_candidate = Recommendation(
            type="risky", label="RISCHIOSA",
            text=f"Vittoria {home_name} @ {odds.home_win}",
            odds_value=odds.home_win, confidence=conf,
        )
    else:
        risky_candidate = Recommendation(
            type="risky", label="RISCHIOSA",
            text=f"Risultato esatto {score_h}-{score_a}",
            odds_value=None, confidence=22,
        )
    recs.append(risky_candidate)

    return recs


# ── xG from Understat ────────────────────────────────────────────────────────

def _match_team(stats_name: str, api_name: str) -> bool:
    s = stats_name.lower()
    a = api_name.lower()
    # Check if any word from api_name is in stats_name
    for word in a.split():
        if len(word) >= 4 and word in s:
            return True
    return s[:5] in a[:5]


async def _get_xg(home_name: str, away_name: str) -> tuple[float | None, float | None, float | None, float | None]:
    """Return (home_xg, away_xg, home_xga, away_xga) from Understat or None."""
    try:
        team_stats = await asyncio.wait_for(get_serie_a_team_stats(), timeout=20.0)
        home_s = next((t for t in team_stats if _match_team(t.team_name, home_name)), None)
        away_s = next((t for t in team_stats if _match_team(t.team_name, away_name)), None)
        return (
            home_s.xg if home_s else None,
            away_s.xg if away_s else None,
            home_s.xga if home_s else None,
            away_s.xga if away_s else None,
        )
    except Exception:
        return None, None, None, None


# ── main endpoint ─────────────────────────────────────────────────────────────

@router.get("/{match_id}", response_model=AnalysisResult)
async def analyze_match(match_id: str):
    try:
        # Step 1: match details for team IDs
        details = await get_match_details_v2(match_id)
        home_t = details.get("home_team", {}) or {}
        away_t = details.get("away_team", {}) or {}
        home_id = home_t.get("team_id", "")
        away_id = away_t.get("team_id", "")
        home_name = home_t.get("name", "Home")
        away_name = away_t.get("name", "Away")

        # Step 2: parallel fetch H2H, form, odds, xG
        (h2h_matches, h2h_summary), home_form, away_form, odds, xg = await asyncio.gather(
            get_match_h2h(match_id),
            get_team_form(home_id, count=10),
            get_team_form(away_id, count=10),
            get_match_odds(match_id),
            _get_xg(home_name, away_name),
        )

        home_xg_raw, away_xg_raw, home_xga_raw, away_xga_raw = xg

        # Step 3: derive expected goals
        # Use Understat xG if available; otherwise use H2H goal averages then form
        if home_xg_raw and away_xg_raw and away_xga_raw and home_xga_raw:
            # Adjusted: attacker xG vs defender xGA
            league_avg = 1.35
            home_xg = round((home_xg_raw / league_avg) * (away_xga_raw / league_avg) * league_avg, 2)
            away_xg = round((away_xg_raw / league_avg) * (home_xga_raw / league_avg) * league_avg, 2)
        elif h2h_summary.home_goals_avg > 0:
            home_xg = h2h_summary.home_goals_avg
            away_xg = h2h_summary.away_goals_avg
        else:
            home_xg = 1.4
            away_xg = 1.1

        # Step 4: probabilities and probable score
        ph, pd, pa = _match_probs(home_xg, away_xg)
        best_h, best_a = _most_likely_score(home_xg, away_xg)

        probable = ProbableResult(
            home_goals=best_h, away_goals=best_a,
            prob_home=ph, prob_draw=pd, prob_away=pa,
        )

        # Step 5: recommendations
        h2h_goals = h2h_summary.home_goals_avg + h2h_summary.away_goals_avg
        recs = _build_recommendations(
            odds, home_form[:5], away_form[:5],
            home_xg, away_xg, home_name, away_name, h2h_goals,
        )

        return AnalysisResult(
            match_id=match_id,
            home_form=home_form[:5],
            away_form=away_form[:5],
            h2h=h2h_matches,
            h2h_summary=h2h_summary,
            recommendations=recs,
            probable_result=probable,
            odds=odds,
            home_xg=home_xg_raw,
            away_xg=away_xg_raw,
            home_xga=home_xga_raw,
            away_xga=away_xga_raw,
        )

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Analysis failed for {match_id}: {e}")
