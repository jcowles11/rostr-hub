import { Globe } from "lucide-react";
import SocialHome from "@/pages/SocialHome";

export default function SocialPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-8">
      <div className="page-hero mb-6">
        <div className="flex items-center gap-3">
          <Globe className="h-8 w-8 text-white/80" />
          <div>
            <h1 className="text-xl font-extrabold text-white">Social</h1>
            <p className="text-sm text-white/70">Discover players, view profiles & track commitments</p>
          </div>
        </div>
      </div>
      <SocialHome />
    </div>
  );
}
