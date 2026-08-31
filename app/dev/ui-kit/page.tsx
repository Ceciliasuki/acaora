import { notFound } from "next/navigation";
import UiKitClient from "./ui-kit-client";

export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKitClient />;
}
