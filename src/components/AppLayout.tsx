import { ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, ClipboardList, BarChart3, Layers, Settings, ChevronDown, Plus, Trash2, Building2, Calendar, Check, X } from "lucide-react";
import rostrLogo from "@/assets/rostr-logo.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "@/contexts/SessionContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const navItems = [
  { path: "/", icon: Users, label: "Roster" },
  { path: "/score", icon: ClipboardList, label: "Score" },
  { path: "/dashboard", icon: BarChart3, label: "Stats" },
  { path: "/roster-board", icon: Layers, label: "Board" },
  { path: "/settings", icon: Settings, label: "More" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { coach, allCoaches, organizations, currentOrg, switchProgram, switchOrg, deleteProgram } = useAuth();
  const { sessions, selectedSessionId, setSession, createSession, currentSession } = useSession();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deleteProgram(deleteTarget.id);
    if (ok) {
      toast.success("Program deleted");
      navigate("/");
    } else {
      toast.error("Failed to delete program");
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  // Group coaches by organization
  const coachesByOrg = new Map<string, typeof allCoaches>();
  allCoaches.forEach((c) => {
    const orgId = c.organization_id || "unknown";
    const list = coachesByOrg.get(orgId) || [];
    list.push(c);
    coachesByOrg.set(orgId, list);
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with org + program switcher */}
      {allCoaches.length > 0 && (
        <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-lg items-center px-4 py-2.5">
            <img src={rostrLogo} alt="Rostr" className="h-7 w-7 rounded-lg object-cover shrink-0" />
            <div className="flex-1 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-colors hover:bg-muted focus:outline-none">
                  {coach?.logo_url && (
                    <img src={coach.logo_url} alt="" className="h-5 w-5 rounded-md object-cover shrink-0" />
                  )}
                  <div className="flex flex-col items-start">
                    {organizations.length > 1 && currentOrg && (
                      <span className="text-[10px] text-muted-foreground font-medium leading-none">{currentOrg.name}</span>
                    )}
                    <span className="truncate max-w-[200px]">{coach?.program_name || "Select Program"}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64 bg-popover border shadow-lg z-50">
                  {/* If multiple orgs, group by org */}
                  {organizations.length > 1 ? (
                    organizations.map((org) => {
                      const orgCoaches = coachesByOrg.get(org.id) || [];
                      return (
                        <div key={org.id}>
                          <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
                            <Building2 className="h-3 w-3" />
                            {org.name}
                          </DropdownMenuLabel>
                          {orgCoaches.map((c) => (
                            <DropdownMenuItem
                              key={c.id}
                              onClick={() => { switchProgram(c.id); navigate("/"); }}
                              className={cn("cursor-pointer font-medium group pl-6", c.id === coach?.id && "bg-accent")}
                            >
                              <span className="truncate flex-1 flex items-center gap-1.5">
                                {c.logo_url && <img src={c.logo_url} alt="" className="h-4 w-4 rounded object-cover shrink-0" />}
                                {c.program_name}
                              </span>
                              {c.id === coach?.id && <span className="text-xs text-primary font-bold">✓</span>}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: c.program_id, name: c.program_name || "this program" }); }}
                                className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 rounded"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                        </div>
                      );
                    })
                  ) : (
                    /* Single org - flat list */
                    allCoaches.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => { switchProgram(c.id); navigate("/"); }}
                        className={cn("cursor-pointer font-medium group", c.id === coach?.id && "bg-accent")}
                      >
                        <span className="truncate flex-1 flex items-center gap-1.5">
                          {c.logo_url && <img src={c.logo_url} alt="" className="h-4 w-4 rounded object-cover shrink-0" />}
                          {c.program_name}
                        </span>
                        {c.id === coach?.id && <span className="text-xs text-primary font-bold">✓</span>}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: c.program_id, name: c.program_name || "this program" }); }}
                          className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/setup")} className="cursor-pointer font-medium text-primary">
                    <Plus className="mr-2 h-4 w-4" /> New Program
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Session chip */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold transition-colors hover:bg-muted focus:outline-none max-w-[130px]">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedSessionId === "all" ? "All Sessions" : (currentSession?.name || "Session")}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border shadow-lg z-50">
                <DropdownMenuItem
                  onClick={() => setSession("all")}
                  className={cn("cursor-pointer font-medium", selectedSessionId === "all" && "bg-accent")}
                >
                  <span className="flex-1">All Sessions</span>
                  {selectedSessionId === "all" && <span className="text-xs text-primary font-bold">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setSession(s.id)}
                    className={cn("cursor-pointer font-medium", selectedSessionId === s.id && "bg-accent")}
                  >
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-1 shrink-0">{format(new Date(s.session_date + "T00:00:00"), "MMM d")}</span>
                    {selectedSessionId === s.id && <span className="text-xs text-primary font-bold ml-1">✓</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {showNewSession ? (
                  <div className="px-2 py-1.5 flex gap-1.5">
                    <Input
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="Session name..."
                      className="h-8 text-xs rounded-lg flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSessionName.trim()) {
                          setCreatingSession(true);
                          createSession(newSessionName).then((s) => {
                            if (s) toast.success(`Session "${s.name}" created`);
                            else toast.error("Failed to create session");
                            setShowNewSession(false);
                            setNewSessionName("");
                            setCreatingSession(false);
                          });
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!newSessionName.trim()) return;
                        setCreatingSession(true);
                        createSession(newSessionName).then((s) => {
                          if (s) toast.success(`Session "${s.name}" created`);
                          else toast.error("Failed to create session");
                          setShowNewSession(false);
                          setNewSessionName("");
                          setCreatingSession(false);
                        });
                      }}
                      disabled={!newSessionName.trim() || creatingSession}
                      className="text-primary hover:text-primary/80 disabled:opacity-50 p-1"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setShowNewSession(false); setNewSessionName(""); }} className="text-muted-foreground hover:text-foreground p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <DropdownMenuItem onClick={() => setShowNewSession(true)} className="cursor-pointer font-medium text-primary">
                    <Plus className="mr-2 h-4 w-4" /> New Session
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/90 backdrop-blur-2xl shadow-nav">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 tap-target transition-all duration-300 ease-out",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && <span className="absolute inset-0 rounded-2xl bg-primary/8 animate-scale-in" />}
                <Icon className={cn("relative z-10 h-5 w-5 transition-all duration-300", active && "scale-110")} strokeWidth={active ? 2.5 : 1.8} />
                <span className={cn("relative z-10 text-[10px] transition-all duration-300", active ? "font-bold" : "font-medium")}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the program and all its players, scores, metrics, and roster assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete Program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
