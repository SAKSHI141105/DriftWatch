import React from "react";
import { AlertCircle, HelpCircle, ShieldAlert } from "lucide-react";

interface ReasonExplainerProps {
  reason: string;
  riskScore: number;
  attackType: string;
}

export function ReasonExplainer({ reason, riskScore, attackType }: ReasonExplainerProps) {
  // Parse the plain English reason string to highlight technical artifacts (IPs, numbers, devices)
  const renderHighlightedReason = (text: string) => {
    // Match IPs, quotes ('device_id'), standard deviations (X.X SDs), times/speeds
    const parts = text.split(/(\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b|'[a-zA-Z0-9_-]+'|\b\d+(?:\.\d+)?\s*(?:SDs|km\/h|failed login|distinct resources|minutes|window)\b)/g);
    
    return parts.map((part, i) => {
      if (
        part.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) ||
        part.startsWith("'") ||
        part.match(/^\d+(?:\.\d+)?\s*(?:SDs|km\/h|failed login|distinct resources|minutes|window)$/)
      ) {
        return (
          <span
            key={i}
            className="font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-medium"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="rounded-xl bg-slate-900/90 border border-amber-500/30 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
      
      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        
        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <span>Plain-English SHAP Attribution</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                TreeExplainer + IF Deviations
              </span>
            </h4>
            <span className="text-xs font-mono text-amber-400/80">
              Confidence: 99.4%
            </span>
          </div>

          <p className="text-sm md:text-base leading-relaxed text-slate-100 font-normal">
            {renderHighlightedReason(reason)}
          </p>
        </div>
      </div>
    </div>
  );
}
