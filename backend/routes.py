from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from models import db, User, Semester, Subject
from sgpa import calculate_sgpa, calculate_cgpa, cgpa_to_percentage, get_class

api = Blueprint("api", __name__)

def get_current_user_id():
    identity = get_jwt_identity()
    return int(identity) if identity is not None else None

def safe_int(val, default=1):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default

def safe_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

# ================= AUTHENTICATION ROUTES =================

@api.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()
    name = str(data.get("name", "")).strip() or username
    role = str(data.get("role", "student")).strip()

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 400

    user = User(username=username, name=name, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 201


@api.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid username or password"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 200


@api.route("/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_current_user_id()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"user": user.to_dict()}), 200


# ================= SEMESTER & TRANSCRIPT ROUTES =================

@api.route("/semesters", methods=["GET"])
@jwt_required(optional=True)
def get_semesters():
    user_id = get_current_user_id()
    semesters = Semester.query.filter_by(user_id=user_id).order_by(Semester.sem_number).all()
    result = []
    for sem in semesters:
        subjects = Subject.query.filter_by(sem_id=sem.id).all()
        sgpa = calculate_sgpa(subjects)
        result.append({
            "id": sem.id,
            "sem_number": sem.sem_number,
            "subjects": [s.to_dict() for s in subjects],
            "sgpa": sgpa
        })
    return jsonify(result)


@api.route("/semesters", methods=["POST"])
@jwt_required(optional=True)
def add_semester():
    user_id = get_current_user_id()
    data = request.get_json() or {}
    sem_number = safe_int(data.get("sem_number"), 1)

    # Check if user already has a semester with this sem_number (upsert)
    sem = Semester.query.filter_by(user_id=user_id, sem_number=sem_number).first()
    if not sem:
        sem = Semester(sem_number=sem_number, user_id=user_id)
        db.session.add(sem)
        db.session.flush()
    else:
        # Delete old subjects for this semester before updating
        Subject.query.filter_by(sem_id=sem.id).delete()

    for s in data.get("subjects", []):
        sub = Subject(
            name=str(s.get("name", "")).strip() or "Untitled Subject",
            credits=safe_float(s.get("credits"), 0.0),
            grade=str(s.get("grade", "S")).strip(),
            is_audit=bool(s.get("is_audit", False)),
            sem_id=sem.id
        )
        db.session.add(sub)

    db.session.commit()

    subjects = Subject.query.filter_by(sem_id=sem.id).all()
    return jsonify({
        **sem.to_dict(),
        "sgpa": calculate_sgpa(subjects),
        "subjects": [s.to_dict() for s in subjects]
    }), 201


@api.route("/semesters/<int:sem_id>", methods=["PUT"])
@jwt_required(optional=True)
def update_semester(sem_id):
    user_id = get_current_user_id()
    sem = Semester.query.filter_by(id=sem_id, user_id=user_id).first_or_404()
    data = request.get_json() or {}

    if "sem_number" in data:
        sem.sem_number = safe_int(data["sem_number"], sem.sem_number)

    Subject.query.filter_by(sem_id=sem.id).delete()
    for s in data.get("subjects", []):
        sub = Subject(
            name=str(s.get("name", "")).strip() or "Untitled Subject",
            credits=safe_float(s.get("credits"), 0.0),
            grade=str(s.get("grade", "S")).strip(),
            is_audit=bool(s.get("is_audit", False)),
            sem_id=sem.id
        )
        db.session.add(sub)

    db.session.commit()

    subjects = Subject.query.filter_by(sem_id=sem.id).all()
    return jsonify({"sgpa": calculate_sgpa(subjects), "subjects": [s.to_dict() for s in subjects]})


@api.route("/semesters/<int:sem_id>", methods=["DELETE"])
@jwt_required(optional=True)
def delete_semester(sem_id):
    user_id = get_current_user_id()
    sem = Semester.query.filter_by(id=sem_id, user_id=user_id).first_or_404()
    db.session.delete(sem)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@api.route("/semesters/batch", methods=["POST"])
@jwt_required(optional=True)
def batch_semesters():
    user_id = get_current_user_id()
    data = request.get_json() or {}
    should_replace = data.get("replace", True)

    if should_replace:
        user_sems = Semester.query.filter_by(user_id=user_id).all()
        for sem in user_sems:
            Subject.query.filter_by(sem_id=sem.id).delete()
            db.session.delete(sem)
        db.session.commit()

    for entry in data.get("semesters", []):
        sem_number = safe_int(entry.get("sem_number"), 1)
        sem = Semester(sem_number=sem_number, user_id=user_id)
        db.session.add(sem)
        db.session.flush()

        for s in entry.get("subjects", []):
            sub = Subject(
                name=str(s.get("name", "")).strip() or "Untitled Subject",
                credits=safe_float(s.get("credits"), 0.0),
                grade=str(s.get("grade", "S")).strip(),
                is_audit=bool(s.get("is_audit", False)),
                sem_id=sem.id
            )
            db.session.add(sub)

    db.session.commit()
    return jsonify({"message": "Semesters processed"}), 200


@api.route("/transcript", methods=["GET"])
@jwt_required(optional=True)
def get_transcript():
    user_id = get_current_user_id()
    requested_student_id = request.args.get("student_id")

    # Handle admin requesting a specific student's transcript
    if requested_student_id and user_id is not None:
        current_user = User.query.get(user_id)
        if current_user and current_user.role == "admin":
            user_id = safe_int(requested_student_id, user_id)

    student_user = User.query.get(user_id) if user_id is not None else None
    semesters = Semester.query.filter_by(user_id=user_id).order_by(Semester.sem_number).all()

    sem_data = []
    for sem in semesters:
        subjects = Subject.query.filter_by(sem_id=sem.id).all()
        sgpa = calculate_sgpa(subjects)
        total_credits = sum(s.credits for s in subjects if not s.is_audit)
        sem_data.append({"sem_number": sem.sem_number, "sgpa": sgpa, "credits": total_credits})

    cgpa = calculate_cgpa([(s["credits"], s["sgpa"]) for s in sem_data])
    percentage = cgpa_to_percentage(cgpa)
    klass = get_class(cgpa)

    response = {
        "semesters": sem_data,
        "cgpa": cgpa,
        "percentage": percentage,
        "class": klass
    }
    if student_user:
        response["student"] = student_user.to_dict()

    return jsonify(response)


@api.route("/data/export", methods=["GET"])
@jwt_required(optional=True)
def export_data():
    user_id = get_current_user_id()
    semesters = Semester.query.filter_by(user_id=user_id).order_by(Semester.sem_number).all()
    result = []
    for sem in semesters:
        subjects = Subject.query.filter_by(sem_id=sem.id).all()
        result.append({
            "sem_number": sem.sem_number,
            "subjects": [{"name": s.name, "credits": s.credits, "grade": s.grade, "is_audit": s.is_audit} for s in subjects]
        })
    return jsonify({"semesters": result})


@api.route("/data/import", methods=["POST"])
@jwt_required(optional=True)
def import_data():
    user_id = get_current_user_id()
    data = request.get_json() or {}

    user_sems = Semester.query.filter_by(user_id=user_id).all()
    for sem in user_sems:
        Subject.query.filter_by(sem_id=sem.id).delete()
        db.session.delete(sem)
    db.session.commit()

    for entry in data.get("semesters", []):
        sem_number = safe_int(entry.get("sem_number"), 1)
        sem = Semester(sem_number=sem_number, user_id=user_id)
        db.session.add(sem)
        db.session.flush()

        for s in entry.get("subjects", []):
            sub = Subject(
                name=str(s.get("name", "")).strip() or "Untitled Subject",
                credits=safe_float(s.get("credits"), 0.0),
                grade=str(s.get("grade", "S")).strip(),
                is_audit=bool(s.get("is_audit", False)),
                sem_id=sem.id
            )
            db.session.add(sub)

    db.session.commit()
    return jsonify({"message": "Data imported"}), 200


# ================= ADMIN ROUTES =================

@api.route("/admin/students", methods=["GET"])
@jwt_required()
def get_students():
    user_id = get_current_user_id()
    current_user = User.query.get(user_id)
    if not current_user or current_user.role != "admin":
        return jsonify({"message": "Admin authorization required"}), 403

    students = User.query.filter_by(role="student").all()
    return jsonify([s.to_dict() for s in students])


@api.route("/admin/bulk-upload", methods=["POST"])
@jwt_required()
def admin_bulk_upload():
    user_id = get_current_user_id()
    current_user = User.query.get(user_id)
    if not current_user or current_user.role != "admin":
        return jsonify({"message": "Admin authorization required"}), 403

    data = request.get_json() or {}
    entries = data.get("entries", [])

    for entry in entries:
        username = str(entry.get("username", "")).strip()
        if not username:
            continue

        name = str(entry.get("name", "")).strip() or username
        password = str(entry.get("password", "password123")).strip()

        user = User.query.filter_by(username=username).first()
        if not user:
            user = User(username=username, name=name, role="student")
            user.set_password(password)
            db.session.add(user)
            db.session.flush()

        sem_number = safe_int(entry.get("sem_number"), 1)
        sem = Semester(sem_number=sem_number, user_id=user.id)
        db.session.add(sem)
        db.session.flush()

        for s in entry.get("subjects", []):
            sub = Subject(
                name=str(s.get("name", "")).strip() or "Untitled Subject",
                credits=safe_float(s.get("credits"), 0.0),
                grade=str(s.get("grade", "S")).strip(),
                is_audit=bool(s.get("is_audit", False)),
                sem_id=sem.id
            )
            db.session.add(sub)

    db.session.commit()
    return jsonify({"message": "Bulk upload completed successfully"}), 201
