"use client";

import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, limit, onPageChange, className }: PaginationProps) {
  if (total === 0) return null;

  const startRow = (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, total);

  return (
    <div className={`flex items-center justify-between gap-4 px-1 py-3 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startRow}-{endRow}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" size={16} /> Prev
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight className="h-4 w-4" size={16} />
        </Button>
      </div>
    </div>
  );
}
