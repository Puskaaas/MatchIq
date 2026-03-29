from dotenv import load_dotenv
import os

load_dotenv()

FLASHSCORE_API_KEY = os.getenv("FLASHSCORE_API_KEY", "1b501a52f7mshef87cd6a4e74158p1818aajsnf221a50373d5")
FLASHSCORE_HOST = os.getenv("FLASHSCORE_HOST", "flashscore4.p.rapidapi.com")

SERIE_A_TOURNAMENT_ID = "COuk57Ci"
SERIE_A_SEASON_ID = "187"

CACHE_TTL_FIXTURES = 3600    # 1 hour
CACHE_TTL_ODDS = 7200        # 2 hours
CACHE_TTL_STATS = 86400      # 24 hours
