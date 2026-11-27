import type { Metadata } from "next";
import { messages } from "@/messages/es";
import { AnalysisView } from "./analysis-view";

export const metadata: Metadata = { title: `${messages.app.title} · análisis` };

export default function AnalysisPage() {
  return <AnalysisView />;
}
