import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure pdfjs worker to process PDF files in browser locally
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface SubjectItem {
  id?: number | string;
  name: string;
  credits: number;
  grade: string;
  is_audit: boolean;
}

export interface SemesterItem {
  id?: number | string;
  sem_number: number;
  subjects: SubjectItem[];
  sgpa?: number;
}

export interface TranscriptData {
  studentName: string;
  semesters: SemesterItem[];
}

export interface ParsedPDFResult {
  sourceType: "app_encoded" | "generic_parsed" | "manual_fallback";
  message: string;
  studentName?: string;
  semesters: SemesterItem[];
}

export function utf8ToB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeDigit(semesters: SemesterItem[]): string {
  const jsonStr = JSON.stringify(semesters);
  return Array.from(jsonStr).map((ch) => String(ch.charCodeAt(0)).padStart(5, "0")).join("");
}

export function decodeDigit(digits: string): SemesterItem[] | null {
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length < 50) return null;
  try {
    const chars: string[] = [];
    for (let i = 0; i + 5 <= cleaned.length; i += 5) {
      const code = parseInt(cleaned.slice(i, i + 5), 10);
      if (code > 0 && code < 65536) {
        chars.push(String.fromCharCode(code));
      }
    }
    const jsonStr = chars.join("");
    const startArr = jsonStr.indexOf("[");
    const startObj = jsonStr.indexOf("{");

    let firstIdx = -1;
    if (startArr !== -1 && startObj !== -1) firstIdx = Math.min(startArr, startObj);
    else if (startArr !== -1) firstIdx = startArr;
    else if (startObj !== -1) firstIdx = startObj;

    if (firstIdx !== -1) {
      const lastArr = jsonStr.lastIndexOf("]");
      const lastObj = jsonStr.lastIndexOf("}");
      const lastIdx = Math.max(lastArr, lastObj);

      if (lastIdx > firstIdx) {
        const validJson = jsonStr.substring(firstIdx, lastIdx + 1);
        const parsed = JSON.parse(validJson);
        const sems = parsed.semesters || (Array.isArray(parsed) ? parsed : null);
        if (Array.isArray(sems) && sems.length > 0) {
          return sems;
        }
      }
    }
  } catch (e) {
    console.error("decodeDigit parsing error:", e);
  }
  return null;
}

export function extractAppPayloadFromPDF(text: string): SemesterItem[] | null {
  // 1. Try STARTDATA digit decoding
  if (text.includes("STARTDATA")) {
    const idx = text.indexOf("STARTDATA");
    const sub = text.slice(idx + 9);
    const endIdx = sub.indexOf("ENDDATA");
    const digitChunk = endIdx !== -1 ? sub.slice(0, endIdx) : sub.slice(0, 100000);
    const sems = decodeDigit(digitChunk);
    if (sems) return sems;
  }

  // 2. Try raw 5-digit block anywhere in text
  const digitBlock = text.match(/(?:0\d{4}){10,}/);
  if (digitBlock) {
    const sems = decodeDigit(digitBlock[0]);
    if (sems) return sems;
  }

  // 3. Try base64 markers (__SGPA_B64__:, __SGPA_APP_DATA__:, SGPA:)
  const b64Markers = ["__SGPA_APP_DATA__:", "__SGPA_B64__:", "SGPA:"];
  for (const m of b64Markers) {
    if (text.includes(m)) {
      const idx = text.indexOf(m);
      const sub = text.slice(idx + m.length);
      const unescaped = sub.replace(/\\([()])/g, "$1");
      const match = unescaped.replace(/^[^A-Za-z0-9+/=]+/, "").match(/^[A-Za-z0-9+/=]+/)?.[0];
      if (match && match.length > 10) {
        try {
          const decoded = b64ToUtf8(match);
          const parsed = JSON.parse(decoded);
          const sems = parsed.semesters || (Array.isArray(parsed) ? parsed : null);
          if (Array.isArray(sems) && sems.length > 0) {
            return sems;
          }
        } catch {}
      }
    }
  }

  // 4. Try __SGPA_DATA__: JSON marker
  if (text.includes("__SGPA_DATA__:")) {
    const idx = text.indexOf("__SGPA_DATA__:");
    const sub = text.slice(idx + 14);
    const unescaped = sub.replace(/\\([()])/g, "$1");
    const jsonStart = unescaped.indexOf("{");
    if (jsonStart !== -1) {
      const rest = unescaped.slice(jsonStart);
      const lastBrace = rest.lastIndexOf("}");
      if (lastBrace !== -1) {
        try {
          const parsed = JSON.parse(rest.substring(0, lastBrace + 1));
          const sems = parsed.semesters || (Array.isArray(parsed) ? parsed : null);
          if (Array.isArray(sems) && sems.length > 0) {
            return sems;
          }
        } catch {}
      }
    }
  }

  return null;
}

const GRADE_MAP: Record<string, string> = {
  "O": "S", "S": "S", "10": "S", "EX": "S", "OUTSTANDING": "S", "EXCELLENT": "S",
  "A+": "A", "A": "A", "9": "A", "VERY GOOD": "A", "VERYGOOD": "A",
  "B+": "B", "B": "B", "8": "B", "GOOD": "B",
  "C+": "C", "C": "C", "7": "C", "ABOVE AVERAGE": "C", "ABOVEAVERAGE": "C",
  "D+": "D", "D": "D", "6": "D", "AVERAGE": "D",
  "E": "E", "P": "E", "PASS": "E", "5": "E", "SATISFACTORY": "S",
  "F": "F", "FAIL": "F", "0": "F", "UNSATISFACTORY": "F",
  "AB": "Ab", "ABSENT": "Ab"
};

const ROMAN_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10
};

export function parseGenericAcademicText(text: string): SemesterItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const semesters: Map<number, SubjectItem[]> = new Map();
  let currentSemNumber = 1;

  const IGNORE_PATTERNS = [
    /__SGPA_/,
    /STARTDATA/,
    /ENDDATA/,
    /\{/,
    /\}/,
    /^ACADEMIC TRANSCRIPT/i,
    /^OFFICIAL SGPA/i,
    /^SUMMARY RECORD/i,
    /^STUDENT NAME/i,
    /^GENERATED DATE/i,
    /^CUMULATIVE CGPA/i,
    /^OVERALL CLASS/i,
    /^FINAL ACADEMIC/i,
    /^EQUIVALENT PERCENTAGE/i,
    /^CLASSIFICATION/i,
    /^PAGE \d+/i,
    /^SGPA/i,
    /^CGPA/i,
    /^TOTAL/i,
    /^RESULT/i,
    /^PERCENTAGE/i,
    /^SL NO/i,
    /^COURSE CODE/i,
    /^SUBJECT NAME/i,
    /^CREDITS/i,
    /^GRADE/i,
    /^TYPE/i,
    /^AUDIT/i,
    /^FIRST CLASS/i,
    /^SECOND CLASS/i,
    /^PASS CLASS/i,
  ];

  for (const line of lines) {
    if (IGNORE_PATTERNS.some((p) => p.test(line))) {
      continue;
    }

    const semMatch =
      line.match(/(?:SEMESTER|SEM|TRIMESTER|TERM)\s*[-:]?\s*([0-9]{1,2}|[IVXLCDM]+)\b/i) ||
      line.match(/\b(1st|2nd|3rd|4th|5th|6th|7th|8th)\s+(?:SEMESTER|SEM)\b/i);

    if (semMatch) {
      const rawVal = semMatch[1].toUpperCase();
      let semNum = parseInt(rawVal, 10);
      if (isNaN(semNum)) {
        if (ROMAN_MAP[rawVal]) semNum = ROMAN_MAP[rawVal];
        else if (rawVal.startsWith("1ST")) semNum = 1;
        else if (rawVal.startsWith("2ND")) semNum = 2;
        else if (rawVal.startsWith("3RD")) semNum = 3;
        else if (rawVal.startsWith("4TH")) semNum = 4;
        else if (rawVal.startsWith("5TH")) semNum = 5;
        else if (rawVal.startsWith("6TH")) semNum = 6;
        else if (rawVal.startsWith("7TH")) semNum = 7;
        else if (rawVal.startsWith("8TH")) semNum = 8;
      }
      if (semNum > 0 && semNum <= 12) {
        currentSemNumber = semNum;
        if (!semesters.has(currentSemNumber)) {
          semesters.set(currentSemNumber, []);
        }
        continue;
      }
    }

    const subject = extractSubjectFromLine(line);
    if (subject) {
      if (!semesters.has(currentSemNumber)) {
        semesters.set(currentSemNumber, []);
      }
      const existing = semesters.get(currentSemNumber)!;

      // Allow multiple subjects with same name if credits or grades differ, or keep all extracted subject rows
      existing.push(subject);
    }
  }

  const result: SemesterItem[] = [];
  const sortedSemNums = Array.from(semesters.keys()).sort((a, b) => a - b);
  for (const semNum of sortedSemNums) {
    const subs = semesters.get(semNum)!;
    if (subs.length > 0) {
      result.push({ sem_number: semNum, subjects: subs });
    }
  }

  return result;
}

function extractSubjectFromLine(line: string): SubjectItem | null {
  if (line.length < 4 || /page \d+/i.test(line)) return null;

  if (/SGPA:|CGPA:|TOTAL|PERCENTAGE|CLASSIFICATION|TRANSCRIPT|GENERATED/i.test(line)) {
    return null;
  }

  const tokens = line.split(/[\s,|]+/).filter(Boolean);
  if (tokens.length < 2) return null;

  let foundCredits: number | null = null;
  let foundGrade: string | null = null;
  let isAudit = false;

  if (/\baudit\b|\bnon-credit\b|\bnon credit\b/i.test(line)) {
    isAudit = true;
  }

  const workingTokens = [...tokens];
  for (let i = workingTokens.length - 1; i >= 0; i--) {
    const t = workingTokens[i].toUpperCase().replace(/[(),]/g, "");

    if (!foundGrade && GRADE_MAP[t]) {
      foundGrade = GRADE_MAP[t];
      workingTokens.splice(i, 1);
      continue;
    }

    if (foundCredits === null && /^[0-9](\.[0-5])?$/.test(t)) {
      const c = parseFloat(t);
      if (c >= 0.5 && c <= 15) {
        foundCredits = c;
        workingTokens.splice(i, 1);
        continue;
      }
    }
  }

  if (foundGrade && foundCredits !== null) {
    const name = workingTokens
      .filter((t) => !/^(PASS|FAIL|COMPLETED|P|F|CREDIT|CREDITS|GRADE|MARKS|SATISFACTORY|UNSATISFACTORY|TYPE)$/i.test(t))
      .join(" ")
      .trim();

    if (name.length >= 1 && !/^(TOTAL|SGPA|CGPA|CREDITS)$/i.test(name)) {
      return {
        name,
        credits: foundCredits,
        grade: foundGrade,
        is_audit: isAudit,
      };
    }
  }

  return null;
}

export async function parsePDFFile(file: File): Promise<ParsedPDFResult> {
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch (err) {
    return {
      sourceType: "manual_fallback",
      message: "Could not read file.",
      semesters: [{ sem_number: 1, subjects: [{ name: "Subject 1", credits: 4, grade: "S", is_audit: false }] }],
    };
  }

  const rawText = new TextDecoder("utf-8", { fatal: false }).decode(buf);

  // 1. Primary check: extract base64/STARTDATA payload from raw binary string
  const rawPayload = extractAppPayloadFromPDF(rawText);
  if (rawPayload) {
    return {
      sourceType: "app_encoded",
      message: "Loaded saved transcript PDF into dashboard!",
      semesters: rawPayload,
    };
  }

  // 2. Read text page by page using pdfjsLib
  let pdfText = "";
  try {
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const pdf = await loadingTask.promise;

    try {
      const meta = await pdf.getMetadata();
      const info: any = meta?.info;
      for (const k of ["Keywords", "keywords", "Subject", "subject", "Title", "title"]) {
        if (info?.[k] && typeof info[k] === "string") {
          const payload = extractAppPayloadFromPDF(info[k]);
          if (payload) {
            return {
              sourceType: "app_encoded",
              message: "Loaded saved transcript metadata into dashboard!",
              semesters: payload,
            };
          }
        }
      }
    } catch {}

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageLines: string[] = [];
      let currentLine = "";
      let lastY: number | null = null;

      for (const item of textContent.items as any[]) {
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (currentLine.trim()) pageLines.push(currentLine.trim());
          currentLine = "";
        }
        currentLine += (currentLine ? " " : "") + item.str;
        if (y !== null) lastY = y;
      }
      if (currentLine.trim()) pageLines.push(currentLine.trim());

      pdfText += pageLines.join("\n") + "\n\n";
    }
  } catch (err) {
    console.error("pdfjs text extraction warning:", err);
  }

  // Check extracted pdfjs text across all pages
  const pdfTextPayload = extractAppPayloadFromPDF(pdfText);
  if (pdfTextPayload) {
    return {
      sourceType: "app_encoded",
      message: "Loaded saved transcript PDF into dashboard!",
      semesters: pdfTextPayload,
    };
  }

  // 3. Generic Academic Text Parsing (for external PDFs)
  const genericParsed = parseGenericAcademicText(pdfText);
  if (genericParsed.length > 0 && genericParsed.some((s) => s.subjects.length > 0)) {
    const totalSubs = genericParsed.reduce((sum, s) => sum + s.subjects.length, 0);
    return {
      sourceType: "generic_parsed",
      message: `Extracted ${genericParsed.length} semester(s) with ${totalSubs} subject(s) from PDF!`,
      semesters: genericParsed,
    };
  }

  return {
    sourceType: "manual_fallback",
    message: "PDF uploaded! No text detected.",
    semesters: [
      {
        sem_number: 1,
        subjects: [
          { name: "Subject 1", credits: 4, grade: "S", is_audit: false },
          { name: "Subject 2", credits: 4, grade: "A", is_audit: false },
        ],
      },
    ],
  };
}

export function exportTranscriptPDF(
  studentName: string,
  semesters: SemesterItem[],
  cgpa: number,
  percentage: number,
  classCategory: string
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dataToEmbed: TranscriptData = { studentName, semesters };
  const jsonString = JSON.stringify(dataToEmbed);
  const b64 = utf8ToB64(jsonString);
  const digits = encodeDigit(semesters);

  // Set document metadata with un-wrapped base64 payload & digits
  doc.setProperties({
    title: `${studentName} - Academic Transcript`,
    subject: `__SGPA_APP_DATA__:${b64}`,
    author: "SGPA_CALCULATOR_APP",
    keywords: `STARTDATA${digits}ENDDATA`,
  });

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ACADEMIC TRANSCRIPT", 105, 14, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Official SGPA & CGPA Summary Record", 105, 21, { align: "center" });

  // Student Details Box
  let y = 36;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 18, 2, 2, "FD");

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Student Name: ${studentName || "Student"}`, 20, y + 8);

  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated Date: ${dateStr}`, 20, y + 14);

  doc.setFont("helvetica", "bold");
  doc.text(`Cumulative CGPA: ${cgpa.toFixed(2)}`, 140, y + 8);
  doc.text(`Overall Class: ${classCategory}`, 140, y + 14);

  y += 24;

  const GRADE_POINTS: Record<string, number> = { S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, Ab: 0 };

  // Render Semesters
  semesters.sort((a, b) => a.sem_number - b.sem_number).forEach((sem) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const nonAudit = sem.subjects.filter((s) => !s.is_audit);
    const totalCredits = nonAudit.reduce((a, b) => a + b.credits, 0);
    const totalPts = nonAudit.reduce((a, b) => a + b.credits * (GRADE_POINTS[b.grade] || 0), 0);
    const calculatedSGPA = totalCredits > 0 ? totalPts / totalCredits : 0;

    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 8, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Semester ${sem.sem_number}`, 18, y + 6);
    doc.text(`SGPA: ${calculatedSGPA.toFixed(2)}`, 160, y + 6);

    y += 10;

    // Table Header
    doc.setFillColor(226, 232, 240);
    doc.rect(14, y, 182, 6, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Subject Name", 18, y + 4.5);
    doc.text("Credits", 115, y + 4.5);
    doc.text("Grade", 145, y + 4.5);
    doc.text("Type", 175, y + 4.5);

    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    sem.subjects.forEach((sub) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(sub.name || "Unnamed Subject", 18, y + 4);
      doc.text(String(sub.credits), 115, y + 4);
      doc.text(sub.is_audit ? (sub.grade === "S" ? "Satisfactory" : "Unsatisfactory") : sub.grade, 145, y + 4);
      doc.text(sub.is_audit ? "Audit" : "Credit", 175, y + 4);

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6, 196, y + 6);
      y += 7;
    });

    y += 4;
  });

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  y += 4;
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(14, y, 182, 24, 3, 3, "FD");

  doc.setTextColor(49, 46, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FINAL ACADEMIC PERFORMANCE SUMMARY", 20, y + 8);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Cumulative Grade Point Average (CGPA): ${cgpa.toFixed(2)} / 10.00`, 20, y + 16);
  doc.text(`Equivalent Percentage: ${percentage.toFixed(2)}%`, 110, y + 16);
  doc.text(`Classification: ${classCategory}`, 20, y + 21);

  // Embedded STARTDATA line in single un-wrapped line
  doc.setFontSize(1);
  doc.setTextColor(255, 255, 255);
  doc.text(`STARTDATA${digits}ENDDATA`, 1, 290);

  doc.save(`${(studentName || "student").toLowerCase().replace(/\s+/g, "_")}_transcript.pdf`);
}
