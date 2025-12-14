import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, ScoreEntry, Target, GameStats } from './types';
import { generateDrillSergeantComment } from './services/gemini';
import { audio } from './services/audio';

// --- Constants ---
const GAME_DURATION = 30; // seconds
const TARGET_COUNT = 2; // Always keep 2 targets
const MIN_SIZE = 30; // px
const MAX_SIZE = 60; // px

const SCORES = {
    BULLSEYE: 150,
    HIT: 100,
    MISS: -20
};

// --- Helper Functions ---
const getRandomPosition = (maxWidth: number, maxHeight: number, size: number) => {
  return {
    x: Math.random() * (maxWidth - size),
    y: Math.random() * (maxHeight - size),
  };
};

const createTarget = (containerWidth: number, containerHeight: number): Target => {
  const size = Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE;
  const { x, y } = getRandomPosition(containerWidth, containerHeight, size);
  return {
    id: Date.now() + Math.random(),
    x,
    y,
    size,
    createdAt: Date.now(),
  };
};

// --- Components ---

// 1. Login Screen
const LoginScreen = ({ 
  onLogin, 
  leaderboard 
}: { 
  onLogin: (name: string) => void,
  leaderboard: ScoreEntry[] 
}) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const trimmedName = name.trim();
    const trimmedPass = password.trim();

    if (!trimmedName || !trimmedPass) return;

    // Auth Logic
    try {
      const users = JSON.parse(localStorage.getItem('riot_users') || '{}');
      const storedPassword = users[trimmedName];

      if (storedPassword) {
        // User exists, check password
        if (storedPassword === trimmedPass) {
          audio.init();
          onLogin(trimmedName);
        } else {
          setError('拒絕存取：密碼錯誤');
          audio.playMiss(0.5); // Error sound
        }
      } else {
        // New user, register
        users[trimmedName] = trimmedPass;
        localStorage.setItem('riot_users', JSON.stringify(users));
        audio.init();
        onLogin(trimmedName);
      }
    } catch (err) {
      console.error("Auth error", err);
      setError('系統錯誤：資料庫損毀');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen relative z-10 animate-in fade-in duration-500">
      
      {/* Top Right Leaderboard (Login Version) */}
      <div className="absolute top-6 right-6 w-64 hidden md:block">
        <div className="bg-slate-900/80 border border-slate-800 p-4 backdrop-blur-sm">
           <div className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-3 border-b border-emerald-500/20 pb-2">
              全球菁英榜
           </div>
           <div className="space-y-2">
             {leaderboard.slice(0, 5).map((entry, i) => (
                <div key={i} className="flex justify-between items-center text-xs font-mono">
                   <span className="text-slate-400 uppercase w-24 truncate">{entry.name}</span>
                   <span className="text-emerald-400 font-bold">{entry.score}</span>
                </div>
             ))}
             {leaderboard.length === 0 && (
                <div className="text-slate-600 text-[10px] italic text-center py-2">暫無數據</div>
             )}
           </div>
        </div>
      </div>

      <div className="w-full max-w-md p-8 bg-slate-900/80 border border-emerald-500/30 rounded-none backdrop-blur-sm shadow-[0_0_50px_rgba(16,185,129,0.1)] relative">
        <h1 className="text-6xl font-black text-white mb-2 text-center uppercase tracking-tighter italic shadow-emerald-500/50 drop-shadow-lg">
          RIOT-GO
        </h1>
        <div className="text-center text-emerald-500 font-mono text-xs uppercase tracking-[0.3em] mb-8">戰術反應模擬系統</div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <label className="block text-[10px] font-mono text-emerald-500 mb-1 uppercase tracking-[0.2em] ml-1">特務代號</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              className="w-full bg-slate-950/50 border border-slate-700 text-white px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-lg placeholder-slate-700 text-center uppercase tracking-widest"
              placeholder="輸入代號"
              maxLength={12}
              autoFocus
            />
          </div>
          
          <div className="relative group">
            <label className="block text-[10px] font-mono text-emerald-500 mb-1 uppercase tracking-[0.2em] ml-1">安全密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="w-full bg-slate-950/50 border border-slate-700 text-white px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-lg placeholder-slate-700 text-center tracking-widest"
              placeholder="••••••"
              maxLength={20}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-2 text-center animate-pulse">
               <span className="text-red-500 font-mono text-xs font-bold tracking-widest uppercase">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || !password.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-4 transition-all transform hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] clip-path-polygon"
          >
            身份驗證
          </button>
          
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
               *新帳號將自動註冊
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Main Lobby
const LobbyScreen = ({ 
    playerName, 
    onStart, 
    history, 
    leaderboard 
}: { 
    playerName: string, 
    onStart: () => void, 
    history: ScoreEntry[], 
    leaderboard: ScoreEntry[] 
}) => {
    const [showHistory, setShowHistory] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    const myHistory = history.filter(h => h.name === playerName);
    const gamesPlayed = myHistory.length;
    const maxScore = myHistory.length > 0 ? Math.max(...myHistory.map(h => h.score)) : 0;

    return (
        <div className="relative w-full h-screen flex flex-col items-center justify-center z-10 animate-in fade-in zoom-in duration-300">
            {/* Top Bar */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
                {/* Top Left: My Stats */}
                <div className="pointer-events-auto">
                    <button 
                        onClick={() => setShowHistory(true)}
                        className="group flex flex-col items-start bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 transition-all"
                    >
                        <div className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-1 group-hover:text-emerald-400">特務檔案</div>
                        <div className="text-2xl font-bold text-white uppercase tracking-wider mb-1">{playerName}</div>
                        <div className="text-xs text-slate-400 font-mono">任務場數: <span className="text-white">{gamesPlayed}</span></div>
                        <div className="text-xs text-slate-400 font-mono">最高紀錄: <span className="text-emerald-400">{maxScore}</span></div>
                    </button>
                </div>

                {/* Top Right: Leaderboard */}
                <div className="pointer-events-auto">
                    <button 
                        onClick={() => setShowLeaderboard(true)}
                        className="group flex flex-col items-end bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-4 transition-all"
                    >
                        <div className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-1 group-hover:text-emerald-400">全球排名</div>
                        <div className="text-2xl font-bold text-white uppercase tracking-wider mb-1">菁英部隊</div>
                        <div className="text-xs text-slate-400 font-mono">查看頂尖特務 -></div>
                    </button>
                </div>
            </div>

            {/* Center Content */}
            <div className="text-center space-y-8">
                <h1 className="text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 tracking-tighter drop-shadow-2xl">
                    RIOT-GO
                </h1>
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={onStart}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-2xl py-6 px-12 min-w-[300px] uppercase tracking-[0.2em] clip-path-polygon transform hover:scale-105 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                    >
                        立即出擊
                    </button>
                </div>
            </div>

            {/* Modals */}
            {(showHistory || showLeaderboard) && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={() => {setShowHistory(false); setShowLeaderboard(false);}}>
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest">
                                {showHistory ? `戰績紀錄: ${playerName}` : '全球排行榜'}
                            </h2>
                            <button onClick={() => {setShowHistory(false); setShowLeaderboard(false);}} className="text-slate-500 hover:text-white font-mono">[關閉]</button>
                        </div>
                        <div className="overflow-y-auto p-0">
                            <table className="w-full text-left font-mono text-sm">
                                <thead className="bg-slate-900 text-[10px] uppercase text-slate-500 sticky top-0">
                                    <tr>
                                        <th className="p-4 font-normal tracking-widest">日期</th>
                                        <th className="p-4 font-normal tracking-widest">分數</th>
                                        <th className="p-4 font-normal tracking-widest">命中率%</th>
                                        {showLeaderboard && <th className="p-4 font-normal tracking-widest">特務</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {(showHistory ? myHistory.slice().reverse() : leaderboard).map((entry, i) => (
                                        <tr key={i} className="hover:bg-slate-800/50">
                                            <td className="p-4 text-slate-400">{new Date(entry.date).toLocaleDateString()}</td>
                                            <td className="p-4 text-emerald-400 font-bold">{entry.score}</td>
                                            <td className="p-4 text-slate-300">{Math.round(entry.accuracy)}%</td>
                                            {showLeaderboard && <td className="p-4 text-white uppercase">{entry.name}</td>}
                                        </tr>
                                    ))}
                                    {((showHistory && myHistory.length === 0) || (showLeaderboard && leaderboard.length === 0)) && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-600 italic">暫無資料</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 3. Game Over Screen
const GameOverScreen = ({ 
  stats, 
  onRestart, 
  onReturnToLobby,
  onLogout,
  comment,
  leaderboard,
  playerName
}: { 
  stats: GameStats, 
  onRestart: () => void, 
  onReturnToLobby: () => void,
  onLogout: () => void,
  comment: string,
  leaderboard: ScoreEntry[],
  playerName: string
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950/95 z-50 absolute inset-0 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-slate-900/80 border border-slate-800 p-8 shadow-2xl animate-in fade-in zoom-in duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

        <div className="relative z-10">
            <h2 className="text-4xl font-black text-white text-center mb-8 uppercase tracking-[0.3em] italic">
              任務結算報告
            </h2>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-950/50 p-6 border-l-4 border-emerald-500">
                <div className="text-emerald-500 text-[10px] font-mono uppercase tracking-widest mb-1">總得分</div>
                <div className="text-4xl font-black text-white tracking-tighter">{stats.score}</div>
              </div>
              <div className="bg-slate-950/50 p-6 border-l-4 border-cyan-500">
                <div className="text-cyan-500 text-[10px] font-mono uppercase tracking-widest mb-1">命中率</div>
                <div className="text-4xl font-black text-white tracking-tighter">{Math.round(stats.accuracy)}%</div>
              </div>
              <div className="bg-slate-950/50 p-6 border-l-4 border-amber-500">
                <div className="text-amber-500 text-[10px] font-mono uppercase tracking-widest mb-1">精準打擊</div>
                <div className="text-4xl font-black text-white tracking-tighter">{stats.bullseyes}</div>
              </div>
            </div>

            <div className="mb-8 bg-slate-950 border border-slate-800 p-6 relative">
              <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-[10px] font-mono text-emerald-500 uppercase tracking-widest border border-slate-800">
                  指揮官講評
              </div>
              <div className="text-slate-300 font-mono text-sm leading-relaxed min-h-[3rem] flex items-center">
                {comment ? (
                    <span className="typewriter">{comment}</span>
                ) : (
                    <span className="animate-pulse text-emerald-500/50">...正在解密訊號...</span>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={onRestart} className="flex-1 bg-white hover:bg-emerald-400 text-black font-black py-4 uppercase tracking-[0.1em] transition-colors">
                再次挑戰
              </button>
              <button onClick={onReturnToLobby} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 uppercase tracking-[0.1em] transition-colors">
                返回大廳
              </button>
              <button onClick={onLogout} className="flex-1 border border-slate-700 hover:border-red-500 hover:text-red-500 text-slate-500 font-bold py-4 uppercase tracking-[0.1em] transition-all">
                登出
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [appState, setAppState] = useState<AppState>('LOGIN');
  const [userName, setUserName] = useState('');
  
  // Game State
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targets, setTargets] = useState<Target[]>([]);
  const [stats, setStats] = useState<GameStats>({ score: 0, accuracy: 0, shotsFired: 0, targetsHit: 0, bullseyes: 0 });
  
  // Meta State
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [history, setHistory] = useState<ScoreEntry[]>([]);
  const [aiComment, setAiComment] = useState('');
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const timerIdRef = useRef<number>();
  const spawnTimerRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  
  // Load data on mount
  useEffect(() => {
    const savedLeaderboard = localStorage.getItem('riot_leaderboard');
    if (savedLeaderboard) setLeaderboard(JSON.parse(savedLeaderboard));

    const savedHistory = localStorage.getItem('riot_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const spawnInitialTargets = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      const newTargets: Target[] = [];
      for (let i = 0; i < TARGET_COUNT; i++) {
          newTargets.push(createTarget(clientWidth, clientHeight));
      }
      setTargets(newTargets);
  };

  const endGame = useCallback(() => {
    if (timerIdRef.current) clearInterval(timerIdRef.current);
    audio.stopBGM();
    setAppState('GAME_OVER');
    
    setStats(currentStats => {
        const finalAccuracy = currentStats.shotsFired > 0 
            ? (currentStats.targetsHit / currentStats.shotsFired) * 100 
            : 0;

        generateDrillSergeantComment(userName, currentStats.score, finalAccuracy).then(setAiComment);

        const newEntry: ScoreEntry = {
            name: userName,
            score: currentStats.score,
            date: new Date().toISOString(),
            accuracy: finalAccuracy
        };

        // Update Leaderboard
        setLeaderboard(currentLeaderboard => {
             const newBoard = [...currentLeaderboard, newEntry]
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
             localStorage.setItem('riot_leaderboard', JSON.stringify(newBoard));
             return newBoard;
        });

        // Update History
        setHistory(currentHistory => {
            const newHist = [...currentHistory, newEntry];
            localStorage.setItem('riot_history', JSON.stringify(newHist));
            return newHist;
        });

        return { ...currentStats, accuracy: finalAccuracy };
    });

  }, [userName]);

  const startTimer = () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      
      timerIdRef.current = window.setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
          const remaining = GAME_DURATION - elapsedSeconds;
          
          if (remaining <= 0) {
              setTimeLeft(0);
              endGame();
          } else {
              setTimeLeft(remaining);
          }
      }, 100);
  };

  const resetGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setTargets([]);
    setStats({ score: 0, accuracy: 0, shotsFired: 0, targetsHit: 0, bullseyes: 0 });
    setAiComment('');
    
    setTimeout(() => {
        spawnInitialTargets();
        startTimeRef.current = Date.now();
        startTimer();
    }, 100);
  };

  const handleStartGame = () => {
    setAppState('PLAYING');
    audio.playBGM(0.05);
    resetGame();
  };

  // Clean up
  useEffect(() => {
      return () => {
          if (timerIdRef.current) clearInterval(timerIdRef.current);
          audio.stopBGM();
      };
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (appState !== 'PLAYING') return;
    
    // Miss logic
    audio.playShoot(1.0);
    audio.playMiss(1.0);
    
    // Deduct points, allow negative
    setScore(prev => prev + SCORES.MISS);
    
    setStats(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
  };

  const handleTargetHit = (e: React.MouseEvent, id: number, isBullseye: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (appState !== 'PLAYING') return;

    audio.playShoot(1.0);
    audio.playHit(isBullseye ? 1.0 : 0.8);

    const points = isBullseye ? SCORES.BULLSEYE : SCORES.HIT;
    setScore(prev => prev + points);
    
    setStats(prev => ({ 
      ...prev, 
      shotsFired: prev.shotsFired + 1, 
      targetsHit: prev.targetsHit + 1,
      score: prev.score + points,
      bullseyes: isBullseye ? prev.bullseyes + 1 : prev.bullseyes
    }));

    // Respawn
    if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setTargets(prev => [
            ...prev.filter(t => t.id !== id),
            createTarget(clientWidth, clientHeight)
        ]);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none">
      
      {/* Animated Background */}
      <div className="absolute inset-0 bg-slate-950 perspective-grid -z-10"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950 pointer-events-none -z-10"></div>
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-slate-950 pointer-events-none -z-10"></div>

      {/* Login State */}
      {appState === 'LOGIN' && (
        <LoginScreen 
            onLogin={(name) => { setUserName(name); setAppState('LOBBY'); }} 
            leaderboard={leaderboard}
        />
      )}

      {/* Lobby State */}
      {appState === 'LOBBY' && (
          <LobbyScreen 
            playerName={userName} 
            onStart={handleStartGame} 
            history={history}
            leaderboard={leaderboard}
          />
      )}

      {/* Game State */}
      {appState === 'PLAYING' && (
        <div className="flex flex-col h-full cursor-crosshair">
          {/* HUD */}
          <div className="flex justify-between items-end p-8 w-full max-w-7xl mx-auto pointer-events-none select-none relative z-20">
             <div className="flex flex-col">
                <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-[0.2em] mb-1">特務</span>
                <span className="text-2xl font-bold text-white uppercase tracking-widest">{userName}</span>
             </div>
             
             <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                <div className={`text-6xl font-black font-mono tracking-tighter tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </div>
                <div className="h-1 w-24 bg-slate-800 mt-2 overflow-hidden">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-1000 linear" 
                        style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
                    />
                </div>
             </div>

             <div className="flex flex-col items-end">
                <span className="text-[10px] text-emerald-500 font-mono uppercase tracking-[0.2em] mb-1">分數</span>
                <span className="text-4xl font-black text-white tabular-nums tracking-tighter">{score}</span>
             </div>
          </div>

          {/* Target Area */}
          <div 
            ref={containerRef}
            onMouseDown={handleContainerClick}
            className="flex-1 relative mx-8 mb-8 border border-slate-800/50 bg-slate-900/10 backdrop-blur-[1px] rounded-lg overflow-hidden active:bg-red-500/5 transition-colors duration-75 z-10"
          >
             {/* Grid overlay in game area */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>

            {targets.map(target => (
              <div
                key={target.id}
                onMouseDown={(e) => handleTargetHit(e, target.id, false)}
                className="absolute rounded-full cursor-pointer target-anim group flex items-center justify-center hover:scale-105 transition-transform duration-75"
                style={{
                  left: target.x,
                  top: target.y,
                  width: target.size,
                  height: target.size,
                  background: 'radial-gradient(circle at 30% 30%, #34d399, #059669)',
                  boxShadow: '0 0 20px rgba(16,185,129,0.4), inset 0 0 10px rgba(255,255,255,0.3)'
                }}
              >
                 {/* Bullseye Hitbox - Inner 40% */}
                 <div 
                    onMouseDown={(e) => handleTargetHit(e, target.id, true)}
                    className="w-[40%] h-[40%] bg-emerald-950 rounded-full border border-emerald-500/50 relative z-20 hover:bg-emerald-900 transition-colors"
                 >
                     <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-pulse"></div>
                 </div>
                 
                 {/* Decorative Ping */}
                 <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping opacity-20 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Over State */}
      {appState === 'GAME_OVER' && (
        <GameOverScreen 
          stats={stats} 
          onRestart={() => {
            setAppState('PLAYING');
            audio.playBGM(0.05);
            resetGame();
          }} 
          onReturnToLobby={() => {
             setAppState('LOBBY');
          }}
          onLogout={() => {
            setAppState('LOGIN');
            setUserName('');
          }}
          comment={aiComment}
          leaderboard={leaderboard}
          playerName={userName}
        />
      )}
    </div>
  );
}