"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, MessageCircle, Paperclip, Send, X } from "lucide-react";
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
  created_at: string;
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

export function ChatWidget({ userName, userRole }: { userName: string; userRole: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs so the realtime listener (set up once) always sees current values.
  const openRef = useRef(false);
  const myIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const markRead = useCallback(async (userId: string) => {
    if (!supabase) return;
    await supabase
      .from("chat_reads")
      .upsert({ user_id: userId, last_read_at: new Date().toISOString() });
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

      const [{ data: recent }, { data: read }] = await Promise.all([
        client
          .from("chat_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        client.from("chat_reads").select("last_read_at").eq("user_id", uid).maybeSingle(),
      ]);
      if (cancelled) return;
      setMessages(((recent ?? []) as ChatMessage[]).reverse());

      const lastRead = read?.last_read_at as string | undefined;
      if (lastRead) {
        const { count } = await client
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .gt("created_at", lastRead)
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
            if (openRef.current) void markRead(uid);
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
  }, [markRead]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages]);

  function openChat() {
    setOpen(true);
    setUnread(0);
    if (myId) void markRead(myId);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!supabase || !myId || sending || (!text && !file)) return;
    if (file && file.size > MAX_FILE_BYTES) {
      setError("That file is too large — the limit is 10 MB.");
      return;
    }

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
        {unread > 0 && !open && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-6 min-w-6 animate-pulse items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
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

          <div className="flex-1 space-y-3 overflow-y-auto bg-page px-3 py-3">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-[12.5px] text-text-tertiary">
                No messages yet — say hello.
              </p>
            )}
            {messages.map((m) => {
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
        </div>
      )}
    </>
  );
}
