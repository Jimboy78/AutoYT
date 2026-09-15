"use client";

import { useEditor } from "./hooks/useEditor";
import { EditorForm } from "./ui/EditorForm";

export default function EditorPage() {
  const props = useEditor();
  return <EditorForm {...props} />;
}
