export const GRADE_MAP: Record<string, number> = {
  S: 10,
  A: 9,
  B: 8,
  C: 7,
  D: 6,
  E: 5,
  F: 0,
  Ab: 0,
};

export interface SubjectItem {
  id?: number;
  name: string;
  credits: number;
  grade: string;
  is_audit: boolean;
}

export interface SemesterItem {
  id?: number;
  sem_number: number;
  subjects: SubjectItem[];
  sgpa: number;
}

/**
 * Calculates 100% accurate SGPA for a given list of subjects.
 * Audit courses (is_audit = true) are excluded from credit and grade point calculations.
 */
export function computeSGPA(subjects: SubjectItem[]): number {
  let totalGradedCredits = 0;
  let weightedPoints = 0;

  for (const s of subjects) {
    if (!s.is_audit && Number(s.credits) > 0) {
      const pts = GRADE_MAP[s.grade] ?? 0;
      const creds = Number(s.credits);
      totalGradedCredits += creds;
      weightedPoints += creds * pts;
    }
  }

  return totalGradedCredits > 0 ? weightedPoints / totalGradedCredits : 0;
}

/**
 * Calculates 100% accurate cumulative CGPA across all semesters.
 * Uses exact weighted credit sums sum(credits * grade_points) / sum(credits) for mathematical precision.
 */
export function computeCGPA(semesters: SemesterItem[]): {
  cgpa: number;
  totalCredits: number;
  weightedPoints: number;
  percentage: number;
  classCategory: string;
} {
  let totalGradedCredits = 0;
  let weightedPoints = 0;

  for (const sem of semesters) {
    for (const s of sem.subjects) {
      if (!s.is_audit && Number(s.credits) > 0) {
        const pts = GRADE_MAP[s.grade] ?? 0;
        const creds = Number(s.credits);
        totalGradedCredits += creds;
        weightedPoints += creds * pts;
      }
    }
  }

  const cgpa = totalGradedCredits > 0 ? weightedPoints / totalGradedCredits : 0;
  
  // Standard conversion formula: Percentage = (CGPA - 0.5) * 10
  const percentage = cgpa > 0 ? Math.max(0, (cgpa - 0.5) * 10) : 0;

  let classCategory = "Fail";
  if (cgpa >= 7.5) {
    classCategory = "First Class with Distinction";
  } else if (cgpa >= 6.5) {
    classCategory = "First Class";
  } else if (cgpa >= 5.5) {
    classCategory = "Second Class";
  } else if (cgpa >= 5.0) {
    classCategory = "Pass Class";
  }

  return {
    cgpa,
    totalCredits: totalGradedCredits,
    weightedPoints,
    percentage,
    classCategory,
  };
}
