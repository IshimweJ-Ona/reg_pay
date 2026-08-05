import { Bell01, AlertTriangle } from "@untitledui/icons";
import { StatusTone } from "@/components/ui/status-badge";

/**
 * Single source of truth for notification type -> icon/tone, shared between
 * the sidebar bell dropdown and the full notifications page so the two
 * don't drift out of sync on which types get which color.
 */
export function getNotificationVisual(type: string): { icon: React.ReactNode; tone: StatusTone; iconClasses: string } {
  switch (type) {
    case "REGISTRATION_REQUEST":
      return { icon: <AlertTriangle size={18} />, tone: "destructive", iconClasses: "bg-destructive/10 text-destructive" };
    case "TRANSFER_REQUEST":
      return { icon: <AlertTriangle size={18} />, tone: "warning", iconClasses: "bg-warning/10 text-warning" };
    default:
      return { icon: <Bell01 size={18} />, tone: "info", iconClasses: "bg-info/10 text-info" };
  }
}
