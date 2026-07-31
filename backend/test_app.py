from app import app, db

app.config["TESTING"] = True
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
client = app.test_client()

with app.app_context():
    db.drop_all()
    db.create_all()

    # Add semester
    resp = client.post("/api/semesters", json={"sem_number": 1, "subjects": [
        {"name": "Maths", "credits": 4, "grade": "S"},
        {"name": "Physics", "credits": 4, "grade": "A"},
        {"name": "Chemistry", "credits": 3, "grade": "B"},
        {"name": "English", "credits": 2, "grade": "A"},
        {"name": "Workshop", "credits": 1, "grade": "S"},
    ]})
    assert resp.status_code == 201, resp.get_json()
    print("Sem1 added")

    resp = client.post("/api/semesters", json={"sem_number": 2, "subjects": [
        {"name": "DS", "credits": 4, "grade": "A"},
        {"name": "DM", "credits": 3, "grade": "B"},
        {"name": "DL", "credits": 3, "grade": "A"},
        {"name": "Comm", "credits": 2, "grade": "C"},
        {"name": "Lab", "credits": 1.5, "grade": "S"},
    ]})
    assert resp.status_code == 201
    print("Sem2 added")

    # Transcript
    resp = client.get("/api/transcript")
    assert resp.status_code == 200
    data = resp.get_json()
    print(f"SGPA1: {data['semesters'][0]['sgpa']}")
    print(f"SGPA2: {data['semesters'][1]['sgpa']}")
    print(f"CGPA: {data['cgpa']}")
    print(f"Class: {data['class']}")
    print(f"Percentage: {data['percentage']}")

    # Verify sem1: (4*10 + 4*9 + 3*8 + 2*9 + 1*10) / (4+4+3+2+1) = 128/14 = 9.14
    expected1 = round(128 / 14, 2)
    assert data["semesters"][0]["sgpa"] == expected1, f"S1: {data['semesters'][0]['sgpa']} != {expected1}"

    # Verify sem2: (4*9 + 3*8 + 3*9 + 2*7 + 1.5*10) / (4+3+3+2+1.5) = 116/13.5 = 8.59
    expected2 = round(116 / 13.5, 2)
    assert data["semesters"][1]["sgpa"] == expected2, f"S2: {data['semesters'][1]['sgpa']} != {expected2}"

    # Verify CGPA: (14*9.14 + 13.5*8.59) / 27.5 = 8.87
    cgpa = data["cgpa"]
    expected_cgpa = round((14 * expected1 + 13.5 * expected2) / 27.5, 2)
    assert cgpa == expected_cgpa, f"CGPA: {cgpa} != {expected_cgpa}"

    # Audit test
    resp = client.post("/api/semesters", json={"sem_number": 3, "subjects": [
        {"name": "Yoga", "credits": 2, "grade": "S", "is_audit": True},
        {"name": "Physics Lab", "credits": 1.5, "grade": "A"},
    ]})
    assert resp.status_code == 201
    resp = client.get("/api/transcript")
    data = resp.get_json()
    sem3 = data["semesters"][2]
    assert sem3["credits"] == 1.5  # audit excluded
    assert sem3["sgpa"] == 9.0  # only A
    print(f"Sem3 (audit test): credits={sem3['credits']}, sgpa={sem3['sgpa']} - CORRECT")

    # F/Ab test
    resp = client.post("/api/semesters", json={"sem_number": 4, "subjects": [
        {"name": "Tough", "credits": 4, "grade": "F"},
        {"name": "Missed", "credits": 3, "grade": "Ab"},
    ]})
    resp = client.get("/api/transcript")
    data = resp.get_json()
    sem4 = data["semesters"][3]
    assert sem4["sgpa"] == round((4*0 + 3*0) / 7, 2), f"F/Ab SGPA wrong: {sem4['sgpa']}"
    print(f"Sem4 (F/Ab test): sgpa={sem4['sgpa']} - CORRECT")

    # Export/Import round trip
    resp = client.get("/api/data/export")
    assert resp.status_code == 200
    export_data = resp.get_json()
    print(f"Exported {len(export_data['semesters'])} semesters")

    resp = client.post("/api/data/import", json=export_data)
    assert resp.status_code == 200
    resp = client.get("/api/semesters")
    assert len(resp.get_json()) == len(export_data["semesters"])
    print("Import/Export round trip - CORRECT")

    # Batch save
    resp = client.post("/api/semesters/batch", json={"semesters": [
        {"sem_number": 1, "subjects": [{"name": "CS101", "credits": 4, "grade": "S"}]},
    ]})
    assert resp.status_code == 200
    resp = client.get("/api/semesters")
    assert len(resp.get_json()) == 1
    print("Batch save - CORRECT")

    print("\n=== ALL TESTS PASSED ===")
