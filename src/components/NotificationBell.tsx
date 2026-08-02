import { useNavigate } from "react-router-dom";
import { Bell, MessageCircle, MessagesSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";

const NotificationBell = () => {
  const { items, unreadCount, markAllRead, requestPushPermission } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      requestPushPermission();
      const t = setTimeout(() => markAllRead(), 800);
      return () => clearTimeout(t);
    }
  }, [open, markAllRead, requestPushPermission]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold">Notifications</p>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6 opacity-60" />
              You're all caught up.
              <p className="mt-1 text-xs">Replies to your questions and new chat messages will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={`${n.kind}-${n.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (n.kind === "answer") navigate(`/community/${n.questionId}`);
                      else navigate(`/messages/${n.conversationId}`);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-smooth hover:bg-secondary/60"
                  >
                    <div className="mt-0.5 rounded-full bg-secondary p-2">
                      {n.kind === "answer" ? (
                        <MessagesSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {n.kind === "answer" ? (
                        <>
                          <p className="truncate text-sm font-medium">{n.author} replied to your question</p>
                          <p className="truncate text-sm font-bold">"{n.questionTitle}"</p>
                        </>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium">{n.author} messaged you about</p>
                          <p className="truncate text-sm font-bold">"{n.listingTitle}"</p>
                        </>
                      )}
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.snippet}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
