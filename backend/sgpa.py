GRADE_POINTS = {"S": 10, "A": 9, "B": 8, "C": 7, "D": 6, "E": 5, "F": 0, "Ab": 0}

def calculate_sgpa(subjects):
    filtered = [(s.credits, s.grade) for s in subjects if not s.is_audit]
    total_credits = sum(c for c, g in filtered)
    total_points = sum(c * GRADE_POINTS[g] for c, g in filtered)
    return round(total_points / total_credits, 2) if total_credits > 0 else 0.0

def calculate_cgpa(semesters_data):
    total_credits = sum(c for c, _ in semesters_data)
    weighted_sum = sum(c * s for c, s in semesters_data)
    return round(weighted_sum / total_credits, 2) if total_credits > 0 else 0.0

def cgpa_to_percentage(cgpa):
    return round((cgpa - 0.5) * 10, 2)

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
