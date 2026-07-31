import { useState, useEffect } from "react";
import api from "../api";
import SemesterForm from "./SemesterForm";
import GradeChart from "./GradeChart";
import PDFManager from "./PDFManager";

interface SubjectData {
  id: number; name: string; credits: number; grade: string; is_audit: boolean;
}

interface SemesterData {
  id: number; sem_number: number; subjects: SubjectData[]; sgpa: number;
}

interface SemesterExport {
  sem_number: number;
  subjects: { name: string; credits: number; grade: string; is_audit: boolean }[];
}

function calcCGPA(semesters: SemesterData[]) {
  const items = semesters.map((s) => {
    const credits = s.subjects.filter((x) => !x.is_audit).reduce((a, b) => a + b.credits, 0);
    return { credits, sgpa: s.sgpa };
  });
  const totalC = items.reduce((s, x) => s + x.credits, 0);
  const weighted = items.reduce((s, x) => s + x.credits * x.sgpa, 0);
  return totalC > 0 ? Math.round((weighted / totalC) * 100) / 100 : 0;
}

function getClass(cgpa: number) {
  if (cgpa >= 7.5) return "First Class with Distinction";
  if (cgpa >= 6.5) return "First Class";
  if (cgpa >= 5.5) return "Second Class";
  if (cgpa >= 5.0) return "Pass Class";
  return "Fail";
}

const GRADES = ["S", "A", "B", "C", "D", "E", "F", "Ab"];

function EditableSubjectRow({ sub, i, onUpdate, onRemove }: {
  sub: { name: string; credits: string; grade: string; is_audit: boolean };
  i: number;
  onUpdate: (i: number, field: string, value: any) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <tr>
      <td style={tdS}><input value={sub.name} onChange={(e) => onUpdate(i, "name", e.target.value)} style={inpSE} required /></td>
      <td style={tdS}><input type="number" step="0.5" min="0" value={sub.credits} onChange={(e) => onUpdate(i, "credits", e.target.value)} style={{ ...inpSE, width: 80 }} required /></td>
      <td style={tdS}>
        <select value={sub.grade} onChange={(e) => onUpdate(i, "grade", e.target.value)} style={inpSE} disabled={sub.is_audit}>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </td>
      <td style={tdS}><input type="checkbox" checked={sub.is_audit} onChange={(e) => onUpdate(i, "is_audit", e.target.checked)} /></td>
      <td style={tdS}><button type="button" onClick={() => onRemove(i)} style={{ color: "red", cursor: "pointer", border: "none", background: "none", fontSize: 16 }}>×</button></td>
    </tr>
  );
}

function ReadonlySubjectRow({ sub }: { sub: SubjectData }) {
  return (
    <tr>
      <td style={tdS}>{sub.name}</td>
      <td style={tdS}>{sub.credits}</td>
      <td style={tdS}>{sub.is_audit ? (sub.grade === "S" ? "Satisfactory" : "Unsatisfactory") : sub.grade}</td>
      <td style={tdS}>{sub.is_audit ? "Yes" : "No"}</td>
    </tr>
  );
}

function SemesterCard({ sem, onEdit, onDelete, collapsed, onToggle }: {
  sem: SemesterData;
  onEdit: (s: SemesterData) => void;
  onDelete: (id: number) => void;
  collapsed: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <div style={{ background: "#fff", padding: 16, borderRadius: 8, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => onToggle(sem.id)}>
        <h3 style={{ margin: 0 }}>Semester {sem.sem_number} — SGPA: {sem.sgpa.toFixed(2)}</h3>
        <span>{collapsed ? "▲" : "▼"}</span>
      </div>
      {!collapsed && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e8e8e8", fontSize: 13 }}>Subject</th>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e8e8e8", fontSize: 13 }}>Credits</th>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e8e8e8", fontSize: 13 }}>Grade</th>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #e8e8e8", fontSize: 13 }}>Audit</th>
              </tr>
            </thead>
            <tbody>
              {sem.subjects.map((sub) => <ReadonlySubjectRow key={sub.id} sub={sub} />)}
            </tbody>
          </table>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={() => onEdit(sem)} style={{ padding: "4px 12px", cursor: "pointer", background: "#1890ff", color: "#fff", border: "none", borderRadius: 4, fontSize: 13 }}>Edit</button>
            <button onClick={() => onDelete(sem.id)} style={{ padding: "4px 12px", cursor: "pointer", background: "#ff4d4f", color: "#fff", border: "none", borderRadius: 4, fontSize: 13 }}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

function EditCard({ sem, onSave, onCancel }: {
  sem: SemesterData;
  onSave: (id: number, semNumber: number, subjects: any[]) => void;
  onCancel: () => void;
}) {
  const [semNumber, setSemNumber] = useState(sem.sem_number);
  const [subjects, setSubjects] = useState(
    sem.subjects.map((s) => ({ name: s.name, credits: String(s.credits), grade: s.grade, is_audit: s.is_audit }))
  );

  const update = (i: number, field: string, value: any) => {
    const copy = [...subjects];
    (copy[i] as any)[field] = value;
    setSubjects(copy);
  };

  const remove = (i: number) => {
    if (subjects.length > 1) setSubjects(subjects.filter((_, idx) => idx !== i));
  };

  const addSubject = () => setSubjects([...subjects, { name: "", credits: "", grade: "S", is_audit: false }]);

  const handleSave = () => {
    const valid = subjects.filter((s) => s.name.trim() && s.credits);
    if (valid.length === 0) return alert("Add at least one subject.");
    onSave(sem.id, semNumber, valid);
  };

  return (
    <div style={{ background: "#fff", padding: 16, borderRadius: 8, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", border: "2px solid #1890ff" }}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontWeight: 600, fontSize: 14 }}>Semester:</label>
        <input type="number" min={1} max={12} value={semNumber} onChange={(e) => setSemNumber(Number(e.target.value))} style={{ width: 70, padding: "4px 6px", border: "1px solid #d9d9d9", borderRadius: 4, fontSize: 13 }} />
        <span style={{ fontSize: 13, color: "#666" }}>— Editing (subjects below)</span>
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
            <EditableSubjectRow key={i} sub={s} i={i} onUpdate={update} onRemove={remove} />
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={addSubject} style={btnSmall}>+ Add Subject</button>
        <button onClick={handleSave} style={{ ...btnSmall, background: "#1890ff", color: "#fff", border: "none" }}>Save Changes</button>
        <button onClick={onCancel} style={btnSmall}>Cancel</button>
      </div>
    </div>
  );
}

export default function Dashboard({ user }: { user?: { id: number; username: string; name: string; role: string } }) {
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVersion, setEditVersion] = useState(0);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      const { data } = await api.get("/semesters");
      setSemesters(data);
    } catch {
      setError("Failed to load. Is backend running?");
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddSemester = async (semNumber: number, subjects: any[]) => {
    try {
      const normalized = subjects.map((s: any) => ({ ...s, credits: Number(s.credits), grade: s.grade || "S" }));
      await api.post("/semesters", { sem_number: semNumber, subjects: normalized });
      setShowAddForm(false);
      await load();
    } catch {
      setError("Failed to save semester");
    }
  };

  const handleEditSave = async (id: number, semNumber: number, subjects: any[]) => {
    try {
      const normalized = subjects.map((s: any) => ({ ...s, credits: Number(s.credits), grade: s.grade || "S" }));
      await api.put(`/semesters/${id}`, { sem_number: semNumber, subjects: normalized });
      setEditingId(null);
      await load();
    } catch {
      setError("Failed to update semester");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this semester?")) return;
    try {
      await api.delete(`/semesters/${id}`);
      await load();
    } catch {
      setError("Failed to delete semester");
    }
  };

  const handleImport = async (data: SemesterExport[], replace: boolean = true) => {
    try {
      const normalized = data.map((sem) => ({
        ...sem,
        subjects: sem.subjects.map((s) => ({ ...s, credits: Number(s.credits) || 0, grade: s.grade || "S" })),
      }));
      await api.post("/semesters/batch", { semesters: normalized, replace });
      await load();
    } catch {
      setError("Failed to import data");
    }
  };

  const handleClearAll = async () => {
    if (semesters.length === 0) return;
    if (!confirm("Clear all semester data and start fresh with empty columns?")) return;
    try {
      await api.post("/semesters/batch", { semesters: [], replace: true });
      setShowAddForm(false);
      setEditingId(null);
      await load();
    } catch {
      setError("Failed to clear semester data");
    }
  };

  const toggleCollapse = (id: number) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  const startEdit = (sem: SemesterData) => {
    setEditingId(sem.id);
    setEditVersion((v) => v + 1);
    setShowAddForm(false);
  };

  const startAdd = () => {
    setShowAddForm(!showAddForm);
    setEditingId(null);
  };

  const totalCredits = semesters.reduce((sum, s) => sum + s.subjects.filter((x) => !x.is_audit).reduce((a, b) => a + b.credits, 0), 0);
  const cgpa = calcCGPA(semesters);
  const klass = getClass(cgpa);
  const pct = ((cgpa - 0.5) * 10).toFixed(1);

  const semData = semesters.map((s) => ({
    sem_number: s.sem_number,
    sgpa: s.sgpa,
    credits: s.subjects.filter((x) => !x.is_audit).reduce((a, b) => a + b.credits, 0),
  }));

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: "0 0 4px 0" }}>SGPA / CGPA Calculator</h1>
          {user && <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Welcome back, <strong>{user.name}</strong>!</p>}
        </div>
      </header>

      {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={card}><strong>CGPA</strong><br /><span style={{ fontSize: 28 }}>{cgpa.toFixed(2)}</span></div>
        <div style={card}><strong>Class</strong><br /><span style={{ fontSize: 16 }}>{klass}</span></div>
        <div style={card}><strong>Percentage</strong><br /><span style={{ fontSize: 28 }}>{pct}%</span></div>
        <div style={card}><strong>Semesters</strong><br /><span style={{ fontSize: 28 }}>{semesters.length}</span></div>
        <div style={card}><strong>Total Credits</strong><br /><span style={{ fontSize: 28 }}>{totalCredits}</span></div>
      </div>

      <GradeChart semesters={semData} />

      <PDFManager
        semesters={semesters.map((s) => ({ sem_number: s.sem_number, subjects: s.subjects }))}
        onImport={handleImport}
        onClearAll={handleClearAll}
      />

      <button onClick={startAdd} style={{ marginBottom: 16, padding: "10px 20px", cursor: "pointer", background: "#52c41a", color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, fontSize: 14 }}>
        {showAddForm ? "Cancel" : "+ Add Semester"}
      </button>

      {showAddForm && (
        <SemesterForm
          semNumber={semesters.length + 1}
          onSave={handleAddSemester}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div>
        {semesters.map((sem) =>
          editingId === sem.id ? (
            <EditCard
              key={`${sem.id}-${editVersion}`}
              sem={sem}
              onSave={handleEditSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <SemesterCard
              key={sem.id}
              sem={sem}
              onEdit={startEdit}
              onDelete={handleDelete}
              collapsed={collapsed.has(sem.id)}
              onToggle={toggleCollapse}
            />
          )
        )}
      </div>

      {semesters.length === 0 && !showAddForm && (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No semesters added yet.</p>
          <p>Click "+ Add Semester" to start building your academic record.</p>
        </div>
      )}
    </div>
  );
}

const thS: React.CSSProperties = { padding: 6, borderBottom: "1px solid #e8e8e8", textAlign: "left", fontSize: 13 };
const tdS: React.CSSProperties = { padding: 6, borderBottom: "1px solid #e8e8e8", fontSize: 13 };
const inpSE: React.CSSProperties = { padding: "4px 6px", border: "1px solid #d9d9d9", borderRadius: 3, width: "100%", boxSizing: "border-box", fontSize: 13 };
const btnSmall: React.CSSProperties = { padding: "6px 14px", cursor: "pointer", border: "1px solid #d9d9d9", borderRadius: 4, background: "#fff", fontSize: 13 };
const card: React.CSSProperties = {
  background: "#fff", padding: "16px 20px", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  flex: "1 1 120px", textAlign: "center",
};
