"use client";

import { useEditType } from "./hooks/useEditType";
import { EditTypeForm } from "./ui/EditTypeForm";

export default function EditTypePage() {
  const props = useEditType();
  return <EditTypeForm type={""} {...props} />;
}
