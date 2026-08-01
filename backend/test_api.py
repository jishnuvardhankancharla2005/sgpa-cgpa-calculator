import json
import uuid
from app import app, db

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
client = app.test_client()

def test():
    db.drop_all()
    db.create_all()
    # Register student with unique username
    uname = f"stu_{uuid.uuid4().hex[:6]}"
    resp = client.post("/api/auth/register", json={"username": uname, "password": "pass", "name": "Test Student", "role": "student"})
    assert resp.status_code == 201
    data = resp.get_json()
    token = data["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"Registered: {data['user']['name']}")

    # Semester 1
    body = {"sem_number": 1, "subjects": [
        {"name": "Maths", "credits": 4, "grade": "S"},
        {"name": "Physics", "credits": 4, "grade": "A"},
        {"name": "Chemistry", "credits": 3, "grade": "B"},
        {"name": "English", "credits": 2, "grade": "A"},
        {"name": "Workshop", "credits": 1, "grade": "S"}
    ]}
    resp = client.post("/api/semesters", json=body, headers=headers)
    assert resp.status_code == 201
    print(f"Sem1 created")

    # Semester 2
    body = {"sem_number": 2, "subjects": [
        {"name": "Data Structures", "credits": 4, "grade": "A"},
        {"name": "Discrete Math", "credits": 3, "grade": "B"},
        {"name": "Digital Logic", "credits": 3, "grade": "A"},
        {"name": "Communication", "credits": 2, "grade": "C"},
        {"name": "Lab", "credits": 1.5, "grade": "S"}
    ]}
    resp = client.post("/api/semesters", json=body, headers=headers)
    assert resp.status_code == 201
    print(f"Sem2 created")

    # Transcript
    resp = client.get("/api/transcript", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    print(f"\n=== TRANSCRIPT ===")
    print(f"Student: {data['student']['name']}")
    for s in data["semesters"]:
        print(f"  Sem {s['sem_number']}: Credits={s['credits']}, SGPA={s['sgpa']}")
    print(f"CGPA: {data['cgpa']}")
    print(f"Class: {data['class']}")
    print(f"Percentage: {data['percentage']}%")

    # Verify SGPA manually: Sem1
    # Maths(S)=4*10, Physics(A)=4*9, Chemistry(B)=3*8, English(A)=2*9, Workshop(S)=1*10
    # Total credits = 14, Total points = 40+36+24+18+10 = 128
    # SGPA = 128/14 = 9.14
    sgpa1 = data["semesters"][0]["sgpa"]
    expected1 = round(128 / 14, 2)
    assert sgpa1 == expected1, f"Sem1 SGPA mismatch: {sgpa1} != {expected1}"
    print(f"Sem1 SGPA verified: {sgpa1} (expected {expected1})")

    # Sem2: DS(A)=4*9=36, DM(B)=3*8=24, DL(A)=3*9=27, Comm(C)=2*7=14, Lab(S)=1.5*10=15
    # Total credits = 13.5, Total points = 116
    # SGPA = 116/13.5 = 8.59
    sgpa2 = data["semesters"][1]["sgpa"]
    expected2 = round(116 / 13.5, 2)
    assert sgpa2 == expected2, f"Sem2 SGPA mismatch: {sgpa2} != {expected2}"
    print(f"Sem2 SGPA verified: {sgpa2} (expected {expected2})")

    # CGPA = (14*9.14 + 13.5*8.59) / (14 + 13.5) = (127.96 + 115.97) / 27.5 = 243.93/27.5 = 8.87
    cgpa = data["cgpa"]
    expected_cgpa = round((14 * expected1 + 13.5 * expected2) / 27.5, 2)
    assert cgpa == expected_cgpa, f"CGPA mismatch: {cgpa} != {expected_cgpa}"
    print(f"CGPA verified: {cgpa} (expected {expected_cgpa})")

    # Class: >= 7.5 -> First Class with Distinction
    assert data["class"] == "First Class with Distinction"
    print(f"Class verified: {data['class']}")

    # Percentage: (CGPA - 0.5) * 10
    expected_pct = round((cgpa - 0.5) * 10, 2)
    assert data["percentage"] == expected_pct
    print(f"Percentage verified: {data['percentage']}% (expected {expected_pct}%)")

    # Test with F/Ab grades (zero grade points)
    print("\n--- Testing F/Ab grades ---")
    body = {"sem_number": 3, "subjects": [
        {"name": "Tough Subject", "credits": 4, "grade": "F"},
        {"name": "Missed Exam", "credits": 3, "grade": "Ab"},
        {"name": "Easy Subject", "credits": 2, "grade": "S"}
    ]}
    resp = client.post("/api/semesters", json=body, headers=headers)
    assert resp.status_code == 201

    # Credits: 4+3+2=9, Points: 4*0 + 3*0 + 2*10 = 20, SGPA = 20/9 = 2.22
    resp = client.get("/api/transcript", headers=headers)
    data = resp.get_json()
    sgpa3 = data["semesters"][2]["sgpa"]
    assert sgpa3 == round(20 / 9, 2), f"SGPA with F/Ab wrong: {sgpa3}"
    print(f"Sem3 SGPA (with F/Ab): {sgpa3} (expected {round(20/9, 2)}) - verified")

    # Audit course should be excluded
    print("\n--- Testing audit courses ---")
    body = {"sem_number": 4, "subjects": [
        {"name": "Yoga", "credits": 2, "grade": "S", "is_audit": True},
        {"name": "Regular Subject", "credits": 4, "grade": "A"}
    ]}
    resp = client.post("/api/semesters", json=body, headers=headers)
    assert resp.status_code == 201
    resp = client.get("/api/transcript", headers=headers)
    data = resp.get_json()
    sem4 = data["semesters"][3]
    assert sem4["credits"] == 4  # Audit excluded
    assert sem4["sgpa"] == 9.0  # Only A grade counts
    print(f"Sem4 SGPA (audit excluded): {sem4['sgpa']} - verified")

    # Test class boundaries
    print("\n--- Testing class boundaries ---")

    # Create a student with CGPA >= 7.5 -> First Class with Distinction
    # Already verified above (CGPA 8.87)

    # Register a new student with lower marks
    u_stu2 = f"stu2_{uuid.uuid4().hex[:6]}"
    resp = client.post("/api/auth/register", json={"username": u_stu2, "password": "pass", "name": "Low Scorer", "role": "student"})
    token2 = resp.get_json()["token"]
    headers2 = {"Authorization": f"Bearer {token2}", "Content-Type": "application/json"}

    # All E grades -> CGPA = 5.0 -> Pass Class
    body = {"sem_number": 1, "subjects": [{"name": "All E", "credits": 20, "grade": "E"}]}
    client.post("/api/semesters", json=body, headers=headers2)
    resp = client.get("/api/transcript", headers=headers2)
    data = resp.get_json()
    # SGPA = 20*5/20 = 5.0, CGPA = 5.0
    assert data["cgpa"] == 5.0
    assert data["class"] == "Pass Class"
    print(f"CGPA 5.0 -> Class: '{data['class']}' - verified")

    # Add second semester with better grades to bump CGPA above 5.5
    body = {"sem_number": 2, "subjects": [{"name": "Better", "credits": 20, "grade": "C"}]}
    client.post("/api/semesters", json=body, headers=headers2)
    resp = client.get("/api/transcript", headers=headers2)
    data = resp.get_json()
    # SGPA1=5.0, SGPA2=7.0, CGPA = (20*5 + 20*7)/40 = 240/40 = 6.0
    assert data["cgpa"] == 6.0
    assert data["class"] == "Second Class"
    print(f"CGPA 6.0 -> Class: '{data['class']}' - verified")

    # Test admin endpoints
    print("\n--- Testing admin endpoints ---")
    u_admin = f"admin_{uuid.uuid4().hex[:6]}"
    resp = client.post("/api/auth/register", json={"username": u_admin, "password": "pass", "name": "Admin", "role": "admin"})
    admin_token = resp.get_json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    resp = client.get("/api/admin/students", headers=admin_headers)
    data = resp.get_json()
    assert len(data) > 0
    print(f"Admin can see {len(data)} students - verified")

    # View transcript as admin
    resp = client.get("/api/transcript?student_id=1", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["student"]["id"] == 1
    print(f"Admin can view student transcript - verified")

    # Bulk upload
    bulk = {"entries": [{"username": "bulk_stu", "name": "Bulk Student", "sem_number": 1, "subjects": [{"name": "Subject1", "credits": 3, "grade": "S"}]}]}
    resp = client.post("/api/admin/bulk-upload", json=bulk, headers=admin_headers)
    assert resp.status_code == 201
    print(f"Bulk upload - verified")

    print("\n=== ALL TESTS PASSED ===")

with app.app_context():
    db.drop_all()
    db.create_all()
    test()
