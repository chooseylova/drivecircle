import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { safeFormat, showError, toDate } from "@/lib/helpers";
import { isToday } from "date-fns";

export default function ChatWindow({ conversation, user, onUpdate }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const otherIdx = conversation.participant_emails?.indexOf(user?.email) === 0 ? 1 : 0;
  const otherName = conversation.participant_names?.[otherIdx] || conversation.participant_emails?.[otherIdx] || "User";
  const otherEmail = conversation.participant_emails?.[otherIdx];

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadMessages();
    let unsub;
    try {
      unsub = base44.entities.Message.subscribe((event) => {
        if (event.data?.conversation_id === conversation.id) {
          loadMessages();
        }
      });
    } catch {
      // realtime not available — fall back to polling below
    }
    const poll = setInterval(loadMessages, 15000);
    return () => {
      clearInterval(poll);
      if (typeof unsub === "function") unsub();
    };
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    try {
      // Newest 200, displayed oldest → newest
      const latest = await base44.entities.Message.filter({ conversation_id: conversation.id }, "-created_date", 200);
      setMessages((latest || []).slice().reverse());
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    try {
      const msg = await base44.entities.Message.create({
        conversation_id: conversation.id,
        sender_email: user.email,
        sender_name: user.full_name || user.email.split("@")[0],
        content,
        read_by: [user.email],
      });
      setMessages((prev) => (prev.some((m) => m.id === msg?.id) ? prev : [...prev, msg]));
      await base44.entities.Conversation.update(conversation.id, {
        last_message: content.slice(0, 200),
        last_message_date: new Date().toISOString(),
        last_message_sender: user.email,
      });
      onUpdate?.();
    } catch (err) {
      setText(content); // give the text back so it isn't lost
      showError(err, "Message didn't send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {otherName[0]?.toUpperCase()}
        </div>
        {otherEmail ? (
          <Link to={`/user/${encodeURIComponent(otherEmail)}`} className="font-semibold text-sm truncate hover:text-primary">{otherName}</Link>
        ) : (
          <span className="font-semibold text-sm truncate">{otherName}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Say hi to {otherName}!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_email === user?.email;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] md:max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                  isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {safeFormat(msg.created_date, isToday(toDate(msg.created_date) || 0) ? "h:mm a" : "MMM d, h:mm a", "")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border/50 flex gap-2">
        <Input
          placeholder={`Message ${otherName}...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="bg-secondary border-border/50 flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || sending}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}