import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { DashboardView } from "@/pages/Dashboard";
import { previewAsOf, previewMonth, previewTrades } from "@/lib/previewData";

export default function Preview() {
  return (
    <div className="local-preview">
      <div className="local-preview-notice">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
          Local preview · Sample data
        </span>
        <Link to="/auth" className="inline-flex items-center gap-1 text-primary hover:underline">
          Open your account <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      <DashboardView
        trades={previewTrades}
        initialDate={previewMonth}
        initialTimeframe="1M"
        asOfDate={previewAsOf}
      />
    </div>
  );
}
