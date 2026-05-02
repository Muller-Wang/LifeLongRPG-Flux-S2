'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Square } from 'lucide-react';
import { chatStream, getAffinityState } from '@/lib/client/api';
import { useAuth } from './auth/AuthProvider';
import { getHomeGreetingLine } from '@/lib/feixia-scripted';
import { parseEmotion, getEmojiUrl } from '@/lib/emotion-map';

export interface DialogueMessage {
  role: 'user' | 'feixia';
  text: string;
  timestamp: number;
  emotion?: string | null;
}

interface Props {
  /** 父级提供的初始一句（onboarding 进入时由父级注入）*/
  initialMessage?: string;
  /** 当绯夏开始/结束说话时通知父级（用于立绘动画）*/
  onSpeakingChange?: (speaking: boolean) => void;
  /** 当好感度可能变化时通知父级（让 ProfileBar 刷新）*/
  onAffinityMaybeChanged?: () => void;
}

export function DialogueArea({
  initialMessage,
  onSpeakingChange,
  onAffinityMaybeChanged
}: Props) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [greetingStage, setGreetingStage] = useState<1 | 2 | 3 | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 注入初始消息（onboarding 进入 home 时父级可强制注入）
  useEffect(() => {
    if (initialMessage) {
      setMessages([
        { role: 'feixia', text: initialMessage, timestamp: Date.now(), emotion: null }
      ]);
    }
  }, [initialMessage]);

  // 拉一次好感度阶段（决定开场词的冷暖度）
  useEffect(() => {
    if (!user?.id || greetingStage !== null) return;
    getAffinityState(user.id).then(s => setGreetingStage(s.stage));
  }, [user, greetingStage]);

  // 绯夏主动开场（messages 为空 + 已知 stage + 拿到昵称）
  useEffect(() => {
    if (messages.length > 0) return;
    if (greetingStage === null) return;
    const name = profile?.displayName?.trim();
    if (!name) return;
    const greeting = getHomeGreetingLine(name, greetingStage);
    const greetingEmotion = greetingStage === 3 ? 'shy' : greetingStage === 2 ? 'notice' : 'speechless';
    setMessages([{ role: 'feixia', text: greeting, timestamp: Date.now(), emotion: greetingEmotion }]);
    onSpeakingChange?.(true);
    const dur = Math.max(1500, greeting.length * 90);
    const timer = setTimeout(() => onSpeakingChange?.(false), dur);
    return () => clearTimeout(timer);
  }, [greetingStage, profile, messages.length, onSpeakingChange]);

  // 自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;

    const uid = user?.id;
    if (!uid) return;

    const startTs = Date.now();
    setMessages(m => [
      ...m,
      { role: 'user', text, timestamp: startTs, emotion: null },
      { role: 'feixia', text: '', timestamp: startTs + 1, emotion: null }
    ]);
    setInput('');
    setPending(true);
    setAwaitingFirstToken(true);
    onSpeakingChange?.(true);

    abortRef.current = new AbortController();

    try {
      await chatStream(uid, text, {
        onToken: delta => {
          setAwaitingFirstToken(false);
          setMessages(m => {
            const last = m[m.length - 1];
            if (!last || last.role !== 'feixia') return m;
            const updated = { ...last, text: last.text + delta };
            return [...m.slice(0, -1), updated];
          });
        },
        onDone: result => {
          const { cleanText, emotion: parsedEmotion } = parseEmotion(result.reply);
          setMessages(m => {
            const last = m[m.length - 1];
            if (!last || last.role !== 'feixia') return m;
            const updated = {
              ...last,
              text: cleanText || result.reply,
              emotion: result.emotion ?? parsedEmotion
            };
            return [...m.slice(0, -1), updated];
          });
        }
      }, undefined, abortRef.current.signal);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户主动中断，静默处理
      } else {
        console.warn('[DialogueArea] chatStream error:', err);
      }
    } finally {
      setMessages(m => {
        const last = m[m.length - 1];
        if (last && last.role === 'feixia' && !last.text) {
          return [...m.slice(0, -1), { ...last, text: '……' }];
        }
        return m;
      });
      setAwaitingFirstToken(false);
      setPending(false);
      onSpeakingChange?.(false);
      onAffinityMaybeChanged?.();
    }
  }

  const showTypingDots = pending && awaitingFirstToken;

  return (
    <section className="flex flex-col h-full bg-bg-card/60 border border-line cut-both backdrop-blur-sm">
      {/* 标题 */}
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent-cyan" />
          <span className="font-display tracking-widest text-xs text-text-dim">
            DIALOGUE · 对话
          </span>
        </div>
        <span className="font-mono text-[10px] text-text-mute">FEIXIA · 緋夏</span>
      </div>

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !pending && (
          <div className="text-center text-text-mute font-mono text-xs italic mt-12">
            …她在等你说话。
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {showTypingDots && (
          <div className="flex items-center gap-2 text-accent-cyan animate-fade-in">
            <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-pulse" />
            <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-pulse [animation-delay:0.4s]" />
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-line p-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="对她说点什么……"
          disabled={pending}
          className="flex-1 bg-white border-2 border-line text-sm text-text-display placeholder:text-text-mute/70 px-4 py-2.5 cut-tl outline-none focus:border-accent-flame focus:bg-white transition"
        />
        {pending ? (
          <button
            onClick={() => {
              abortRef.current?.abort();
              setPending(false);
              setAwaitingFirstToken(false);
              onSpeakingChange?.(false);
            }}
            className="px-4 py-2.5 bg-accent-warning text-white cut-tl border border-accent-warning hover:shadow-[0_0_18px_rgba(196,122,92,0.45)] transition"
            aria-label="停止"
            title="停止生成"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!input.trim()}
            className="px-4 py-2.5 bg-accent-flame text-white cut-tl border border-accent-flame hover:shadow-[0_0_18px_rgba(230,57,70,0.45)] transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="发送"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </section>
  );
}

function Bubble({ message }: { message: DialogueMessage }) {
  const isUser = message.role === 'user';
  const emojiUrl = message.emotion ? getEmojiUrl(message.emotion) : null;
  return (
    <div className={`animate-fade-in flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`font-mono text-[9px] tracking-widest mb-1 ${
            isUser ? 'text-right text-text-mute' : 'text-accent-flame'
          }`}
        >
          {isUser ? 'YOU' : 'FEIXIA · 緋夏'}
        </div>
        <div
          className={[
            'px-4 py-2.5 cut-tl border-2 text-sm leading-relaxed shadow-[0_2px_6px_rgba(8,75,131,0.06)]',
            isUser
              // 用户气泡：Yale Blue 实色 + 白文字（高对比）
              ? 'bg-accent-flame border-accent-flame text-white'
              // 绯夏气泡：白底 + Yale Blue 描边 + 深色字（高对比）
              : 'bg-bg-card border-accent-flame/40 text-text-display'
          ].join(' ')}
        >
          {message.text}
        </div>
        {!isUser && emojiUrl && (
          <div className="mt-2 animate-fade-in">
            <img
              src={emojiUrl}
              alt={`emotion: ${message.emotion}`}
              className="w-40 h-40 object-contain"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}
