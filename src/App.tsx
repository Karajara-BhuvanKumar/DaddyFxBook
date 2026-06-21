import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/Auth";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Trades = lazy(() => import("./pages/Trades"));
const Journal = lazy(() => import("./pages/Journal"));
const Analysis = lazy(() => import("./pages/Analysis"));
const AIReport = lazy(() => import("./pages/AIReport"));
const AITradeReviews = lazy(() => import("./pages/AITradeReviews"));
const AIDailyReport = lazy(() => import("./pages/AIDailyReport"));
const AIWeeklyReport = lazy(() => import("./pages/AIWeeklyReport"));
const AIMonthlyReport = lazy(() => import("./pages/AIMonthlyReport"));
const AIScorecard = lazy(() => import("./pages/AIScorecard"));
const Backtesting = lazy(() => import("./pages/Backtesting"));
const BacktestSession = lazy(() => import("./pages/BacktestSession"));
const Settings = lazy(() => import("./pages/Settings"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
      <span className="text-sm font-medium animate-pulse">Loading...</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/trades" element={<Trades />} />
                  <Route path="/journal" element={<Journal />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/ai-report" element={<AIReport />} />
                  <Route path="/ai-report/reviews" element={<AITradeReviews />} />
                  <Route path="/ai-report/daily" element={<AIDailyReport />} />
                  <Route path="/ai-report/weekly" element={<AIWeeklyReport />} />
                  <Route path="/ai-report/monthly" element={<AIMonthlyReport />} />
                  <Route path="/ai-report/scorecard" element={<AIScorecard />} />
                  <Route path="/backtesting" element={<Backtesting />} />
                  <Route path="/backtesting/:id" element={<BacktestSession />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
