'use client';

import { useState } from 'react';
import { Sword, Plus, X } from 'lucide-react';
import { Button } from './ui/Button';
import { newQuestId } from '@/lib/client/storage';

interface MainQuestDraft {
  id: string;
  title: string;
  description: string;
}

interface Props {
  onConfirm: (quests: MainQuestDraft[]) => void;
}

/**
 * 主线任务录入器
 *
 * 主线必须由用户自己输入（不提供模板），保留"独特感"。
 * 我们只负责整理（前端 state，不做后端调用）。
 */
export function MainQuestEditor({ onConfirm }: Props) {
  const [drafts, setDrafts] = useState<MainQuestDraft[]>([
    { id: newQuestId(), title: '', description: '' }
  ]);

  function update(i: number, patch: Partial<MainQuestDraft>) {
    setDrafts(d => d.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function remove(i: number) {
    setDrafts(d => (d.length === 1 ? d : d.filter((_, idx) => idx !== i)));
  }
  function add() {
    setDrafts(d => [...d, { id: newQuestId(), title: '', description: '' }]);
  }

  const valid = drafts.every(q => q.title.trim().length > 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sword size={14} className="text-accent-gold" />
          <span className="font-display tracking-widest text-xs text-accent-gold">
            MAIN QUESTS · 主线任务
          </span>
        </div>
        <p className="text-sm text-text-dim leading-relaxed">
          这里不给模板。主线只能由你自己写——用你自己的话，写出此刻你愿意为之走下去的方向。
          <span className="text-text-mute">（可以多条，1-5 个为宜）</span>
        </p>
      </div>

      <div className="space-y-3">
        {drafts.map((q, i) => (
          <div key={q.id} className="relative bg-bg-card border-l-2 border-accent-gold border border-line p-4 cut-br animate-fade-in">
            <div className="absolute -top-2 left-3 font-mono text-[9px] tracking-widest text-accent-gold bg-bg px-2 py-0.5 border border-accent-gold/40">
              MAIN {String(i + 1).padStart(2, '0')}
            </div>
            {drafts.length > 1 && (
              <button
                onClick={() => remove(i)}
                className="absolute top-2 right-2 p-1 text-text-mute hover:text-accent-flame transition"
                aria-label="删除"
              >
                <X size={14} />
              </button>
            )}

            <input
              value={q.title}
              onChange={e => update(i, { title: e.target.value })}
              placeholder="例：一年内考研上岸 / 把副业做到月入五位数 / 成为我自己想成为的人"
              className="w-full bg-transparent text-base text-text border-b border-line focus:border-accent-gold outline-none pb-2 mb-3 transition"
            />
            <textarea
              value={q.description}
              onChange={e => update(i, { description: e.target.value })}
              placeholder="为什么是这件事？为什么是现在？（可选，但建议写）"
              rows={2}
              className="w-full bg-transparent text-sm text-text-dim placeholder:text-text-mute outline-none resize-none"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-text-dim hover:text-accent-gold text-sm transition"
        >
          <Plus size={14} />
          再加一条主线
        </button>
        <Button
          variant="primary"
          size="lg"
          disabled={!valid}
          onClick={() =>
            onConfirm(
              drafts
                .filter(q => q.title.trim())
                .map(q => ({ ...q, title: q.title.trim(), description: q.description.trim() }))
            )
          }
        >
          下一步 · 选择支线模板 →
        </Button>
      </div>
    </div>
  );
}
