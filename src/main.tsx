import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import { App } from "./App";
import "./theme.css";

// Vercel Web Analytics (enabled in the Vercel dashboard, Hobby plan).
// inject() loads /_vercel/insights/script.js and reports page views.
inject();

const queryClient = new QueryClient();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
