import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  blockedIds: Set<string>;
  userId: string;
  userName?: string;
  onBlock: (id: string, name?: string) => void;
  onUnblock: (id: string) => void;
  className?: string;
}

const BlockButton = ({ blockedIds, userId, userName, onBlock, onUnblock, className = "" }: Props) => {
  const isBlocked = blockedIds.has(userId);
  return (
    <Button
      variant="outline"
      size="sm"
      className={isBlocked ? `text-muted-foreground ${className}` : `text-destructive border-destructive/30 hover:bg-destructive/5 ${className}`}
      onClick={() => isBlocked ? onUnblock(userId) : onBlock(userId, userName)}
    >
      <Ban className="h-4 w-4" />
      {isBlocked ? "Unblock user" : "Block user"}
    </Button>
  );
};

export default BlockButton;
