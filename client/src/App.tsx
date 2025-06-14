import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import MediaLibrary from "@/pages/media-library";
import UrlConverter from "@/pages/url-converter";
import ProxyDemo from "@/pages/proxy-demo";
import Base64Converter from "@/pages/base64-converter";
import AccessPortal from "@/pages/access-portal";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/sidebar";

function AppContent() {
  const [location] = useLocation();
  const isAccessPortal = location === "/";

  if (isAccessPortal) {
    return <AccessPortal />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/upload" component={Upload} />
          <Route path="/media" component={MediaLibrary} />
          <Route path="/convert" component={UrlConverter} />
          <Route path="/proxy" component={ProxyDemo} />
          <Route path="/base64" component={Base64Converter} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <WouterRouter>
          <AppContent />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
