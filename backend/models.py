from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Semester(db.Model):
    __tablename__ = "semesters"
    id = db.Column(db.Integer, primary_key=True)
    sem_number = db.Column(db.Integer, nullable=False)
    subjects = db.relationship("Subject", backref="semester", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "sem_number": self.sem_number}


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
