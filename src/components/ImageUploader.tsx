import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

const MAX_DIMENSION = 2048;
const MAX_BYTES = 5 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.82,
      );
    };
    img.src = url;
  });
}

const ImageUploader = ({ value, onChange, max = 15 }: Props) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const remaining = max - value.length;
    if (remaining <= 0) {
      toast.error(`Up to ${max} images`);
      return;
    }
    setUploading(true);
    const folder = user?.id ?? "guest";
    const urls: string[] = [];
    for (let file of Array.from(files).slice(0, remaining)) {
      file = await compressImage(file);
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is too large to upload`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        continue;
      }
      const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setUploading(false);
    if (urls.length) onChange([...value, ...urls]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-background"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-secondary/40 text-xs text-muted-foreground transition-smooth hover:bg-secondary"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span>{uploading ? "Uploading…" : "Add photo"}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">Up to {max} photos · large images are compressed automatically</p>
    </div>
  );
};

export default ImageUploader;
