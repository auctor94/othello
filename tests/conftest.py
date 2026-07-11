import os

# API tests use in-memory storage; block .env DATABASE_URL (load_dotenv won't override).
os.environ["DATABASE_URL"] = ""
