'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Sword, Compass, Circle, CircleCheck, Plus, X, ArrowLeft } from 'lucide-react';
import { QuestData, newQuestId } from '@/lib/client/storage';

import { SideQuestTemplates, templateSelectionsToQuestData } from './SideQuestTemplates';

interface Props {
  data: QuestData;
  onChange: (data: QuestData) => void;
  /** 用户点击子任务的"完成"按钮时回调，传父级 ID */
  onCompleteSubTask?: (subTaskId: string) => void;
}

export function QuestSidebar({ data, onChange, onCompleteSubTask }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newSubTitle, setNewSubTitle] = useState<Record<string, string>>({});
  const [addMainOpen, setAddMainOpen] = useState(false);
  const [addSideOpen, setAddSideOpen] = useState(false);

  function toggle(id: string) {
    setExpanded(s => ({ ...s, [id]: !s[id] }));
  }

  function addSubTask(parentId: string) {
    const title = (newSubTitle[parentId] ?? '').trim();
    if (!title) return;
    const next: QuestData = {
      ...data,
      subTasks: [...data.subTasks, { id: newQuestId(), title, parentId }]
    };
    onChange(next);
    setNewSubTitle(s => ({ ...s, [parentId]: '' }));
  }

  // ── 添加主线弹窗（最原始的简单版本）
  function AddMainModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (q: { title: string; description: string }) => void }) {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    function submit() {
      const t = title.trim();
      if (!t) return;
      onSubmit({ title: t, description: desc.trim() });
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md bg-bg-card border border-line cut-both animate-slide-up">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line">
            <span className="font-display tracking-widest text-xs text-accent-gold">ADD MAIN QUEST · 添加主线</span>
            <button onClick={onClose} className="text-text-dim hover:text-accent-flame transition">
              <X size={16} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-text-dim mb-1.5">任务标题</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="输入主线任务名称…"
                className="w-full bg-bg border border-line px-3 py-2 text-sm text-text-main placeholder:text-text-dim/50 outline-none focus:border-accent-gold transition"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && title.trim()) submit(); }}
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">任务描述（可选）</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="简要描述这个主线任务…"
                rows={3}
                className="w-full bg-bg border border-line px-3 py-2 text-sm text-text-main placeholder:text-text-dim/50 outline-none focus:border-accent-gold transition resize-none"
              />
            </div>
            <button
              onClick={submit}
              disabled={!title.trim()}
              className="w-full py-2.5 text-sm font-medium text-bg bg-accent-gold hover:bg-accent-gold/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              确认添加
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderQuestList(
    list: Array<{ id: string; title: string; description?: string }>,
    type: 'main' | 'side'
  ) {
    if (list.length === 0) {
      return (
        <div className="px-3 py-3 text-[11px] text-text-mute font-mono italic">
          {type === 'main' ? '尚未设定 · 由你自己写' : '尚未选择 · 可从模板挑选'}
        </div>
      );
    }
    return list.map(q => {
      const subs = data.subTasks.filter(s => s.parentId === q.id);
      const isOpen = expanded[q.id] ?? true;
      const accent = type === 'main' ? 'border-l-accent-gold' : 'border-l-accent-violet';
      const dot = type === 'main' ? 'text-accent-gold' : 'text-accent-violet';

      return (
        <div key={q.id} className={`border-l-2 ${accent} pl-3 mb-2`}>
          <button
            onClick={() => toggle(q.id)}
            className="w-full flex items-start gap-2 py-1.5 text-left group"
          >
            {isOpen ? (
              <ChevronDown size={14} className="text-text-dim mt-0.5 shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-text-dim mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Sword size={12} className={dot} />
                <span className="text-sm text-text group-hover:text-accent-gold transition truncate">
                  {q.title}
                </span>
              </div>
              {q.description && (
                <div className="text-[11px] text-text-dim mt-0.5 line-clamp-2">{q.description}</div>
              )}
            </div>
            <span className="text-[10px] font-mono text-text-mute shrink-0 mt-1">{subs.length}</span>
          </button>

          {isOpen && (
            <div className="ml-5 mt-1 space-y-1">
              {subs.map(s => (
                <button
                  key={s.id}
                  onClick={() => onCompleteSubTask?.(s.id)}
                  className="w-full flex items-center gap-2 py-1 px-2 text-left rounded hover:bg-bg-elevated transition group"
                  disabled={s.done}
                >
                  {s.done ? (
                    <CircleCheck size={12} className="text-accent-cyan shrink-0" />
                  ) : (
                    <Circle size={12} className="text-text-mute shrink-0 group-hover:text-accent-gold" />
                  )}
                  <span
                    className={`text-xs truncate ${
                      s.done ? 'line-through text-text-mute' : 'text-text-dim group-hover:text-text'
                    }`}
                  >
                    {s.title}
                  </span>
                </button>
              ))}

              {/* 添加子任务 */}
              <div className="flex gap-1 mt-1.5">
                <input
                  value={newSubTitle[q.id] ?? ''}
                  onChange={e =>
                    setNewSubTitle(s => ({ ...s, [q.id]: e.target.value }))
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter') addSubTask(q.id);
                  }}
                  placeholder="新增子任务…"
                  className="flex-1 bg-bg-deep border border-line text-xs text-text px-2 py-1 cut-tl placeholder:text-text-mute focus:border-accent-gold outline-none"
                />
                <button
                  onClick={() => addSubTask(q.id)}
                  className="p-1 border border-line text-text-dim hover:text-accent-gold hover:border-accent-gold cut-tl"
                  aria-label="添加"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <aside className="h-full bg-bg-card/80 border border-line cut-both backdrop-blur-sm overflow-y-auto">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 font-display tracking-widest text-xs text-text-dim">
          <Compass size={12} className="text-accent-gold" />
          <span>QUEST · 任务面板</span>
        </div>
      </div>

      {/* 主线 */}
      <section className="px-2 py-3">
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent-gold">MAIN</span>
          <button
            onClick={() => setAddMainOpen(true)}
            className="flex items-center gap-1 text-[10px] font-mono text-text-dim hover:text-accent-gold transition"
          >
            <Plus size={10} />
            添加
          </button>
        </div>
        {renderQuestList(data.mainQuests, 'main')}
      </section>

      <div className="mx-3 h-px bg-line my-2" />

      {/* 支线 */}
      <section className="px-2 py-3 pb-6">
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent-violet">SIDE</span>
          <button
            onClick={() => setAddSideOpen(true)}
            className="flex items-center gap-1 text-[10px] font-mono text-text-dim hover:text-accent-violet transition"
          >
            <Plus size={10} />
            添加
          </button>
        </div>
        {renderQuestList(data.sideQuests, 'side')}
      </section>

      {/* 添加主线弹窗 */}
      {addMainOpen && (
        <AddMainModal
          onClose={() => setAddMainOpen(false)}
          onSubmit={({ title, description }) => {
            const next: QuestData = {
              ...data,
              mainQuests: [
                ...data.mainQuests,
                { id: newQuestId(), title: title.trim(), description: description.trim() || undefined }
              ]
            };
            onChange(next);
            setAddMainOpen(false);
          }}
        />
      )}

      {/* 添加支线弹窗 */}
      {addSideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm" onClick={() => setAddSideOpen(false)} />
          <div className="relative w-[95vw] h-[90vh] bg-bg-card border border-line cut-both animate-slide-up flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
              <span className="font-display tracking-widest text-xs text-accent-violet">ADD SIDE QUESTS · 添加支线</span>
              <button
                onClick={() => setAddSideOpen(false)}
                className="flex items-center gap-1 text-xs text-text-dim hover:text-accent-flame transition"
              >
                <ArrowLeft size={14} />
                返回
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mt-8">
                <SideQuestTemplates
                  onConfirm={selections => {
                    const { side, subs } = templateSelectionsToQuestData(selections);
                    const next: QuestData = {
                      ...data,
                      sideQuests: [
                        ...data.sideQuests,
                        ...side.map(s => ({ id: s.id, title: s.title, templateKey: s.templateKey }))
                      ],
                      subTasks: [...data.subTasks, ...subs]
                    };
                    onChange(next);
                    setAddSideOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
