import { useState, useEffect, useCallback } from 'react';
import { Target, Trophy, Volume2, VolumeX, HelpCircle, RotateCcw, Flame, Wind, Award, Zap } from 'lucide-react';
import { ArcheryCanvas } from './components/ArcheryCanvas';
import { HowToPlayModal } from './components/HowToPlayModal';
import { RoundOverModal } from './components/RoundOverModal';
import { Difficulty, DIFFICULTY_CONFIGS, GameStats } from './types/game';
import { soundManager } from './utils/audio';

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [round, setRound] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showRoundOver, setShowRoundOver] = useState(false);

  // High scores per difficulty saved to localStorage
  const [highScores, setHighScores] = useState<Record<Difficulty, number>>({
    easy: 0,
    normal: 0,
    hard: 0,
  });

  // Game stats
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    arrowsRemaining: DIFFICULTY_CONFIGS['normal'].arrowsPerRound,
    arrowsShot: 0,
    bullseyes: 0,
    hits: 0,
    misses: 0,
    longestStreak: 0,
    currentStreak: 0,
    round: 1,
  });

  // Load high scores from localStorage
  useEffect(() => {
    try {
      const savedEasy = parseInt(localStorage.getItem('arrow_strike_hs_easy') || '0', 10);
      const savedNormal = parseInt(localStorage.getItem('arrow_strike_hs_normal') || '0', 10);
      const savedHard = parseInt(localStorage.getItem('arrow_strike_hs_hard') || '0', 10);
      setHighScores({
        easy: isNaN(savedEasy) ? 0 : savedEasy,
        normal: isNaN(savedNormal) ? 0 : savedNormal,
        hard: isNaN(savedHard) ? 0 : savedHard,
      });
    } catch {
      // localStorage may fail in some iframe sandbox modes
    }
  }, []);

  // Sync current high score when difficulty changes
  useEffect(() => {
    const config = DIFFICULTY_CONFIGS[difficulty];
    setStats((prev) => ({
      ...prev,
      highScore: highScores[difficulty],
      arrowsRemaining: config.arrowsPerRound,
      score: 0,
      bullseyes: 0,
      hits: 0,
      misses: 0,
      currentStreak: 0,
      longestStreak: 0,
      round: 1,
    }));
    setRound(1);
    setShowRoundOver(false);
  }, [difficulty, highScores]);

  // Toggle sound
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
    if (next) soundManager.playClick();
  };

  // Switch difficulty
  const handleDifficultyChange = (newDiff: Difficulty) => {
    if (newDiff === difficulty) return;
    soundManager.playClick();
    setDifficulty(newDiff);
  };

  // Called when arrow leaves bow
  const handleArrowShot = useCallback(() => {
    setStats((prev) => ({
      ...prev,
      arrowsRemaining: Math.max(0, prev.arrowsRemaining - 1),
      arrowsShot: prev.arrowsShot + 1,
    }));
  }, []);

  // Called when arrow hits or misses
  const handleScoreEarned = useCallback(
    (points: number, hitType: 'bullseye' | 'hit' | 'outer' | 'bonus' | 'miss') => {
      setStats((prev) => {
        const isHit = hitType !== 'miss';
        const newStreak = isHit ? prev.currentStreak + 1 : 0;
        const newLongestStreak = Math.max(prev.longestStreak, newStreak);
        const newScore = prev.score + points;
        const currentHS = highScores[difficulty];
        const newHighScore = Math.max(currentHS, newScore);

        if (newScore > currentHS) {
          try {
            localStorage.setItem(`arrow_strike_hs_${difficulty}`, newHighScore.toString());
            setHighScores((hs) => ({ ...hs, [difficulty]: newHighScore }));
          } catch {
            // ignore
          }
        }

        return {
          ...prev,
          score: newScore,
          highScore: newHighScore,
          bullseyes: hitType === 'bullseye' ? prev.bullseyes + 1 : prev.bullseyes,
          hits: isHit && hitType !== 'bullseye' ? prev.hits + 1 : prev.hits,
          misses: hitType === 'miss' ? prev.misses + 1 : prev.misses,
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
        };
      });
    },
    [difficulty, highScores]
  );

  // Triggered when round ends (all arrows fired)
  const handleRoundComplete = useCallback(() => {
    setShowRoundOver(true);
  }, []);

  // Proceed to next round
  const handleNextRound = () => {
    const nextRound = round + 1;
    setRound(nextRound);
    setShowRoundOver(false);
    const config = DIFFICULTY_CONFIGS[difficulty];
    setStats((prev) => ({
      ...prev,
      round: nextRound,
      arrowsRemaining: config.arrowsPerRound,
    }));
  };

  // Restart current round
  const handleRestart = () => {
    soundManager.playClick();
    setShowRoundOver(false);
    const config = DIFFICULTY_CONFIGS[difficulty];
    setStats((prev) => ({
      ...prev,
      score: 0,
      arrowsRemaining: config.arrowsPerRound,
      bullseyes: 0,
      hits: 0,
      misses: 0,
      currentStreak: 0,
    }));
  };

  const currentConfig = DIFFICULTY_CONFIGS[difficulty];
  const totalArrowsForRound = currentConfig.arrowsPerRound;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="border-b border-stone-800 bg-stone-900/90 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 shadow-md shadow-amber-900/40">
              <Target className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-amber-200">
                  Arrow Strikes
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Archery Pro
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">
                Concentric target precision &bull; Wind ballistics
              </p>
            </div>
          </div>

          {/* Difficulty Tabs: Easy, Normal, Hard */}
          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800 shadow-inner">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((level) => {
              const cfg = DIFFICULTY_CONFIGS[level];
              const isActive = difficulty === level;
              return (
                <button
                  key={level}
                  onClick={() => handleDifficultyChange(level)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? level === 'easy'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
                        : level === 'normal'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
                        : 'bg-red-600 text-white shadow-md shadow-red-900/50'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      level === 'easy'
                        ? 'bg-emerald-400'
                        : level === 'normal'
                        ? 'bg-blue-400'
                        : 'bg-red-400'
                    }`}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Utility Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundManager.playClick();
                setShowHowToPlay(true);
              }}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-700"
              title="How to Play"
              aria-label="How to Play"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={toggleSound}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-700"
              title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-amber-400" /> : <VolumeX className="w-5 h-5 text-stone-500" />}
            </button>
            <button
              onClick={handleRestart}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-700"
              title="Restart Round"
              aria-label="Restart Round"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Playing Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 flex flex-col justify-center">
        {/* HUD Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3 text-sm">
          {/* Score & High Score */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between shadow-md">
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold">Score</div>
              <div className="text-xl font-extrabold text-amber-300">{stats.score}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-stone-500 flex items-center justify-end gap-1">
                <Trophy className="w-3 h-3 text-yellow-500" />
                <span>Best</span>
              </div>
              <div className="text-xs font-bold text-stone-300">{stats.highScore}</div>
            </div>
          </div>

          {/* Round & Target Pass Score */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between shadow-md">
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold">Stage</div>
              <div className="text-xl font-extrabold text-stone-100">Round {round}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-stone-500">Goal</div>
              <div className="text-xs font-bold text-amber-400">{currentConfig.passScore} pts</div>
            </div>
          </div>

          {/* Remaining Arrows (Quiver indicator) */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-stone-400 uppercase font-semibold">Quiver</span>
              <span className="text-xs font-bold text-amber-300">
                {stats.arrowsRemaining} / {totalArrowsForRound}
              </span>
            </div>
            {/* Visual Arrow Icons */}
            <div className="flex items-center gap-1 mt-1 overflow-hidden">
              {Array.from({ length: totalArrowsForRound }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-1 rounded-sm transition-colors duration-200 ${
                    i < stats.arrowsRemaining
                      ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                      : 'bg-stone-800'
                  }`}
                  title={`Arrow ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Streak & Combo Multiplier */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between shadow-md">
            <div>
              <div className="text-[11px] text-stone-400 uppercase font-semibold flex items-center gap-1">
                <Flame className={`w-3.5 h-3.5 ${stats.currentStreak > 1 ? 'text-orange-500 animate-pulse' : 'text-stone-500'}`} />
                <span>Streak</span>
              </div>
              <div className="text-xl font-extrabold text-orange-400">
                {stats.currentStreak > 0 ? `${stats.currentStreak} in row` : '0'}
              </div>
            </div>
            {stats.currentStreak > 1 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 animate-bounce">
                {(1 + stats.currentStreak * 0.25).toFixed(1)}x
              </span>
            )}
          </div>
        </div>

        {/* Archery Canvas */}
        <ArcheryCanvas
          difficulty={difficulty}
          round={round}
          score={stats.score}
          arrowsRemaining={stats.arrowsRemaining}
          streak={stats.currentStreak}
          onArrowShot={handleArrowShot}
          onScoreEarned={handleScoreEarned}
          onRoundComplete={handleRoundComplete}
          isPaused={showHowToPlay || showRoundOver}
        />

        {/* Bottom Difficulty Details & Quick Tips */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400 bg-stone-900/60 p-3 rounded-xl border border-stone-800">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentConfig.color }}
            />
            <span className="font-semibold text-stone-200">{currentConfig.label} Mode:</span>
            <span>{currentConfig.description}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Bullseyes: <strong className="text-stone-200">{stats.bullseyes}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hits: <strong className="text-stone-200">{stats.hits}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              <span>Max Wind: <strong className="text-stone-200">{currentConfig.maxWind} m/s</strong></span>
            </div>
          </div>
        </div>
      </main>

      {/* How to Play Modal */}
      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      {/* Round Complete Modal */}
      <RoundOverModal
        isOpen={showRoundOver}
        score={stats.score}
        highScore={stats.highScore}
        difficulty={difficulty}
        round={round}
        bullseyes={stats.bullseyes}
        hits={stats.hits}
        misses={stats.misses}
        longestStreak={stats.longestStreak}
        onNextRound={handleNextRound}
        onRestart={handleRestart}
        onChangeDifficulty={handleDifficultyChange}
      />
    </div>
  );
}
