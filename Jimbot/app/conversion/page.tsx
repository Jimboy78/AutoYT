"use client";

import { useConversion } from "./hooks/useConversion";
import { ConversionForm } from "./ui/ConversionForm";

export default function ConversionPage() {
  const props = useConversion();
  return <ConversionForm {...props} />;
}
