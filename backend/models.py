from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(120), nullable=True)
    role = db.Column(db.String(20), default="student") # "student" or "admin"
    semesters = db.relationship("Semester", backref="user", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "name": self.name or self.username,
            "role": self.role
        }


class Semester(db.Model):
    __tablename__ = "semesters"
    id = db.Column(db.Integer, primary_key=True)
    sem_number = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    subjects = db.relationship("Subject", backref="semester", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "sem_number": self.sem_number, "user_id": self.user_id}


class Subject(db.Model):
    __tablename__ = "subjects"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    credits = db.Column(db.Float, nullable=False)
    grade = db.Column(db.String(2), nullable=False)
    is_audit = db.Column(db.Boolean, default=False)
    sem_id = db.Column(db.Integer, db.ForeignKey("semesters.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "credits": self.credits,
            "grade": self.grade, "is_audit": self.is_audit, "sem_id": self.sem_id
        }

