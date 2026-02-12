import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import SettlementList from "./pages/SettlementList";
import SpecialList from "./pages/SpecialList";
import CreateSettlement from "./pages/CreateSettlement";
import EditSettlement from "./pages/EditSettlement";
import BackupPage from "./pages/BackupPage";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={SettlementList} />
        <Route path="/special" component={SpecialList} />
        <Route path="/create" component={CreateSettlement} />
        <Route path="/edit/:id" component={EditSettlement} />
        <Route path="/backup" component={BackupPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
