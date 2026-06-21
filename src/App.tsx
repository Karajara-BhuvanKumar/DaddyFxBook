import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Journal from "./pages/Journal";
import Analysis from "./pages/Analysis";
import AIReport from "./pages/AIReport";
import AITradeReviews from "./pages/AITradeReviews";
import AIDailyReport from "./pages/AIDailyReport";
import AIWeeklyReport from "./pages/AIWeeklyReport";
import AIMonthlyReport from "./pages/AIMonthlyReport";
import AIScorecard from "./pages/AIScorecard";
import Backtesting from "./pages/Backtesting";
import BacktestSession from "./pages/BacktestSession";
import Settings from "./pages/Settings";
import AuthPage from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
