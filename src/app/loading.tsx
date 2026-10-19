import React from "react";
import { FullPageLoader } from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <FullPageLoader
      message="Loading VolTex..."
      subMessage="Connecting to challenge services..."
      label="Loading page content"
    />
  );
}
