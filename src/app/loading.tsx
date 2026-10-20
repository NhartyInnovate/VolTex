import React from "react";
import { FullPageLoader } from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <FullPageLoader
      message="Loading..."
      label="Loading page content"
    />
  );
}
