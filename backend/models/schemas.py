from pydantic import BaseModel
from typing import Optional


class Team(BaseModel):
    id: str
    name: str
    short_name: Optional[str] = None
    logo_url: Optional[str] = None


class Match(BaseModel):
    id: str
    home_team: Team
    away_team: Team
    start_timestamp: int
    status: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    round: Optional[int] = None
    venue: Optional[str] = None


class MatchOdds(BaseModel):
    match_id: str
    home_win: Optional[float] = None
    draw: Optional[float] = None
    away_win: Optional[float] = None
    over_2_5: Optional[float] = None
    under_2_5: Optional[float] = None
    btts_yes: Optional[float] = None
    btts_no: Optional[float] = None
    bookmaker: Optional[str] = None


class TeamStats(BaseModel):
    team_name: str
    matches_played: int
    wins: int
    draws: int
    losses: int
    goals_scored: float
    goals_conceded: float
    xg: Optional[float] = None
    xga: Optional[float] = None
    clean_sheets: Optional[int] = None
    failed_to_score: Optional[int] = None


class PlayerStats(BaseModel):
    player_name: str
    team_name: str
    matches: int
    goals: int
    assists: int
    xg: Optional[float] = None
    xa: Optional[float] = None
    minutes: Optional[int] = None


class MatchStats(BaseModel):
    match_id: str
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    home_shots: Optional[int] = None
    away_shots: Optional[int] = None
    home_shots_on_target: Optional[int] = None
    away_shots_on_target: Optional[int] = None
    home_possession: Optional[float] = None
    away_possession: Optional[float] = None


class H2HMatch(BaseModel):
    match_id: str
    date: str
    home_team: str
    home_logo: Optional[str] = None
    away_team: str
    away_logo: Optional[str] = None
    home_score: int
    away_score: int
    result: str        # "H" home win, "D" draw, "A" away win
    tournament: str


class H2HSummary(BaseModel):
    home_wins: int
    draws: int
    away_wins: int
    home_goals_avg: float
    away_goals_avg: float


class Recommendation(BaseModel):
    type: str          # "safe" | "medium" | "risky"
    label: str         # "SICURA" | "MEDIA" | "RISCHIOSA"
    text: str
    odds_value: Optional[float] = None
    confidence: int    # 0-100


class ProbableResult(BaseModel):
    home_goals: int
    away_goals: int
    prob_home: int
    prob_draw: int
    prob_away: int


class AnalysisResult(BaseModel):
    match_id: str
    home_form: list[str]
    away_form: list[str]
    h2h: list[H2HMatch]
    h2h_summary: H2HSummary
    recommendations: list[Recommendation]
    probable_result: ProbableResult
    odds: MatchOdds
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    home_xga: Optional[float] = None
    away_xga: Optional[float] = None
