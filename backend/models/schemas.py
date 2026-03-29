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
