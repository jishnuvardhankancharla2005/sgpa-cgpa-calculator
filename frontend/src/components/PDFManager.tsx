import { useState, useRef } from "react";
import { useToast } from "../context/ToastContext";
import {
  parsePDFFile,
  exportTranscriptPDF,
  type SemesterItem,
  type SubjectItem,
  type ParsedPDFResult,
} from "../services/pdfService";

interface Props {
  semesters: SemesterItem[];
  onImport: (data: SemesterItem[], replace?: boolean) => void;
  onClearAll?: () => void;
}

const GRADES = ["S", "A", "B", "C", "D", "E", "F", "Ab"];
const GRADE_POINTS: Record<string, number> = { S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, Ab: 0 };

function calcSemSGPA(subs: SubjectItem[]) {
  const filtered = subs.filter((s) => !s.is_audit);
  const totalC = filtered.reduce((a, b) => a + (Number(b.credits) || 0), 0);
  const pts = filtered.reduce((a, b) => a + (Number(b.credits) || 0) * (GRADE_POINTS[b.grade] || 0), 0);
  return totalC > 0 ? Math.round((pts / totalC) * 100) / 100 : 0;
}

function calcTotalCGPA(sems: SemesterItem[]) {
  const items = sems.map((s) => {
    const sgpa = calcSemSGPA(s.subjects);
    const credits = s.subjects.filter((x) => !x.is_audit).reduce((a, b) => a + (Number(b.credits) || 0), 0);
    return { credits, sgpa };
  });
  const totalC = items.reduce((s, x) => s + x.credits, 0);
  const weighted = items.reduce((s, x) => s + x.credits * x.sgpa, 0);
  return totalC > 0 ? Math.round((weighted / totalC) * 100) / 100 : 0;
}

function getClassCategory(cgpa: number) {
  if (cgpa >= 7.5) return "First Class with Distinction";
  if (cgpa >= 6.5) return "First Class";
  if (cgpa >= 5.5) return "Second Class";
  if (cgpa >= 5.0) return "Pass Class";
  return "Fail";
}

export default function PDFManager({ semesters, onImport, onClearAll }: Props) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedPDFResult | null>(null);
  const [editSemesters, setEditSemesters] = useState<SemesterItem[]>([]);
  const [replaceMode, setReplaceMode] = useState<boolean>(true);

  const handleExport = () => {
    if (semesters.length === 0) {
      showToast("No semesters available to export.", "warning");
      return alert("No semesters available to export.");
    }

    const studentName = prompt("Enter student name for the transcript:", "Student");
    if (studentName === null) return;

    const cgpa = calcTotalCGPA(semesters);
    const pct = (cgpa - 0.5) * 10;
    const klass = getClassCategory(cgpa);

    exportTranscriptPDF(studentName.trim() || "Student", semesters, cgpa, pct, klass);
    showToast(`Transcript PDF exported successfully for ${studentName.trim() || "Student"}!`, "success");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsParsing(true);
    try {
      const res = await parsePDFFile(file);
      setParsedResult(res);
      setEditSemesters(res.semesters);
      showToast(`PDF parsed successfully! Found ${res.semesters.length} semester(s).`, "success");
    } catch (err) {
      console.error("PDF Parsing error:", err);
      alert("Could not process this PDF file.");
      showToast("Could not process this PDF file.", "error");
    } finally {
      setIsParsing(false);
    }
  };

  const closeImportModal = () => {
    setParsedResult(null);
    setEditSemesters([]);
  };

  const updateSemesterNumber = (semIndex: number, newSemNo: number) => {
    const copy = [...editSemesters];
    copy[semIndex].sem_number = newSemNo;
    setEditSemesters(copy);
  };

  const removeSemester = (semIndex: number) => {
    if (editSemesters.length <= 1) {
      return alert("You must keep at least one semester.");
    }
    setEditSemesters(editSemesters.filter((_, idx) => idx !== semIndex));
  };

  const addSemester = () => {
    const maxSem = editSemesters.reduce((max, s) => Math.max(max, s.sem_number), 0);
    setEditSemesters([
      ...editSemesters,
      {
        sem_number: maxSem + 1,
        subjects: [{ name: "", credits: 4, grade: "S", is_audit: false }],
      },
    ]);
  };

  const updateSubject = (semIndex: number, subIndex: number, field: keyof SubjectItem, val: any) => {
    const copy = [...editSemesters];
    const sub = { ...copy[semIndex].subjects[subIndex], [field]: val };
    copy[semIndex].subjects[subIndex] = sub;
    setEditSemesters(copy);
  };

  const removeSubject = (semIndex: number, subIndex: number) => {
    const copy = [...editSemesters];
    if (copy[semIndex].subjects.length <= 1) {
      return alert("A semester must have at least one subject.");
    }
    copy[semIndex].subjects = copy[semIndex].subjects.filter((_, idx) => idx !== subIndex);
    setEditSemesters(copy);
  };

  const addSubject = (semIndex: number) => {
    const copy = [...editSemesters];
    copy[semIndex].subjects.push({ name: "", credits: 4, grade: "S", is_audit: false });
    setEditSemesters(copy);
  };

  const handleConfirmImport = () => {
    for (const sem of editSemesters) {
      const validSubs = sem.subjects.filter((s) => s.name.trim().length > 0);
      if (validSubs.length === 0) {
        return alert(`Semester ${sem.sem_number} has no valid subject names.`);
      }
    }

    const cleanData = editSemesters.map((sem) => ({
      ...sem,
      subjects: sem.subjects.map((s) => ({
        ...s,
        name: s.name.trim() || "Subject",
        credits: Number(s.credits) || 1,
        grade: s.grade || "S",
      })),
    }));

    onImport(cleanData, replaceMode);
    closeImportModal();
  };

  const modalCGPA = calcTotalCGPA(editSemesters);
  const modalPct = Math.max(0, (modalCGPA - 0.5) * 10).toFixed(1);
  const modalKlass = getClassCategory(modalCGPA);
  const modalTotalCredits = editSemesters.reduce(
    (sum, sem) => sum + sem.subjects.filter((s) => !s.is_audit).reduce((c, s) => c + (Number(s.credits) || 0), 0),
    0
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={handleExport} style={btnPrimary}>
          📥 Download Transcript PDF
        </button>
        <button onClick={() => fileRef.current?.click()} style={btnSuccess} disabled={isParsing}>
          {isParsing ? "⏳ Parsing PDF..." : "📤 Upload PDF to Restore / Import"}
        </button>
        {onClearAll && semesters.length > 0 && (
          <button onClick={onClearAll} style={btnDanger}>
            🗑️ Clear & Start Fresh
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileSelect} style={{ display: "none" }} />
      </div>

      {/* PDF IMPORT & EDIT MODAL OVERLAY */}
      {parsedResult && (
        <div style={modalOverlayStyle}>
          <div style={modalContainerStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>📄 PDF Import & Review</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                  Review, edit, or add semesters and subjects extracted from your PDF before saving to dashboard.
                </p>
              </div>
              <button onClick={closeImportModal} style={closeBtnStyle}>
                ×
              </button>
            </div>

            {/* STATUS BANNER */}
            <div
              style={{
                ...statusBannerBase,
                ...(parsedResult.sourceType === "app_encoded"
                  ? statusBannerApp
                  : parsedResult.sourceType === "generic_parsed"
                  ? statusBannerGeneric
                  : statusBannerFallback),
              }}
            >
              {parsedResult.message}
            </div>

            {/* ACTION MODE SELECTOR */}
            <div style={{ margin: "16px 0", background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <strong style={{ fontSize: 13, color: "#334155" }}>Import Strategy:</strong>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <label style={{ cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="importMode"
                    checked={replaceMode}
                    onChange={() => setReplaceMode(true)}
                  />
                  <span><strong>Replace All</strong> existing dashboard semesters</span>
                </label>
                <label style={{ cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="importMode"
                    checked={!replaceMode}
                    onChange={() => setReplaceMode(false)}
                  />
                  <span><strong>Append</strong> to current dashboard semesters</span>
                </label>
              </div>
            </div>

            {/* LIVE OVERALL SUMMARY */}
            <div style={summaryRowStyle}>
              <div style={statBoxStyle}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>CGPA</span>
                <strong style={{ fontSize: 20, color: "#1e293b" }}>{modalCGPA.toFixed(2)}</strong>
              </div>
              <div style={statBoxStyle}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Class</span>
                <strong style={{ fontSize: 13, color: "#1e293b" }}>{modalKlass}</strong>
              </div>
              <div style={statBoxStyle}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Percentage</span>
                <strong style={{ fontSize: 20, color: "#1e293b" }}>{modalPct}%</strong>
              </div>
              <div style={statBoxStyle}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Semesters</span>
                <strong style={{ fontSize: 20, color: "#1e293b" }}>{editSemesters.length}</strong>
              </div>
              <div style={statBoxStyle}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Total Credits</span>
                <strong style={{ fontSize: 20, color: "#1e293b" }}>{modalTotalCredits}</strong>
              </div>
            </div>

            {/* SEMESTERS EDIT LIST */}
            <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4, marginBottom: 16 }}>
              {editSemesters.map((sem, sIdx) => {
                const semSGPA = calcSemSGPA(sem.subjects);
                return (
                  <div key={sIdx} style={semCardStyle}>
                    <div style={semCardHeaderStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Semester:</span>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={sem.sem_number}
                          onChange={(e) => updateSemesterNumber(sIdx, Number(e.target.value))}
                          style={semNumInpStyle}
                        />
                        <span style={sgpaBadgeStyle}>SGPA: {semSGPA.toFixed(2)}</span>
                      </div>
                      <button onClick={() => removeSemester(sIdx)} style={deleteSemBtnStyle}>
                        Remove Semester
                      </button>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9" }}>
                          <th style={thStyle}>Subject Name</th>
                          <th style={{ ...thStyle, width: 80 }}>Credits</th>
                          <th style={{ ...thStyle, width: 90 }}>Grade</th>
                          <th style={{ ...thStyle, width: 60 }}>Audit</th>
                          <th style={{ ...thStyle, width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sem.subjects.map((sub, subIdx) => (
                          <tr key={subIdx}>
                            <td style={tdStyle}>
                              <input
                                value={sub.name}
                                onChange={(e) => updateSubject(sIdx, subIdx, "name", e.target.value)}
                                placeholder="Subject name"
                                style={inpTextStyle}
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={sub.credits}
                                onChange={(e) => updateSubject(sIdx, subIdx, "credits", e.target.value)}
                                style={inpNumStyle}
                              />
                            </td>
                            <td style={tdStyle}>
                              <select
                                value={sub.grade}
                                onChange={(e) => updateSubject(sIdx, subIdx, "grade", e.target.value)}
                                style={inpSelectStyle}
                                disabled={sub.is_audit}
                              >
                                {GRADES.map((g) => (
                                  <option key={g} value={g}>
                                    {g} ({GRADE_POINTS[g] ?? 0} pts)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={sub.is_audit}
                                onChange={(e) => updateSubject(sIdx, subIdx, "is_audit", e.target.checked)}
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <button onClick={() => removeSubject(sIdx, subIdx)} style={removeSubBtnStyle}>
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <button onClick={() => addSubject(sIdx)} style={addSubjectBtnStyle}>
                      + Add Subject
                    </button>
                  </div>
                );
              })}

              <button onClick={addSemester} style={addSemBtnStyle}>
                + Add New Semester
              </button>
            </div>

            {/* MODAL FOOTER */}
            <div style={modalFooterStyle}>
              <button onClick={closeImportModal} style={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleConfirmImport} style={btnPrimaryLarge}>
                Save to Dashboard ({replaceMode ? "Replace" : "Append"})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLING OBJECTS
const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  cursor: "pointer",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  background: "#2563eb",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const btnSuccess: React.CSSProperties = {
  padding: "10px 18px",
  cursor: "pointer",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  background: "#16a34a",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(15, 23, 42, 0.65)",
  backdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalContainerStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 12,
  width: "100%",
  maxWidth: 820,
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  padding: 24,
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 12,
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 24,
  cursor: "pointer",
  color: "#94a3b8",
};

const statusBannerBase: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 8,
};

const statusBannerApp: React.CSSProperties = {
  background: "#dcfce7",
  color: "#15803d",
  border: "1px solid #bbf7d0",
};

const statusBannerGeneric: React.CSSProperties = {
  background: "#e0f2fe",
  color: "#0369a1",
  border: "1px solid #bae6fd",
};

const statusBannerFallback: React.CSSProperties = {
  background: "#fef3c7",
  color: "#b45309",
  border: "1px solid #fde68a",
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginBottom: 16,
  flexWrap: "wrap",
};

const statBoxStyle: React.CSSProperties = {
  flex: "1 1 110px",
  background: "#f8fafc",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const semCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const semCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const semNumInpStyle: React.CSSProperties = {
  width: 55,
  padding: "4px 6px",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  fontSize: 13,
};

const sgpaBadgeStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 600,
  fontSize: 12,
  padding: "3px 8px",
  borderRadius: 12,
  border: "1px solid #bfdbfe",
};

const deleteSemBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#ef4444",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 500,
};

const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid #f1f5f9",
};

const inpTextStyle: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  boxSizing: "border-box",
};

const inpNumStyle: React.CSSProperties = {
  width: 70,
  padding: "5px 6px",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  boxSizing: "border-box",
};

const inpSelectStyle: React.CSSProperties = {
  width: 85,
  padding: "5px 6px",
  borderRadius: 4,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  boxSizing: "border-box",
};

const removeSubBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#ef4444",
  fontSize: 18,
  cursor: "pointer",
  lineHeight: 1,
};

const addSubjectBtnStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "4px 10px",
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
  color: "#334155",
};

const addSemBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  background: "#f8fafc",
  border: "2px dashed #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#2563eb",
  cursor: "pointer",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  paddingTop: 14,
  borderTop: "1px solid #e2e8f0",
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 18px",
  cursor: "pointer",
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 13,
  color: "#334155",
};

const btnPrimaryLarge: React.CSSProperties = {
  padding: "9px 20px",
  cursor: "pointer",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
};

const btnDanger: React.CSSProperties = {
  padding: "10px 18px",
  cursor: "pointer",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  background: "#dc2626",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};
