"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, MessageCircle, Paperclip, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  user_id: string;
  sender_name: string;
  sender_role: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  // null = the general team room; set = that container's conversation.
  container_number: string | null;
  created_at: string;
}

interface ChatContainer {
  number: string;
  status: string;
}

const BUCKET = "chat-attachments";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The bucket is private, so a file is shown through a short-lived signed
// link fetched when the message renders, never a permanent public URL.
function Attachment({ message }: { message: ChatMessage }) {
  const [url, setUrl] = useState<string | null>(null);
  const path = message.attachment_path;

  useEffect(() => {
    if (!supabase || !path) return;
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) return null;
  if (!url) return <div className="mt-1 text-[11px] opacity-70">Loading attachment…</div>;

  if (message.attachment_type?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={message.attachment_name ?? "Attachment"}
          className="mt-1 max-h-48 rounded-lg"
        />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-1.5 text-[12px] underline"
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{message.attachment_name ?? "Attachment"}</span>
    </a>
  );
}

export function ChatWidget({
  userName,
  userRole,
  containers,
}: {
  userName: string;
  userRole: string;
  containers: ChatContainer[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"team" | "containers">("team");
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  const [pickedContainer, setPickedContainer] = useState("");
  const [threadReads, setThreadReads] = useState<Record<string, string>>({});

  // Refs so the realtime listener (set up once) always sees current values.
  const viewRef = useRef<{ open: boolean; tab: "team" | "containers"; thread: string | null }>({
    open: false,
    tab: "team",
    thread: null,
  });
  const myIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    viewRef.current = { open, tab, thread: activeContainer };
  }, [open, tab, activeContainer]);

  const markRead = useCallback(async (userId: string) => {
    if (!supabase) return;
    await supabase
      .from("chat_reads")
      .upsert({ user_id: userId, last_read_at: new Date().toISOString() });
  }, []);

  // upTo is a message's own server timestamp, not this device's clock, so
  // a wrong local clock can't leave a read thread looking unread.
  const markThreadRead = useCallback(async (userId: string, container: string, upTo: string) => {
    if (!supabase) return;
    setThreadReads((prev) => ({ ...prev, [container]: upTo }));
    await supabase
      .from("chat_thread_reads")
      .upsert({ user_id: userId, container_number: container, last_read_at: upTo });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    async function init() {
      const { data: auth } = await client.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || cancelled) return;
      myIdRef.current = uid;
      setMyId(uid);

      const [{ data: team }, { data: threadMsgs }, { data: read }, { data: tReads }] =
        await Promise.all([
          client
            .from("chat_messages")
            .select("*")
            .is("container_number", null)
            .order("created_at", { ascending: false })
            .limit(100),
          client
            .from("chat_messages")
            .select("*")
            .not("container_number", "is", null)
            .order("created_at", { ascending: false })
            .limit(300),
          client.from("chat_reads").select("last_read_at").eq("user_id", uid).maybeSingle(),
          client.from("chat_thread_reads").select("container_number, last_read_at").eq("user_id", uid),
        ]);
      if (cancelled) return;
      setMessages([
        ...((team ?? []) as ChatMessage[]).reverse(),
        ...((threadMsgs ?? []) as ChatMessage[]).reverse(),
      ]);
      setThreadReads(
        Object.fromEntries(
          (tReads ?? []).map((r) => [r.container_number as string, r.last_read_at as string])
        )
      );

      const lastRead = read?.last_read_at as string | undefined;
      if (lastRead) {
        const { count } = await client
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .gt("created_at", lastRead)
          .is("container_number", null)
          .neq("user_id", uid);
        if (!cancelled) setUnread(count ?? 0);
      } else {
        // First time this person has the chat: the existing history isn't
        // "new" to them, so start from now instead of badging everything.
        await markRead(uid);
      }
      if (cancelled) return;

      channel = client
        .channel("chat-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const msg = payload.new as ChatMessage;
            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
            if (msg.user_id === myIdRef.current) return;
            const view = viewRef.current;
            if (msg.container_number) {
              // Thread unread counts are derived from timestamps below; only
              // a thread being looked at right now needs marking as read.
              if (view.open && view.tab === "containers" && view.thread === msg.container_number) {
                void markThreadRead(uid, msg.container_number, msg.created_at);
              }
              return;
            }
            if (view.open && view.tab === "team") void markRead(uid);
            else setUnread((n) => n + 1);
          }
        )
        .subscribe();
      if (cancelled) client.removeChannel(channel);
    }
    init();

    return () => {
      cancelled = true;
      if (channel) client.removeChannel(channel);
    };
  }, [markRead, markThreadRead]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, tab, activeContainer, messages]);

  const canStartThread = userRole === "Admin" || userRole === "Logistics Manager";
  const teamMessages = messages.filter((m) => !m.container_number);
  const time = (iso: string | undefined) => (iso ? new Date(iso).getTime() : 0);

  const threadMap = new Map<string, { last: ChatMessage; unread: number }>();
  for (const m of messages) {
    if (!m.container_number) continue;
    const t = threadMap.get(m.container_number) ?? { last: m, unread: 0 };
    if (time(m.created_at) >= time(t.last.created_at)) t.last = m;
    if (m.user_id !== myId && time(m.created_at) > time(threadReads[m.container_number])) t.unread += 1;
    threadMap.set(m.container_number, t);
  }
  const threads = [...threadMap.entries()].sort(
    (a, b) => time(b[1].last.created_at) - time(a[1].last.created_at)
  );
  const threadUnread = threads.reduce((n, [, t]) => n + t.unread, 0);
  const totalUnread = unread + threadUnread;
  const statusFor = (number: string) => containers.find((c) => c.number === number)?.status ?? "";

  function showTeam() {
    setTab("team");
    setUnread(0);
    if (myId) void markRead(myId);
  }

  function openThread(container: string) {
    setActiveContainer(container);
    const latest = threadMap.get(container)?.last.created_at;
    if (myId && latest) void markThreadRead(myId, container, latest);
  }

  function openChat() {
    setOpen(true);
    if (tab === "team") {
      setUnread(0);
      if (myId) void markRead(myId);
    } else if (activeContainer) {
      openThread(activeContainer);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!supabase || !myId || sending || (!text && !file)) return;
    if (file && file.size > MAX_FILE_BYTES) {
      setError("That file is too large — the limit is 10 MB.");
      return;
    }

    // Which conversation this message belongs to: the open container
    // thread, or null for the general team room.
    const scope = tab === "containers" ? activeContainer : null;

    setSending(true);
    setError(null);

    let attachment: Partial<ChatMessage> = {};
    if (file) {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${myId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) {
        setSending(false);
        setError(`Couldn't upload the file: ${uploadError.message}`);
        return;
      }
      attachment = {
        attachment_path: path,
        attachment_name: file.name,
        attachment_type: file.type || null,
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        user_id: myId,
        sender_name: userName,
        sender_role: userRole,
        body: text || null,
        container_number: scope,
        ...attachment,
      })
      .select()
      .single();

    setSending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    // Added straight away rather than waiting on the realtime echo, so the
    // sender sees their own message even if the live connection is down.
    const msg = inserted as ChatMessage;
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    setDraft("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!supabase || !myId) return null;

  const renderMessages = (list: ChatMessage[], emptyText: string) => (
    <div className="flex-1 space-y-3 overflow-y-auto bg-page px-3 py-3">
      {list.length === 0 && (
        <p className="mt-6 text-center text-[12.5px] text-text-tertiary">{emptyText}</p>
      )}
      {list.map((m) => {
        const mine = m.user_id === myId;
        return (
          <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
            {!mine && (
              <div className="mb-0.5 px-1 text-[11px] text-text-tertiary">
                <span className="font-medium text-text-secondary">{m.sender_name}</span> ·{" "}
                {m.sender_role}
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-[13px]",
                mine ? "bg-accent text-white" : "border border-border bg-surface text-text-primary"
              )}
            >
              {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
              <Attachment message={m} />
            </div>
            <div className="mt-0.5 px-1 text-[10px] text-text-tertiary">{formatTime(m.created_at)}</div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );

  const composer = (
    <form onSubmit={handleSend} className="border-t border-border p-3">
      {file && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-page px-2.5 py-1.5 text-[12px] text-text-secondary">
          <span className="flex min-w-0 items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a file"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-page"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-border px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || (!draft.trim() && !file)}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );

  const tabButton = (id: "team" | "containers", label: string, count: number) => (
    <button
      type="button"
      onClick={() => (id === "team" ? showTeam() : setTab("containers"))}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[13px] font-medium",
        tab === id
          ? "border-accent text-accent"
          : "border-transparent text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
      {count > 0 && (
        <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openChat}
        aria-label={open ? "Close team chat" : "Open team chat"}
        className={cn(
          "fixed bottom-4 right-4 z-[1050] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:bg-accent/90",
          open && "max-sm:hidden"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {totalUnread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-6 min-w-6 animate-pulse items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1050] flex flex-col bg-surface sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[560px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-text-primary">Team chat</div>
              <div className="text-[11px] text-text-tertiary">Everyone in the system can see this</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close team chat"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-page"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex border-b border-border bg-surface">
            {tabButton("team", "Team", unread)}
            {tabButton("containers", "Containers", threadUnread)}
          </div>

          {tab === "team" && (
            <>
              {renderMessages(teamMessages, "No messages yet — say hello.")}
              {composer}
            </>
          )}

          {tab === "containers" && !activeContainer && (
            <div className="flex-1 overflow-y-auto bg-page">
              {canStartThread && (
                <div className="border-b border-border bg-surface p-3">
                  <div className="mb-1.5 text-[12px] font-medium text-text-secondary">
                    Start a conversation about a container
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={pickedContainer}
                      onChange={(e) => setPickedContainer(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-[13px] focus:border-accent focus:outline-none"
                    >
                      <option value="">Choose a container…</option>
                      {containers
                        .filter((c) => !threadMap.has(c.number))
                        .map((c) => (
                          <option key={c.number} value={c.number}>
                            {c.number} — {c.status}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!pickedContainer}
                      onClick={() => {
                        setActiveContainer(pickedContainer);
                        setPickedContainer("");
                      }}
                      className="rounded-lg bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                    >
                      Start
                    </button>
                  </div>
                </div>
              )}

              {threads.length === 0 && (
                <p className="mt-6 text-center text-[12.5px] text-text-tertiary">
                  No container conversations yet.
                </p>
              )}
              {threads.map(([number, t]) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => openThread(number)}
                  className="flex w-full items-start gap-3 border-b border-border bg-surface px-4 py-3 text-left hover:bg-page"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-text-primary">{number}</span>
                      <span className="shrink-0 text-[10px] text-text-tertiary">
                        {formatTime(t.last.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-tertiary">{statusFor(number)}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-text-secondary">
                      {t.last.sender_name}: {t.last.body ?? "Attachment"}
                    </div>
                  </div>
                  {t.unread > 0 && (
                    <span className="mt-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      {t.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === "containers" && activeContainer && (
            <>
              <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
                <button
                  type="button"
                  onClick={() => setActiveContainer(null)}
                  aria-label="Back to container conversations"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-page"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="text-[13px] font-semibold text-text-primary">{activeContainer}</div>
                  <div className="text-[11px] text-text-tertiary">{statusFor(activeContainer)}</div>
                </div>
              </div>
              {renderMessages(
                messages.filter((m) => m.container_number === activeContainer),
                canStartThread
                  ? `Write the first update about ${activeContainer} — it starts the conversation.`
                  : "No messages yet."
              )}
              {composer}
            </>
          )}
        </div>
      )}
    </>
  );
}
