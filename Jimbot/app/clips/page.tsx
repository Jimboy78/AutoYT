"use client";

import { useClips } from "./hooks/useClips";
import { ClipsForm } from "./ui/ClipsForm";

export default function ClipsPage() {
  const props = useClips();
  return <ClipsForm {...props} />;
}
