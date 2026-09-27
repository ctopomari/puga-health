import { createFileRoute } from "@tanstack/react-router";
import { App, AppErrorBoundary } from "@/puga/App";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
