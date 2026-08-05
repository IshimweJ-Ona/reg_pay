import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardTone = "primary" | "accent" | "success" | "warning" | "info" | "destructive";

const toneClasses: Record<StatCardTone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: StatCardTone;
  className?: string;
  onClick?: () => void;
}

export function StatCard({ icon, label, value, tone = "primary", className, onClick }: StatCardProps) {
  return (
    <Card
      className={cn("shadow-sm", onClick && "cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", toneClasses[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-headline font-bold text-foreground leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
