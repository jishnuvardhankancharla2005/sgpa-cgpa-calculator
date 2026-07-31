GRADE_POINTS = {
    "S": 10, "10": 10, "O": 10,
    "A": 9, "9": 9,
    "B": 8, "8": 8,
    "C": 7, "7": 7,
    "D": 6, "6": 6,
    "E": 5, "5": 5,
    "F": 0, "0": 0,
    "AB": 0, "ABSENT": 0
}

def calculate_sgpa(subjects):
    if not subjects:
        return 0.0
    filtered = [(s.credits, str(s.grade).strip().upper()) for s in subjects if not s.is_audit]
    total_credits = sum(c for c, g in filtered)
    if total_credits <= 0:
        return 0.0
    total_points = sum(c * GRADE_POINTS.get(g, 0) for c, g in filtered)
    return round(total_points / total_credits, 2)

def calculate_cgpa(semesters_data):
    if not semesters_data:
        return 0.0
    total_credits = sum(c for c, _ in semesters_data)
    if total_credits <= 0:
        return 0.0
    weighted_sum = sum(c * s for c, s in semesters_data)
    return round(weighted_sum / total_credits, 2)

def cgpa_to_percentage(cgpa):
    if cgpa <= 0:
        return 0.0
    return max(0.0, round((cgpa - 0.5) * 10, 2))

def get_class(cgpa):
    if cgpa >= 7.5:
        return "First Class with Distinction"
    elif cgpa >= 6.5:
        return "First Class"
    elif cgpa >= 5.5:
        return "Second Class"
    elif cgpa >= 5.0:
        return "Pass Class"
    return "Fail"
