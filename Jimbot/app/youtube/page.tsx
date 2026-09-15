"use client";

import { useYouTube } from "./hooks/useYouTube";
import { YouTubeForm } from "./ui/YouTubeForm";

export default function YouTubePage() {
  const props = useYouTube();

  return <YouTubeForm {...props} />;
}
