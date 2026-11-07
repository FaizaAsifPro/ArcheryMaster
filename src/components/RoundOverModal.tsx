import React from 'react';
import { Star, RotateCcw, ArrowRight, Trophy, Flame } from 'lucide-react';
import { Difficulty, DIFFICULTY_CONFIGS } from '../types/game';
import { soundManager } from '../utils/audio';

interface RoundOverModalProps {
  isOpen: boolean;
  score: number;
  highScore: number;
  difficulty: Difficulty;
  round: number;
  bullseyes: number;
  hits: number;
  misses: number;
  longestStreak: number;
  onNextRound: () => void;
  onRestart: () => void;
  onChangeDifficulty: (diff: Difficulty) => void;
}

export const RoundOverModal: React.FC<RoundOverModalProps> = ({
  isOpen,
  score,
  highScore,
  difficulty,
  round,
  bullseyes,
  hits,
  misses,
  longestStreak,
  onNextRound,
  onRestart,
  onChangeDifficulty,
}) => {
  if (!isOpen) return null;

  const config = DIFFICULTY_CONFIGS[difficulty];
  const totalShots = bullseyes + hits + misses;
  const accuracy = totalShots > 0 ? Math.round(((bullseyes + hits) / totalShots) * 100) : 0;
  const isPassed = score >= config.passScore;

  // Star rating
  let stars = 0;
  if (score >= config.passScore * 1.5) stars = 3;
  else if (score >= config.passScore * 1.1) stars = 2;
  else if (score >= config.passScore) stars = 1;

  const isNewHighScore = score > 0 && score >= highScore;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-stone-900 border-2 border-amber-600/30 rounded-3xl p-6 sm:p-8 text-stone-100 shadow-2xl text-center relative overflow-hidden">
        {/* Decorative background glow */}
        <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
          isPassed ? 'bg-amber-500/20' : 'bg-red-500/15'
        }`} />

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border ${
          isPassed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        }">
          {isPassed ? 'Round Cleared!' : 'Practice Complete'}
        </div>

        <h2 className="text-3xl font-black text-amber-200 tracking-tight">
          {isPassed ? 'Magnificent Shooting!' : 'Round Finished!'}
        </h2>
        <p className="text-xs text-stone-400 mt-1 capitalize">
          {difficulty} Difficulty &bull; Round {round}
        </p>

        {/* Star Rating */}
        <div className="flex justify-center items-center gap-3 my-5">
          {[1, 2, 3].map((starIndex) => (
            <div
              key={starIndex}
              className={`p-3 rounded-2xl border transition-all duration-300 ${
                starIndex <= stars
                  ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-lg shadow-amber-500/30 scale-110'
                  : 'bg-stone-800/80 text-stone-600 border-stone-700/60'
              }`}
            >
              <Star className={`w-8 h-8 ${starIndex <= stars ? 'fill-stone-950' : ''}`} />
            </div>
          ))}
        </div>

        {/* Main Score Box */}
        <div className="bg-stone-800/80 border border-stone-700/80 rounded-2xl p-4 mb-5">
          <div className="text-xs text-stone-400 uppercase font-semibold tracking-wider">Total Score</div>
          <div className="text-4xl font-extrabold text-amber-400 tracking-tight my-1">
            {score.toLocaleString()}
          </div>
          {isNewHighScore && (
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-300 bg-yellow-400/20 px-2.5 py-0.5 rounded-full mt-1 border border-yellow-400/30">
              <Trophy className="w-3.5 h-3.5" />
              <span>NEW PERSONAL BEST!</span>
            </div>
          )}
          <div className="text-xs text-stone-400 mt-1">
            Target to pass: <span className="text-stone-300 font-bold">{config.passScore} pts</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 text-left">
          <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700/50">
            <div className="text-[10px] text-stone-400 font-medium">Bullseyes</div>
            <div className="text-lg font-bold text-amber-300">{bullseyes}</div>
          </div>
          <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700/50">
            <div className="text-[10px] text-stone-400 font-medium">Accuracy</div>
            <div className="text-lg font-bold text-emerald-400">{accuracy}%</div>
          </div>
          <div className="bg-stone-800/60 p-2.5 rounded-xl border border-stone-700/50">
            <div className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              <span>Streak</span>
            </div>
            <div className="text-lg font-bold text-orange-400">{longestStreak}x</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {isPassed ? (
            <button
              onClick={() => {
                soundManager.playVictory();
                onNextRound();
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2"
            >
              <span>Next Round ({round + 1})</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                soundManager.playClick();
                onRestart();
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Try Again</span>
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                soundManager.playClick();
                onRestart();
              }}
              className="flex-1 py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white font-semibold text-xs rounded-xl border border-stone-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Round</span>
            </button>

            {difficulty !== 'hard' && isPassed && (
              <button
                onClick={() => {
                  soundManager.playClick();
                  onChangeDifficulty(difficulty === 'easy' ? 'normal' : 'hard');
                }}
                className="flex-1 py-2 px-3 bg-stone-800 hover:bg-stone-700 text-amber-300 font-semibold text-xs rounded-xl border border-amber-500/30 transition-colors"
              >
                Up Difficulty &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
