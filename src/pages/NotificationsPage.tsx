import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-24 space-y-4 animate-fade-in">
      <h1 className="text-xl font-extrabold">Notifications</h1>
      <div className="py-16 text-center space-y-2">
        <Bell className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
        <p className="text-xs text-muted-foreground/60">
          You'll see likes, comments, follows, and updates here
        </p>
      </div>
    </div>
  );
}
