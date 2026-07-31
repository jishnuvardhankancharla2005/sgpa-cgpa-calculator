import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

interface SemData {
  sem_number: number;
  sgpa: number;
  credits: number;
}

interface Props {
  semesters: SemData[];
}

const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#E91E63", "#9C27B0", "#00BCD4", "#FF5722", "#607D8B"];

export default function GradeChart({ semesters }: Props) {
  const labels = semesters.map((s) => `Sem ${s.sem_number}`);
  const sgpas = semesters.map((s) => s.sgpa);
  const cgpas = semesters.map((_, i) => {
    const sum = semesters.slice(0, i + 1).reduce((acc, s) => acc + s.sgpa * s.credits, 0);
    const tot = semesters.slice(0, i + 1).reduce((acc, s) => acc + s.credits, 0);
    return tot > 0 ? Math.round((sum / tot) * 100) / 100 : 0;
  });

  const barData = {
    labels,
    datasets: [
      {
        label: "SGPA",
        data: sgpas,
        backgroundColor: sgpas.map((v) => (v >= 7 ? COLORS[0] : v >= 5 ? COLORS[2] : COLORS[4])),
        borderRadius: 4,
      },
    ],
  };

  const lineData = {
    labels,
    datasets: [
      {
        label: "CGPA",
        data: cgpas,
        borderColor: COLORS[1],
        backgroundColor: COLORS[1],
        tension: 0.3,
        fill: false,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const opts = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${(ctx.parsed?.y ?? 0).toFixed(2)}` } },
    },
    scales: {
      y: { min: 0, max: 10, ticks: { stepSize: 1 } },
    },
  };

  if (semesters.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
      <div style={{ flex: "1 1 300px", background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginBottom: 8 }}>SGPA per Semester</h3>
        <Bar data={barData} options={opts} />
      </div>
      <div style={{ flex: "1 1 300px", background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginBottom: 8 }}>CGPA Progression</h3>
        <Line data={lineData} options={opts} />
      </div>
    </div>
  );
}
