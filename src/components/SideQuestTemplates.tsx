'use client';

import { useState } from 'react';
import {
  BookOpen, Dumbbell, Brain, Briefcase, Heart, Sparkles,
  Check, ArrowRight, Plus, X, PenLine
} from 'lucide-react';
import { Button } from './ui/Button';
import { newQuestId } from '@/lib/client/storage';

interface CustomQuest {
  id: string;
  title: string;
  description: string;
  subs: string[];
}

interface Template {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  /** 选了这个模板后默认会建议给用户的子任务（前端展示用，提交后存为子任务）*/
  suggested: string[];
}

// 浅色主题：蓝系为主（80%），驼/暖色辅（15%）
const TEMPLATES: Template[] = [
  {
    key: 'study',
    title: '学业精进',
    description: '阅读 / 笔记 / 习题 / 一切让你更接近答案的事',
    icon: <BookOpen size={20} />,
    accent: '#084B83',  // Yale Blue
    suggested: ['每日阅读 30 分钟', '本周完成一个章节笔记', '每周一次错题复盘']
  },
  {
    key: 'fitness',
    title: '身体修炼',
    description: '运动 / 睡眠 / 饮食 / 与肉身的稳定盟约',
    icon: <Dumbbell size={20} />,
    accent: '#C47A5C',  // Warning · 偏暖红驼
    suggested: ['每周三次力量训练', '每日 8000 步', '23 点前入睡 5 天/周']
  },
  {
    key: 'thinking',
    title: '心智训练',
    description: '冥想 / 写作 / 复盘 / 把杂念转化为洞察',
    icon: <Brain size={20} />,
    accent: '#5A6A7E',  // Slate Grey · 内省
    suggested: ['每日 10 分钟冥想', '每周一篇 500 字复盘', '每月一次年度复盘']
  },
  {
    key: 'career',
    title: '事业拓展',
    description: '副业 / 作品 / 客户 / 把想法变成结果',
    icon: <Briefcase size={20} />,
    accent: '#A39171',  // Camel · 收获
    suggested: ['每周更新一次作品集', '每月与 2 位前辈 1on1', '每季度产出一个独立项目']
  },
  {
    key: 'relationship',
    title: '关系维护',
    description: '家人 / 朋友 / 那些你以为永远在的人',
    icon: <Heart size={20} />,
    accent: '#B89072',  // 浅驼 · 温度
    suggested: ['每周一通家人电话', '每月与挚友面谈一次', '记住三个人的生日']
  },
  {
    key: 'craft',
    title: '业余热爱',
    description: '画画 / 音乐 / 写作 / 那些不为生存的事',
    icon: <Sparkles size={20} />,
    accent: '#94B0DA',  // Powder Blue · 轻盈
    suggested: ['每周练习 5 小时', '每月一次小作品', '每季度公开发布一次']
  }
];

export interface SideQuestSelection {
  key: string;
  title: string;
  description: string;
  /** 用户选择本模板时同步采纳的子任务列表 */
  acceptedSubTasks: string[];
}

interface Props {
  onConfirm: (selections: SideQuestSelection[]) => void;
}

export function SideQuestTemplates({ onConfirm }: Props) {
  // key → 是否选中
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  // key → 用户对该模板下的子任务勾选状态（默认全选）
  const [subPicked, setSubPicked] = useState<Record<string, Record<number, boolean>>>({});
  // 用户自定义的支线列表
  const [customs, setCustoms] = useState<CustomQuest[]>([]);

  function togglePick(t: Template) {
    setPicked(p => ({ ...p, [t.key]: !p[t.key] }));
    if (!picked[t.key]) {
      setSubPicked(s => ({
        ...s,
        [t.key]: t.suggested.reduce(
          (acc, _, i) => ({ ...acc, [i]: true }),
          {} as Record<number, boolean>
        )
      }));
    }
  }
  function toggleSub(key: string, i: number) {
    setSubPicked(s => ({
      ...s,
      [key]: { ...(s[key] ?? {}), [i]: !(s[key]?.[i] ?? false) }
    }));
  }

  const pickedCount = Object.values(picked).filter(Boolean).length;
  const customValid = customs.filter(c => c.title.trim()).length;
  const totalCount = pickedCount + customValid;

  function confirm() {
    const fromTemplates: SideQuestSelection[] = TEMPLATES
      .filter(t => picked[t.key])
      .map(t => ({
        key: t.key,
        title: t.title,
        description: t.description,
        acceptedSubTasks: t.suggested.filter((_, i) => subPicked[t.key]?.[i])
      }));
    const fromCustoms: SideQuestSelection[] = customs
      .filter(c => c.title.trim())
      .map(c => ({
        key: `custom_${c.id}`,
        title: c.title.trim(),
        description: c.description.trim(),
        acceptedSubTasks: c.subs.filter(s => s.trim())
      }));
    onConfirm([...fromTemplates, ...fromCustoms]);
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-accent-violet" />
          <span className="font-display tracking-widest text-xs text-accent-violet">
            SIDE QUEST TEMPLATES · 支线模板
          </span>
        </div>
        <p className="text-sm text-text-dim leading-relaxed">
          支线我们准备了一些模板，帮你减轻"白板恐惧"。
          挑出此刻最相关的几个，你也可以勾选下面的预设子任务作为起点。
          <span className="text-text-mute">（建议挑 2-4 个）</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {TEMPLATES.map(t => {
          const isPicked = !!picked[t.key];
          return (
            <div
              key={t.key}
              className={[
                'relative bg-bg-card border cut-both transition-all duration-200',
                isPicked
                  ? 'border-accent-violet shadow-[0_0_24px_rgba(185,133,255,0.25)]'
                  : 'border-line hover:border-text-dim'
              ].join(' ')}
            >
              <button
                onClick={() => togglePick(t)}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <div
                  className="shrink-0 w-10 h-10 flex items-center justify-center cut-tl border"
                  style={{ color: t.accent, borderColor: `${t.accent}80`, background: `${t.accent}15` }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-text">{t.title}</h4>
                    {isPicked && (
                      <span className="flex items-center gap-1 font-mono text-[10px] text-accent-violet">
                        <Check size={10} /> 已选
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-dim mt-1 leading-relaxed">{t.description}</p>
                </div>
              </button>

              {/* 子任务勾选区（选中模板后才出现）*/}
              {isPicked && (
                <div className="px-4 pb-4 -mt-1 animate-fade-in">
                  <div className="font-mono text-[9px] tracking-widest text-text-mute mb-2 uppercase">
                    建议子任务（可勾选采纳）
                  </div>
                  <div className="space-y-1">
                    {t.suggested.map((s, i) => {
                      const checked = subPicked[t.key]?.[i] ?? false;
                      return (
                        <button
                          key={i}
                          onClick={() => toggleSub(t.key, i)}
                          className="w-full flex items-center gap-2 px-2 py-1 text-left rounded hover:bg-bg-elevated transition"
                        >
                          <span
                            className={[
                              'w-3 h-3 border flex items-center justify-center shrink-0',
                              checked ? 'bg-accent-violet border-accent-violet' : 'border-line'
                            ].join(' ')}
                          >
                            {checked && <Check size={8} className="text-white" />}
                          </span>
                          <span className={`text-xs ${checked ? 'text-text' : 'text-text-mute'}`}>
                            {s}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 自定义支线区域 */}
      <CustomSection customs={customs} setCustoms={setCustoms} />

      <div className="flex items-center justify-between pt-3 border-t border-line">
        <span className="font-mono text-[10px] tracking-widest text-text-dim">
          已选 <span className="text-accent-violet">{totalCount}</span>
          {customValid > 0 && (
            <span className="text-text-mute">（含自定义 {customValid}）</span>
          )}
          {' '}· 选 0 个也可以跳过
        </span>
        <Button variant="primary" size="lg" onClick={confirm} icon={<ArrowRight size={14} />}>
          完成设定 · 进入主页
        </Button>
      </div>
    </div>
  );
}

// ─── 自定义支线区 ──────────────────────────────────
function CustomSection({
  customs, setCustoms
}: {
  customs: CustomQuest[];
  setCustoms: (next: CustomQuest[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function addOne() {
    setCustoms([
      ...customs,
      { id: newQuestId(), title: '', description: '', subs: [''] }
    ]);
    setOpen(true);
  }
  function update(idx: number, patch: Partial<CustomQuest>) {
    setCustoms(customs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function remove(idx: number) {
    setCustoms(customs.filter((_, i) => i !== idx));
  }
  function addSub(idx: number) {
    update(idx, { subs: [...customs[idx].subs, ''] });
  }
  function updateSub(idx: number, j: number, val: string) {
    const next = customs[idx].subs.map((s, k) => (k === j ? val : s));
    update(idx, { subs: next });
  }
  function removeSub(idx: number, j: number) {
    const next = customs[idx].subs.filter((_, k) => k !== j);
    update(idx, { subs: next.length > 0 ? next : [''] });
  }

  return (
    <div className="mb-5 border-t border-line pt-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <PenLine size={14} className="text-accent-gold" />
            <span className="font-display tracking-widest text-xs text-accent-gold">
              CUSTOM · 自定义支线
            </span>
          </div>
          <p className="text-xs text-text-dim">
            模板没覆盖到？写一条专属于你的支线。
          </p>
        </div>
        <button
          onClick={() => { setOpen(true); addOne(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 cut-tl border border-accent-gold/40 text-accent-gold text-xs hover:bg-accent-gold/8 transition"
        >
          <Plus size={12} /> 新增
        </button>
      </div>

      {customs.length > 0 && (
        <div className="space-y-3">
          {customs.map((c, i) => (
            <div
              key={c.id}
              className="relative bg-bg-card border border-accent-gold/30 cut-br p-4 animate-fade-in"
            >
              <div className="absolute -top-2 left-3 font-mono text-[9px] tracking-widest text-accent-gold bg-bg px-2 py-0.5 border border-accent-gold/40">
                CUSTOM {String(i + 1).padStart(2, '0')}
              </div>
              <button
                onClick={() => remove(i)}
                className="absolute top-2 right-2 p-1 text-text-mute hover:text-accent-flame transition"
                aria-label="删除"
              >
                <X size={14} />
              </button>

              <input
                value={c.title}
                onChange={e => update(i, { title: e.target.value })}
                placeholder="支线名（如：重新建立晨跑习惯）"
                className="w-full bg-transparent text-base text-text-display border-b border-line focus:border-accent-gold outline-none pb-2 mb-3 transition"
              />
              <textarea
                value={c.description}
                onChange={e => update(i, { description: e.target.value })}
                placeholder="一句话描述（可选）"
                rows={2}
                className="w-full bg-transparent text-sm text-text-dim placeholder:text-text-mute outline-none resize-none mb-3"
              />

              <div className="font-mono text-[9px] tracking-widest text-text-mute mb-2 uppercase">
                子任务（按 Enter 新增一行）
              </div>
              <div className="space-y-1.5">
                {c.subs.map((s, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-accent-gold/50 rounded-full shrink-0" />
                    <input
                      value={s}
                      onChange={e => updateSub(i, j, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (j === c.subs.length - 1 && s.trim()) addSub(i);
                        }
                      }}
                      placeholder="如：每周三次力量训练"
                      className="flex-1 bg-transparent text-sm text-text border-b border-line/50 focus:border-accent-gold outline-none pb-1 transition"
                    />
                    {c.subs.length > 1 && (
                      <button
                        onClick={() => removeSub(i, j)}
                        className="p-1 text-text-mute hover:text-accent-flame"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => addSub(i)}
                className="flex items-center gap-1 mt-2 text-text-mute hover:text-accent-gold text-xs transition"
              >
                <Plus size={11} /> 再加一个子任务
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function templateSelectionsToQuestData(
  selections: SideQuestSelection[]
): { side: { id: string; title: string; templateKey: string }[]; subs: { id: string; title: string; parentId: string }[] } {
  const side: { id: string; title: string; templateKey: string }[] = [];
  const subs: { id: string; title: string; parentId: string }[] = [];
  for (const sel of selections) {
    const sideId = newQuestId();
    side.push({ id: sideId, title: sel.title, templateKey: sel.key });
    for (const subTitle of sel.acceptedSubTasks) {
      subs.push({ id: newQuestId(), title: subTitle, parentId: sideId });
    }
  }
  return { side, subs };
}
