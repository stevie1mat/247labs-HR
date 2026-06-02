import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import MyPostingsPage from "./pages/MyPostingsPage";
import DashboardPage from "./pages/DashboardPage";
import ApplicantsPage from "./pages/ApplicantsPage";
import TemplatesPage from "./pages/TemplatesPage";
import SourcesPage from "./pages/SourcesPage";
import LogsPage from "./pages/LogsPage";
import PostingLogsPage from "./pages/PostingLogsPage";
import ComponentShowcase from "./pages/ComponentShowcase";
import HomePage from "./pages/Home";

import { AuthPage } from "./pages/AuthPage";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/applicants" component={ApplicantsPage} />
            <Route path="/my-postings" component={MyPostingsPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/templates" component={TemplatesPage} />
            <Route path="/sources" component={SourcesPage} />
            <Route path="/logs" component={LogsPage} />
            <Route path="/posting-logs" component={PostingLogsPage} />
            <Route path="/components" component={ComponentShowcase} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
