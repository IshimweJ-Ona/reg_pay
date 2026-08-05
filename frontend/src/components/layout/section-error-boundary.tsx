
"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw01 } from "@untitledui/icons";
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by React's Component contract
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in dashboard section:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-destructive/5 rounded-3xl border border-destructive/20 border-dashed animate-in fade-in zoom-in duration-300">
          <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8" size={32} />
          </div>
          <h2 className="text-xl font-headline font-bold text-foreground mb-2 text-center">Section Operational Failure</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            We encountered a localized error while rendering this module. Other system functions remain active.
          </p>
          <Button
            className="shadow-lg shadow-destructive/20"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCcw01 className="mr-2 h-4 w-4 text-white" size={16} /> Restart Section
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
