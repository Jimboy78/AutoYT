"use client";

import { useAnalytics } from "./hooks/useAnalytics";
import { AnalyticsForm } from "./ui/AnalyticsForm";

export default function AnalyticsPage() {
  const props = useAnalytics();
  return <AnalyticsForm {...props} />;
}
