import { notFound } from "next/navigation";
import { PresenceLab } from "@/features/presence-lab/PresenceLab";

export default function PresenceLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PresenceLab />;
}
