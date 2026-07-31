import os
from flask import Flask
from flask_cors import CORS
from models import db
from routes import api

app = Flask(__name__)

# Use /tmp for SQLite database if running on Vercel serverless environment
if os.environ.get("VERCEL"):
    db_path = "/tmp/sgpa.db"
else:
    db_path = os.path.join(os.path.dirname(__file__), "sgpa.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(app)
db.init_app(app)
app.register_blueprint(api, url_prefix="/api")

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
