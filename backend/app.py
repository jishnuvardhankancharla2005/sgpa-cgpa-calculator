import os
import socket
from urllib.parse import urlparse
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from models import db
from routes import api

load_dotenv()

app = Flask(__name__)

supabase_client = None
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
if supabase_url and supabase_key:
    try:
        from supabase import create_client
        supabase_client = create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"[INFO] Supabase client init info: {e}")

def check_db_connection(url):
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2.0)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

# Database URI configuration
pg_user = os.environ.get("POSTGRES_USER")
pg_pass = os.environ.get("POSTGRES_PASSWORD")
pg_host = os.environ.get("POSTGRES_HOST")
pg_db = os.environ.get("POSTGRES_DATABASE", "postgres")

if pg_user and pg_pass and pg_host:
    database_url = f"postgresql://{pg_user}:{pg_pass}@{pg_host}:5432/{pg_db}?sslmode=require"
else:
    database_url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("SUPABASE_DATABASE_URL")
        or os.environ.get("SUPABASE_POSTGRES_URL")
        or os.environ.get("POSTGRES_PRISMA_URL")
        or os.environ.get("STORAGE_URL")
    )
sqlite_path = os.path.join(os.path.dirname(__file__), "sgpa.db")
sqlite_uri = "sqlite:////tmp/sgpa.db" if os.environ.get("VERCEL") else f"sqlite:///{sqlite_path}"

if database_url:
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    if os.environ.get("VERCEL"):
        app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    elif check_db_connection(database_url):
        app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    else:
        print("[INFO] PostgreSQL target unreachable locally. Defaulting to local SQLite database...")
        app.config["SQLALCHEMY_DATABASE_URI"] = sqlite_uri
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = sqlite_uri

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "sgpa-secret-jwt-key-2026-super-secure-key-32bytes")
from datetime import timedelta
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30)

CORS(app)
db.init_app(app)
jwt = JWTManager(app)

app.register_blueprint(api, url_prefix="/api")

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
