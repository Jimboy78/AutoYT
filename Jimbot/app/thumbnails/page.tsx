"use client";

import { useThumbnails } from "./hooks/useThumbnails";
import { ThumbnailsForm } from "./ui/ThumbnailsForm";

export default function ThumbnailsPage() {
  const props = useThumbnails();
  return <ThumbnailsForm {...props} />;
}
