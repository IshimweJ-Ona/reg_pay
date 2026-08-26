"use client";

import { useRef, useState } from "react";
import { Camera01, Loading02 } from "@untitledui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { userFriendlyError } from "@/lib/error-message";

interface AvatarUploadProps {
  avatarUrl?: string | null;
  fallbackText?: string;
  size?: "md" | "lg";
  onUpload: (file: File) => Promise<{ avatar_url: string }>;
  onUploaded?: (avatarUrl: string) => void;
}

export function AvatarUpload({ avatarUrl, fallbackText, size = "lg", onUpload, onUploaded }: AvatarUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const dimension = size === "lg" ? "h-20 w-20" : "h-14 w-14";

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const result = await onUpload(file);
      onUploaded?.(result.avatar_url);
      toast({ title: "Photo updated", description: "The profile picture was uploaded successfully." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: userFriendlyError(error, "Please try a different image."),
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <Avatar className={`${dimension} border shadow-sm`}>
        <AvatarImage src={previewUrl ?? getAvatarUrl(avatarUrl)} />
        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
          {fallbackText?.charAt(0)?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Change profile picture"
      >
        {isUploading ? (
          <Loading02 className="h-3.5 w-3.5 animate-spin" size={14} />
        ) : (
          <Camera01 className="h-3.5 w-3.5" size={14} />
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
