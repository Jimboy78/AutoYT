"use client";

import { useProcessing } from "./hooks/useProcessing";
import { ProcessingDashboard } from "./ui/ProcessingDashboard";

export default function ProcessingPage() {
  const props = useProcessing();
  return <ProcessingDashboard {...props} />;
}
