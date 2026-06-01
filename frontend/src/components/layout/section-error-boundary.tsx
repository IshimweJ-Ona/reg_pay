
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in dashboard section:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-rose-50/30 rounded-3xl border border-rose-100 border-dashed animate-in fade-in zoom-in duration-300">
          <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-headline font-bold text-slate-900 mb-2 text-center">Section Operational Failure</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            We encountered a localized error while rendering this module. Other system functions remain active.
          </p>
          <Button 
            className="shadow-lg shadow-rose-200"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Restart Section
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
