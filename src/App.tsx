import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const Login = lazy(() => import("./routes/Login"));
const AuthCallback = lazy(() => import("./routes/AuthCallback"));
const StageView = lazy(() => import("./routes/StageView"));
const ShameDashboard = lazy(() => import("./routes/ShameDashboard"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/c/:competitionId" element={<AppShell />}>
          <Route index element={<StageView />} />
          <Route path="shame" element={<ShameDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
