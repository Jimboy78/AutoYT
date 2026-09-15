"use client";

import { useTranscriptions } from "./hooks/useTranscriptions";
import { TranscriptionsForm } from "./ui/TranscriptionsForm";

export default function TranscriptionsPage() {
  const props = useTranscriptions();
  return <TranscriptionsForm {...props} />;
}
