from flask import Blueprint, request, jsonify
from models import db, Semester, Subject
from sgpa import calculate_sgpa, calculate_cgpa, cgpa_to_percentage, get_class

api = Blueprint("api", __name__)

@api.route("/semesters", methods=["GET"])
def get_semesters():
    semesters = Semester.query.order_by(Semester.sem_number).all()
    result = []
    for sem in semesters:
        subjects = Subject.query.filter_by(sem_id=sem.id).all()
        sgpa = calculate_sgpa(subjects)
        result.append({
            "id": sem.id, "sem_number": sem.sem_number,
            "subjects": [s.to_dict() for s in subjects],
            "sgpa": sgpa
        })
    return jsonify(result)

@api.route("/semesters", methods=["POST"])
def add_semester():
    data = request.get_json()
    sem = Semester(sem_number=data["sem_number"])
    db.session.add(sem)
    db.session.flush()
    for s in data.get("subjects", []):
        sub = Subject(name=s["name"], credits=s["credits"], grade=s["grade"],
                      is_audit=s.get("is_audit", False), sem_id=sem.id)
        db.session.add(sub)
    db.session.commit()
    subjects = Subject.query.filter_by(sem_id=sem.id).all()
    return jsonify({**sem.to_dict(), "sgpa": calculate_sgpa(subjects), "subjects": [s.to_dict() for s in subjects]}), 201

@api.route("/semesters/<int:sem_id>", methods=["PUT"])
def update_semester(sem_id):
    sem = Semester.query.get_or_404(sem_id)
    data = request.get_json()
    Subject.query.filter_by(sem_id=sem.id).delete()
    for s in data.get("subjects", []):
        sub = Subject(name=s["name"], credits=s["credits"], grade=s["grade"],
                      is_audit=s.get("is_audit", False), sem_id=sem.id)
        db.session.add(sub)
    db.session.commit()
    subjects = Subject.query.filter_by(sem_id=sem.id).all()
    return jsonify({"sgpa": calculate_sgpa(subjects), "subjects": [s.to_dict() for s in subjects]})

@api.route("/semesters/<int:sem_id>", methods=["DELETE"])
def delete_semester(sem_id):
    sem = Semester.query.get_or_404(sem_id)
    db.session.delete(sem)
    db.session.commit()
    return jsonify({"message": "Deleted"})

@api.route("/semesters/batch", methods=["POST"])
def batch_semesters():
    data = request.get_json()
    should_replace = data.get("replace", True)
    if should_replace:
        Subject.query.delete()
        Semester.query.delete()
        db.session.commit()

    for entry in data.get("semesters", []):
        sem = Semester(sem_number=entry["sem_number"])
        db.session.add(sem)
        db.session.flush()
        for s in entry.get("subjects", []):
            sub = Subject(name=s["name"], credits=s["credits"], grade=s["grade"],
                          is_audit=s.get("is_audit", False), sem_id=sem.id)
            db.session.add(sub)
    db.session.commit()
    return jsonify({"message": "Semesters processed"}), 200


@api.route("/transcript", methods=["GET"])
def get_transcript():
    semesters = Semester.query.order_by(Semester.sem_number).all()
    sem_data = []
    for sem in semesters:
        subjects = Subject.query.filter_by(sem_id=sem.id).all()
        sgpa = calculate_sgpa(subjects)
        total_credits = sum(s.credits for s in subjects if not s.is_audit)
        sem_data.append({"sem_number": sem.sem_number, "sgpa": sgpa, "credits": total_credits})
    cgpa = calculate_cgpa([(s["credits"], s["sgpa"]) for s in sem_data])
    percentage = cgpa_to_percentage(cgpa)
    klass = get_class(cgpa)
    return jsonify({"semesters": sem_data, "cgpa": cgpa, "percentage": percentage, "class": klass})

@api.route("/data/export", methods=["GET"])
def export_data():
    semesters = Semester.query.order_by(Semester.sem_number).all()
    result = []
    for sem in semesters:
        subjects = Subject.query.filter_by(sem_id=sem.id).all()
        result.append({
            "sem_number": sem.sem_number,
            "subjects": [{"name": s.name, "credits": s.credits, "grade": s.grade, "is_audit": s.is_audit} for s in subjects]
        })
    return jsonify({"semesters": result})

@api.route("/data/import", methods=["POST"])
def import_data():
    data = request.get_json()
    Subject.query.delete()
    Semester.query.delete()
    db.session.commit()
    for entry in data.get("semesters", []):
        sem = Semester(sem_number=entry["sem_number"])
        db.session.add(sem)
        db.session.flush()
        for s in entry.get("subjects", []):
            sub = Subject(name=s["name"], credits=s["credits"], grade=s["grade"],
                          is_audit=s.get("is_audit", False), sem_id=sem.id)
            db.session.add(sub)
    db.session.commit()
    return jsonify({"message": "Data imported"}), 200
