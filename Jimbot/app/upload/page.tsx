"use client";

import { UploadForm } from "./ui/UploadForm";
import { useUpload } from "./hooks/useUpload";

export default function UploadPage() {
  const {
    files,
    dragActive,
    handleDrag,
    handleDrop,
    handleFileInput,
    simulateUpload,
    removeFile,
    uploadAll,
    processFile,
  } = useUpload();

  return (
    <UploadForm
      files={files}
      dragActive={dragActive}
      onDrag={handleDrag}
      onDrop={handleDrop}
      onFileInput={handleFileInput}
      onSimulate={simulateUpload}
      onRemove={removeFile}
      onUploadAll={uploadAll}
      onProcess={processFile}
    />
  );
}
