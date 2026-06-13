import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import Login from "./routes/Login";
import AuthCallback from "./routes/AuthCallback";
import StageView from "./routes/StageView";
import ShameDashboard from "./routes/ShameDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/c/:competitionId" element={<AppShell />}>
        <Route index element={<StageView />} />
        <Route path="shame" element={<ShameDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
