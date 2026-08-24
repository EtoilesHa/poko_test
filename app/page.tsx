'use client';

import { useMemo, useState } from 'react';
import {
  ENVIRONMENT_LABELS,
  FAVORITE_LABELS,
  FLAVOR_LABELS,
  GROUP_LABELS,
  QUESTIONS,
  SPECIALTY_LABELS,
} from './data/content';
import { POKEMON } from './data/pokemon.generated';
import type { QuestionOption } from './data/types';
import { rankPokemon } from './lib/scoring';

type Stage = 'welcome' | 'quiz' | 'result';

const groupBadges = {
  base: '图鉴伙伴',
  basin: '海底来客',
  event: '活动惊喜',
  unique: '传说来信',
} as const;

function optionLinks(option: QuestionOption): string[] {
  return [
    ...Object.keys(option.favorites ?? {}).map((key) => FAVORITE_LABELS[key] ?? key),
    ...Object.keys(option.flavors ?? {}).map((key) => FLAVOR_LABELS[key] ?? key),
    ...Object.keys(option.environments ?? {}).map((key) => ENVIRONMENT_LABELS[key] ?? key),
    ...Object.keys(option.specialties ?? {}).map((key) => SPECIALTY_LABELS[key] ?? key),
  ];
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionOption[]>>({});
  const [copied, setCopied] = useState(false);
  const currentQuestion = QUESTIONS[questionIndex];
  const ranked = useMemo(
    () => rankPokemon(POKEMON, Object.values(answers).flat()),
    [answers],
  );
  const winner = ranked[0];
  const runnersUp = ranked.slice(1, 3);
  const leadOverRunner = winner && runnersUp[0]
    ? Math.max(0, winner.score.rawTotal - runnersUp[0].score.rawTotal)
    : 0;
  const selectedOptions = answers[currentQuestion.id] ?? [];
  const progress = Math.round((questionIndex / QUESTIONS.length) * 100);
  const directMatches = winner ? [
    { label: '喜好', values: winner.score.matchedFavorites },
    { label: '口味', values: winner.score.matchedFlavor ? [winner.score.matchedFlavor] : [] },
    { label: '理想环境', values: winner.score.matchedEnvironment ? [winner.score.matchedEnvironment] : [] },
    { label: '特长', values: winner.score.matchedSpecialties },
  ].filter((item) => item.values.length > 0) : [];
  const winnerReason = directMatches.length
    ? `以上标签均是你与 ${winner?.name ?? '这位宝可梦'} 在 Pokopia 图鉴里的直接重合项。`
    : `这位宝可梦与你的图鉴标签重合较少，但在稀有度加权后的图鉴契合指数中仍然最高。`;

  function beginQuiz() {
    setAnswers({});
    setQuestionIndex(0);
    setStage('quiz');
  }

  function toggleOption(option: QuestionOption) {
    setAnswers((current) => {
      const selected = current[currentQuestion.id] ?? [];
      const isSelected = selected.some((item) => item.id === option.id);
      if (isSelected) {
        return { ...current, [currentQuestion.id]: selected.filter((item) => item.id !== option.id) };
      }
      if (currentQuestion.maxSelections === 1) {
        return { ...current, [currentQuestion.id]: [option] };
      }
      if (selected.length >= currentQuestion.maxSelections) return current;
      return { ...current, [currentQuestion.id]: [...selected, option] };
    });
  }

  function nextQuestion() {
    if (selectedOptions.length < currentQuestion.minSelections) return;
    if (questionIndex === QUESTIONS.length - 1) {
      setStage('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setQuestionIndex((current) => current + 1);
  }

  function previousQuestion() {
    if (questionIndex === 0) {
      setStage('welcome');
      return;
    }
    setQuestionIndex((current) => current - 1);
  }

  async function shareResult() {
    if (!winner) return;
    const shareText = winner.shareLine + '\n来测测你在 Pokopia 会是什么宝可梦！';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pokopia 命定宝可梦测试', text: shareText, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="site-shell">
      <div className="sky-orb sky-orb-one" />
      <div className="sky-orb sky-orb-two" />
      <header className="site-header">
        <button className="brand" onClick={() => setStage('welcome')} aria-label="返回首页">
          <span className="brand-ball" aria-hidden="true"><i /></span>
          <span>pokopia test</span>
        </button>
        <span className="header-note">非官方粉丝小测试</span>
      </header>

      {stage === 'welcome' && <Welcome onBegin={beginQuiz} />}
      {stage === 'quiz' && (
        <section className="quiz-wrap" aria-labelledby="question-title">
          <div className="progress-row"><span>探测你的 Pokopia 频率</span><strong>{questionIndex + 1} / {QUESTIONS.length}</strong></div>
          <div className="progress-track" aria-label={`完成度 ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
          <article className="question-card">
            <p className="eyebrow"><span>✦</span>{currentQuestion.eyebrow}</p>
            <h1 id="question-title">{currentQuestion.prompt}</h1>
            <p className="question-hint">{currentQuestion.hint}</p>
            <div className="item-option-grid">
              {currentQuestion.options.map((option) => (
                <button
                  className={`item-option${selectedOptions.some((item) => item.id === option.id) ? ' is-selected' : ''}${option.sceneItems ? ' is-scene' : ''}`}
                  key={option.id}
                  onClick={() => toggleOption(option)}
                  aria-pressed={selectedOptions.some((item) => item.id === option.id)}
                  disabled={currentQuestion.maxSelections > 1 && !selectedOptions.some((item) => item.id === option.id) && selectedOptions.length >= currentQuestion.maxSelections}
                >
                  {option.sceneItems?.length ? (
                    <span className="scene-image-wrap">
                      {option.sceneItems.map((sceneItem) => (
                        <span className="scene-image" key={sceneItem.title}>
                          <img src={sceneItem.image} alt={sceneItem.imageAlt} />
                          <small>{sceneItem.title}</small>
                        </span>
                      ))}
                    </span>
                  ) : <span className="item-image-wrap"><img src={option.image} alt={option.imageAlt ?? ''} /></span>}
                  <span className="item-copy"><strong>{option.title}</strong><small>{option.description}</small><span className="item-links"><b>对应图鉴</b>{optionLinks(option).map((label) => <i key={label}>{label}</i>)}</span></span>
                </button>
              ))}
            </div>
            <div className="question-actions"><button className="text-button" onClick={previousQuestion}>← {questionIndex === 0 ? '返回首页' : '上一题'}</button><button className="primary-button question-next" onClick={nextQuestion} disabled={selectedOptions.length < currentQuestion.minSelections}>{questionIndex === QUESTIONS.length - 1 ? '查看图鉴匹配结果 →' : '下一项 →'}</button></div>
          </article>
        </section>
      )}
      {stage === 'result' && winner && (
        <section className="result-wrap" aria-labelledby="result-title">
          <p className="eyebrow result-eyebrow"><span>✦</span>匹配完成</p>
          <h1 id="result-title">你在 Pokopia 最像——</h1>
          <article className="winner-card">
            <div className="winner-orb" aria-hidden="true"><span className="orb-shine" /><span className="orb-face">◡</span><span className="orb-spark spark-one">✦</span><span className="orb-spark spark-two">✦</span></div>
            <div className="winner-copy">
              <span className="winner-badge">{groupBadges[winner.group]}</span>
              <p className="winner-number">Pokédex #{String(winner.dexNo).padStart(3, '0')}</p>
              <h2>{winner.name}</h2>
              <p className="type-row">{winner.types.map((type) => <span key={type}>{type}</span>)}</p>
              <p className="winner-tagline">{winner.tagline}</p>
              <div className="reason-box"><span>图鉴直连</span>{directMatches.map((match) => <p key={match.label}><b>{match.label}：</b>{match.values.join('、')}</p>)}<p>{winnerReason}</p></div>
              <p className="match-lead">{leadOverRunner >= 1 ? `比第二名领先 ${leadOverRunner.toFixed(1)} 个图鉴指数` : '与第二名的图鉴偏好非常接近'}</p>
            </div>
            <div className="match-score" aria-label={`图鉴契合指数 ${winner.score.total}`}><strong>{winner.score.total}</strong><span>图鉴契合</span></div>
          </article>
          <div className="result-actions"><button className="primary-button" onClick={shareResult}>{copied ? '已复制分享文案！' : '分享我的结果 ↗'}</button><button className="secondary-button" onClick={beginQuiz}>再测一次</button></div>
          <section className="runner-section" aria-labelledby="runner-title">
            <div className="section-heading"><div><p className="eyebrow"><span>✦</span>也很像你</p><h2 id="runner-title">你的 Pokopia 备选搭子</h2></div><p>偏好有多面，所以不止一种答案。</p></div>
            <div className="runner-grid">
              {runnersUp.map((pokemon, index) => (
                <article className="runner-card" key={pokemon.id}>
                  <span className="rank">0{index + 2}</span><span className={`mini-orb mini-orb-${index}`} aria-hidden="true">◡</span>
                  <div><span className="runner-group">{GROUP_LABELS[pokemon.group]}</span><h3>{pokemon.name}</h3><p>{pokemon.score.matchedFavorites.slice(0, 2).join(' · ')} · 图鉴契合</p></div>
                  <strong>{pokemon.score.total}</strong>
                </article>
              ))}
            </div>
          </section>
          <aside className="method-note"><span>每张物品卡都是 Pokopia 中实际存在的道具；卡片下方会显示它关联的图鉴喜好、口味、理想环境或特长。稀有的重合标签会有更高区分度。</span><span>结果池已接入 365 条公开图鉴记录：本篇、DLC 海底、活动，以及其中的传说／幻之宝可梦都会正常参与匹配。</span></aside>
        </section>
      )}
      <footer>Pokémon 与相关名称属于其权利人。本项目为非官方、非商业性质的粉丝趣味测试。</footer>
    </main>
  );
}

function Welcome({ onBegin }: { onBegin: () => void }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><span>✦</span>Pokopia preference match</p>
        <h1>如果你到了<br /><em>宝可梦世界</em>——</h1>
        <p className="hero-lede">从 Pokopia 岛上的真实道具里挑选你会喜欢的东西。每张物品卡都会悄悄连到图鉴标签，最后看看谁和你最同频。</p>
        <button className="primary-button hero-cta" onClick={onBegin}>开始测测看 <span>→</span></button>
        <p className="hero-meta"><span>15</span> 组同类物品题 · <span>365</span> 位候选搭子 · <span>图鉴</span> 可追溯</p>
      </div>
      <div className="hero-scene" aria-hidden="true">
        <div className="cloud cloud-one" /><div className="cloud cloud-two" /><div className="floating-star star-a">✦</div><div className="floating-star star-b">✦</div><div className="floating-star star-c">✦</div>
        <div className="island"><div className="island-grass" /><div className="island-water" /><div className="tree tree-one"><i /><b /></div><div className="tree tree-two"><i /><b /></div><div className="tree tree-three"><i /><b /></div><div className="tiny-house"><i /><b /><em /></div><div className="hero-creature"><i /><b /><em /></div><div className="hero-ball"><i /></div></div>
        <p className="scene-label">你的岛，正在等你入住</p>
      </div>
    </section>
  );
}
