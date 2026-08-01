import { useState } from "react";

const GRADES = ["S", "A", "B", "C", "D", "E", "F", "Ab"];

interface SubjectRow {
  name: string;
  credits: string;
  grade: string;
  is_audit: boolean;
}

interface Props {
  semNumber?: number;
  initialSubjects?: SubjectRow[];
  onSave: (sem_number: number, subjects: SubjectRow[]) => void;
  onCancel?: () => void;
}

export default function SemesterForm({ semNumber = 1, initialSubjects, onSave, onCancel }: Props) {
  const [semesterNo, setSemesterNo] = useState(semNumber);
  const [subjects, setSubjects] = useState<SubjectRow[]>(
    initialSubjects ?? [{ name: "", credits: "", grade: "S", is_audit: false }]
  );

  const addSubject = () => setSubjects([...subjects, { name: "", credits: "", grade: "S", is_audit: false }]);

  const removeSubject = (i: number) => {
    if (subjects.length > 1) setSubjects(subjects.filter((_, idx) => idx !== i));
  };

  const update = (i: number, field: keyof SubjectRow, value: string | boolean) => {
    const copy = [...subjects];
    (copy[i] as any)[field] = value;
    setSubjects(copy);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = subjects.filter((s) => s.name.trim() !== "" && s.credits !== "" && !isNaN(Number(s.credits)));
    if (valid.length === 0) return alert("Add at least one subject with a valid name and numeric credits.");
    onSave(semesterNo, valid);
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 24, borderRadius: 8, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ fontWeight: 600 }}>Semester:</label>
        <input type="number" min={1} value={semesterNo} onChange={(e) => setSemesterNo(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80, padding: "6px 8px", border: "1px solid #d9d9d9", borderRadius: 4 }} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fafafa" }}>
            <th style={thS}>Subject</th>
            <th style={thS}>Credits</th>
            <th style={thS}>Grade</th>
            <th style={thS}>Audit</th>
            <th style={thS}></th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={i}>
              <td style={tdS}><input value={s.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Subject name" style={inpS} required /></td>
              <td style={tdS}><input type="number" step="0.5" min="0" value={s.credits} onChange={(e) => update(i, "credits", e.target.value)} placeholder="Credits" style={{ ...inpS, width: 80 }} required /></td>
              <td style={tdS}>
                <select value={s.grade} onChange={(e) => update(i, "grade", e.target.value)} style={inpS} disabled={s.is_audit}>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </td>
              <td style={tdS}><input type="checkbox" checked={s.is_audit} onChange={(e) => update(i, "is_audit", e.target.checked)} /></td>
              <td style={tdS}><button type="button" onClick={() => removeSubject(i)} style={{ color: "red", cursor: "pointer", border: "none", background: "none", fontSize: 16 }}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" onClick={addSubject} style={{ padding: "6px 16px", cursor: "pointer", border: "1px solid #d9d9d9", borderRadius: 4, background: "#fff" }}>+ Add Subject</button>
        <button type="submit" style={{ padding: "6px 16px", cursor: "pointer", background: "#1890ff", color: "#fff", border: "none", borderRadius: 4, fontWeight: 600 }}>Save Semester</button>
        {onCancel && <button type="button" onClick={onCancel} style={{ padding: "6px 16px", cursor: "pointer", border: "1px solid #d9d9d9", borderRadius: 4, background: "#fff" }}>Cancel</button>}
      </div>
    </form>
  );
}

const thS: React.CSSProperties = { padding: 8, borderBottom: "2px solid #e8e8e8", textAlign: "left", fontSize: 13 };
const tdS: React.CSSProperties = { padding: 6, borderBottom: "1px solid #e8e8e8" };
const inpS: React.CSSProperties = { padding: "6px 8px", border: "1px solid #d9d9d9", borderRadius: 4, width: "100%", boxSizing: "border-box", fontSize: 13 };
