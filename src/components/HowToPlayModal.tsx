import React from 'react';
import { X, Target, Wind, Flame, Award, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl p-6 text-stone-100 shadow-2xl">
        <button
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-200">How to Play Arrow Strike</h2>
            <p className="text-xs text-stone-400">Master the bow and precision archery physics</p>
          </div>
        </div>

        <div className="space-y-4 text-sm max-h-[65vh] overflow-y-auto pr-1">
          {/* Aim & Draw */}
          <div className="bg-stone-800/70 p-3.5 rounded-xl border border-stone-700/60">
            <div className="flex items-center gap-2 font-semibold text-amber-300 mb-1">
              <Target className="w-4 h-4 text-amber-400" />
              <span>Aiming &amp; Shooting</span>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              Click/touch and pull back in the opposite direction from the bow to draw string tension.
              The further you pull, the faster and straighter your arrow travels. Release to shoot!
            </p>
          </div>

          {/* Target Scoring */}
          <div className="bg-stone-800/70 p-3.5 rounded-xl border border-stone-700/60">
            <div className="flex items-center gap-2 font-semibold text-amber-300 mb-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Concentric Target Scoring</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="w-3.5 h-3.5 rounded-full bg-yellow-400 border border-yellow-600 inline-block" />
                <span className="font-semibold text-yellow-300">Bullseye: 60 - 100 pts</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="w-3.5 h-3.5 rounded-full bg-red-600 border border-red-800 inline-block" />
                <span className="font-semibold text-red-300">Red Ring: 40 pts</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-800 inline-block" />
                <span className="font-semibold text-blue-300">Blue Ring: 25 pts</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-600 inline-block" />
                <span className="font-semibold text-slate-300">Black: 15 / White: 10 pts</span>
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-2">
              Bonus golden apples and balloons award <span className="text-amber-300 font-bold">+75 bonus points</span>!
            </p>
          </div>

          {/* Wind & Gravity */}
          <div className="bg-stone-800/70 p-3.5 rounded-xl border border-stone-700/60">
            <div className="flex items-center gap-2 font-semibold text-cyan-300 mb-1">
              <Wind className="w-4 h-4 text-cyan-400" />
              <span>Wind &amp; Ballistics</span>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              Watch the wind pennant flag and wind gauge. Wind pushes arrows sideways during flight,
              while gravity pulls them down over distance. Aim higher and into the wind to compensate!
            </p>
          </div>

          {/* Combos */}
          <div className="bg-stone-800/70 p-3.5 rounded-xl border border-stone-700/60">
            <div className="flex items-center gap-2 font-semibold text-orange-300 mb-1">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Combo Streaks</span>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              Hitting consecutive shots builds a combo multiplier (up to 3x points!). A miss will reset your streak.
            </p>
          </div>

          {/* Difficulties */}
          <div className="bg-stone-800/70 p-3.5 rounded-xl border border-stone-700/60">
            <div className="font-semibold text-stone-200 mb-2">Difficulty Levels:</div>
            <ul className="text-xs space-y-1.5 text-stone-300">
              <li><strong className="text-emerald-400">Easy:</strong> Large stationary target, light calm breeze, full trajectory arc.</li>
              <li><strong className="text-blue-400">Normal:</strong> Vertically bobbing target, moderate wind gusts, partial guide.</li>
              <li><strong className="text-red-400">Hard:</strong> Swift moving target, turbulent crosswinds, minimal guide. True master archery!</li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          className="w-full mt-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold rounded-xl transition-all shadow-lg active:scale-98"
        >
          Got It, Let's Shoot!
        </button>
      </div>
    </div>
  );
};
