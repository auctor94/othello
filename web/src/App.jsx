import { useState, useEffect, useCallback, useRef } from 'react'
import { clearGameBootstrap, fetchApi, fetchStats, loadOrCreateGame } from './api'
import { getInitialLang, saveLang, translate } from './i18n'
import './App.css'

const AI_DELAY_MS = 1400
/** How long AI placement + flipped discs stay highlighted after the bot moves */
const HIGHLIGHT_AI_MS = 3000
const LONG_PRESS_MS = 380
const DIFFICULTIES = ['easy', 'medium', 'hard']

function hasFineHover() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
}

/** H:MM:SS when ≥1h, otherwise M:SS */
function formatDuration(seconds, na = 'N/A') {
  if (seconds == null || Number.isNaN(Number(seconds))) return na
  const total = Math.max(0, Math.round(Number(seconds)))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** e.g. 1/3 (33%) */
function formatRatio(count, started, pct) {
  const p = Number.isFinite(pct) ? Math.round(pct) : 0
  return `${count}/${started} (${p}%)`
}

function formatOptional(value, na = 'N/A') {
  return value == null ? na : String(value)
}

function countPieces(board, color) {
  if (!board) return 0
  let n = 0
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === color) n++
  return n
}

function isValidMove(validMoves, row, col) {
  return validMoves.some(([r, c]) => r === row && c === col)
}

// Mirror backend rules for optimistic human move
const DIRECTIONS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
function collectFlips(board, player, move) {
  const [r, c] = move
  const opp = player === 'W' ? 'B' : 'W'
  if (board[r][c] !== '.' && board[r][c] !== undefined) return []
  const flips = []
  for (const [dr, dc] of DIRECTIONS) {
    const path = []
    let cr = r + dr, cc = c + dc
    while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && board[cr][cc] === opp) {
      path.push([cr, cc])
      cr += dr
      cc += dc
    }
    if (cr >= 0 && cr < 8 && cc >= 0 && cc < 8 && board[cr][cc] === player)
      flips.push(...path)
  }
  return flips
}

function applyMoveToBoard(board, player, move) {
  const next = board.map(row => [...row])
  const flips = collectFlips(next, player, move)
  if (flips.length === 0) return null
  const [r, c] = move
  next[r][c] = player
  flips.forEach(([fr, fc]) => { next[fr][fc] = player })
  return next
}

/** Split AI board delta into placement cells (empty→stone) vs flipped discs. */
function aiMoveHighlights(prevBoard, nextBoard) {
  const placed = new Set()
  const flips = new Set()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const prev = prevBoard[r]?.[c] || '.'
      const next = nextBoard[r]?.[c] || '.'
      if (prev === next) continue
      const key = `${r},${c}`
      if (prev === '.') placed.add(key)
      else flips.add(key)
    }
  }
  return { placed, flips }
}

export default function App() {
  const [lang, setLang] = useState(getInitialLang)
  const t = useCallback((key) => translate(lang, key), [lang])
  const setLanguage = useCallback((next) => {
    if (next !== 'en' && next !== 'ru') return
    setLang(next)
    saveLang(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'en'
  }, [lang])

  const [gameId, setGameId] = useState(null)
  const [game, setGame] = useState(null)
  const [validMoves, setValidMoves] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  /** Optimistic board shown after human move, before AI response */
  const [optimisticBoard, setOptimisticBoard] = useState(null)
  /** Cells where AI placed a stone (brighter highlight) */
  const [aiPlacedCells, setAiPlacedCells] = useState(new Set())
  /** Discs flipped by the AI move (softer highlight) */
  const [highlightCells, setHighlightCells] = useState(new Set())
  /** Cell where human just placed (for brief place animation) */
  const [justPlaced, setJustPlaced] = useState(null)
  const highlightTimerRef = useRef(null)
  const [showInstructions, setShowInstructions] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState(null)
  /** Optional hover / long-press assist: highlight pieces that would flip */
  const [flipForesight, setFlipForesight] = useState(true)
  /** Valid move cell under cursor or after long-press, for flip preview */
  const [hoverMove, setHoverMove] = useState(null)
  /** AI difficulty: easy | medium | hard — locked after the first move */
  const [difficulty, setDifficulty] = useState('easy')
  const longPressRef = useRef(null)
  /** After long-press foresight, ignore the synthetic click on that same cell */
  const suppressClickRef = useRef(null)

  const clearLongPress = useCallback(() => {
    if (longPressRef.current?.timerId != null) {
      clearTimeout(longPressRef.current.timerId)
    }
    longPressRef.current = null
  }, [])

  const clearAiHighlight = useCallback(() => {
    if (highlightTimerRef.current != null) {
      clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
    setAiPlacedCells(new Set())
    setHighlightCells(new Set())
  }, [])

  const showAiHighlight = useCallback(
    (prevBoard, nextBoard) => {
      const { placed, flips } = aiMoveHighlights(prevBoard, nextBoard)
      if (highlightTimerRef.current != null) {
        clearTimeout(highlightTimerRef.current)
      }
      setAiPlacedCells(placed)
      setHighlightCells(flips)
      highlightTimerRef.current = setTimeout(() => {
        setAiPlacedCells(new Set())
        setHighlightCells(new Set())
        highlightTimerRef.current = null
      }, HIGHLIGHT_AI_MS)
    },
    []
  )

  useEffect(() => () => clearLongPress(), [clearLongPress])
  useEffect(() => () => clearAiHighlight(), [clearAiHighlight])

  useEffect(() => {
    if (!flipForesight) {
      clearLongPress()
      setHoverMove(null)
    }
  }, [flipForesight, clearLongPress])

  const fetchGame = useCallback(async (id) => {
    if (!id) return
    setError(null)
    try {
      const res = await fetchApi(`/game/${id}`)
      if (!res.ok) throw new Error(translate(lang, 'failedLoadGame'))
      const data = await res.json()
      setGame(data)
      return data
    } catch (e) {
      setError(e.message)
      return null
    }
  }, [lang])

  const fetchValidMoves = useCallback(async (id) => {
    if (!id) return
    try {
      const res = await fetchApi(`/game/${id}/valid-moves`)
      if (!res.ok) return
      const data = await res.json()
      setValidMoves(data.moves || [])
    } catch {
      setValidMoves([])
    }
  }, [])

  const applyGame = useCallback(
    async (data) => {
      setGameId(data.id)
      setGame(data)
      if (DIFFICULTIES.includes(data.difficulty)) {
        setDifficulty(data.difficulty)
      }
      await fetchValidMoves(data.id)
    },
    [fetchValidMoves]
  )

  /** Restart / Retry: abandon current and start a new game. */
  const createGame = useCallback(
    async (nextDifficulty) => {
      const level = nextDifficulty ?? difficulty
      clearGameBootstrap()
      setLoading(true)
      setError(null)
      setOptimisticBoard(null)
      clearAiHighlight()
      setJustPlaced(null)
      setHoverMove(null)
      setDifficulty(level)
      try {
        const res = await fetchApi('/game', {
          method: 'POST',
          body: JSON.stringify({ difficulty: level }),
        })
        if (!res.ok) throw new Error(translate(lang, 'failedCreateGame'))
        const data = await res.json()
        clearGameBootstrap()
        await applyGame(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [applyGame, clearAiHighlight, difficulty, lang]
  )

  /** First load / reload: resume active game; do not abandon on refresh. */
  const initGame = useCallback(async () => {
    setLoading(true)
    setError(null)
    setOptimisticBoard(null)
    clearAiHighlight()
    setJustPlaced(null)
    setHoverMove(null)
    try {
      const data = await loadOrCreateGame()
      await applyGame(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [applyGame, clearAiHighlight])

  useEffect(() => {
    initGame()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!gameId) return
    fetchValidMoves(gameId)
  }, [gameId, game?.turn, game?.board, fetchValidMoves])

  const playMove = async (row, col) => {
    if (!gameId || game?.status !== 'active') return
    if (game.turn !== 'W') return
    if (!isValidMove(validMoves, row, col)) return
    setError(null)

    const currentBoard = game.board.map(r => [...r])
    const afterHuman = applyMoveToBoard(currentBoard, 'W', [row, col])
    if (!afterHuman) return

    setJustPlaced(`${row},${col}`)
    setOptimisticBoard(afterHuman)
    setValidMoves([])
    clearLongPress()
    suppressClickRef.current = null
    setHoverMove(null)
    setSubmitting(true)

    setTimeout(async () => {
      try {
        const res = await fetchApi(`/game/${gameId}/move`, {
          method: 'POST',
          body: JSON.stringify({ row, col }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || translate(lang, 'invalidMove'))
        }
        const data = await res.json()
        setGame(data)
        setOptimisticBoard(null)
        setJustPlaced(null)
        showAiHighlight(afterHuman, data.board)
        if (data.status === 'finished') {
          setValidMoves([])
        } else {
          await fetchValidMoves(gameId)
        }
      } catch (e) {
        setError(e.message)
        setOptimisticBoard(null)
        setJustPlaced(null)
      } finally {
        setSubmitting(false)
      }
    }, AI_DELAY_MS)
  }

  const playPass = async () => {
    if (!gameId || game?.status !== 'active') return
    if (game.turn !== 'W' || validMoves.length > 0) return
    setError(null)
    const boardBefore = game.board.map((row) => [...row])
    setSubmitting(true)

    setTimeout(async () => {
      try {
        const res = await fetchApi(`/game/${gameId}/pass`, { method: 'POST' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || translate(lang, 'cannotPass'))
        }
        const data = await res.json()
        setGame(data)
        showAiHighlight(boardBefore, data.board)
        if (data.status === 'finished') {
          setValidMoves([])
        } else {
          await fetchValidMoves(gameId)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setSubmitting(false)
      }
    }, AI_DELAY_MS)
  }

  const handleRestart = () => {
    createGame(difficulty)
  }

  const handleDifficultyChange = async (level) => {
    if (!DIFFICULTIES.includes(level)) return
    if (level === difficulty) return
    const pieceCount =
      countPieces(game?.board, 'W') + countPieces(game?.board, 'B')
    const gameStarted =
      Boolean(optimisticBoard) ||
      (game?.status === 'active' && pieceCount > 4)
    if (loading || submitting || gameStarted) return

    const previous = difficulty
    setDifficulty(level)
    if (game?.status !== 'active' || !gameId) return

    try {
      const res = await fetchApi(`/game/${gameId}/difficulty`, {
        method: 'PATCH',
        body: JSON.stringify({ difficulty: level }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || translate(lang, 'failedSetDifficulty'))
      }
      const data = await res.json()
      setGame(data)
      if (DIFFICULTIES.includes(data.difficulty)) {
        setDifficulty(data.difficulty)
      }
    } catch (e) {
      setDifficulty(previous)
      setError(e.message)
    }
  }

  const handleExit = () => {
    window.close()
  }

  const openStats = async () => {
    setShowInstructions(false)
    setShowStats(true)
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await fetchStats()
      if (!res.ok) throw new Error(translate(lang, 'failedLoadStats'))
      setStats(await res.json())
    } catch (e) {
      setStatsError(e.message)
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  const instructionsModal = showInstructions ? (
    <div
      className="modal-overlay"
      onClick={() => setShowInstructions(false)}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="instructions-title">{t('howToPlay')}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowInstructions(false)}
            aria-label={t('closeInstructions')}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>{t('intro')}</p>
          <h3>{t('setup')}</h3>
          <p>{t('setupText')}</p>
          <h3>{t('makeMove')}</h3>
          <p>{t('makeMoveText')}</p>
          <h3>{t('flanking')}</h3>
          <p>{t('flankingText')}</p>
          <h3>{t('mandatory')}</h3>
          <p>{t('mandatoryText')}</p>
          <h3>{t('winning')}</h3>
          <p>{t('winningText')}</p>

          <aside className="instructions-tip" aria-label={t('flipForesightTip')}>
            <h3>{t('flipForesightTip')}</h3>
            <p>{t('flipForesightText')}</p>
          </aside>
        </div>
      </div>
    </div>
  ) : null

  const na = t('na')
  const dateLocale = lang === 'ru' ? 'ru-RU' : 'en-US'
  const statsRows = stats
    ? [
        [
          t('since'),
          stats.since ? new Date(stats.since).toLocaleDateString(dateLocale) : na,
        ],
        [t('days'), String(stats.days ?? 0)],
        [t('gamesStarted'), String(stats.started)],
        [t('gamesFinished'), String(stats.finished)],
        [t('abandoned'), formatRatio(stats.abandoned, stats.started, stats.abandoned_pct)],
        [t('won'), formatRatio(stats.won, stats.finished, stats.won_pct)],
        [t('lost'), formatRatio(stats.lost, stats.finished, stats.lost_pct)],
        [t('tied'), formatRatio(stats.tied, stats.finished, stats.tied_pct)],
        [t('highestScore'), formatOptional(stats.highest_score, na)],
        [
          t('lowestScore'),
          stats.won + stats.lost === 0 ? na : formatOptional(stats.lowest_score, na),
        ],
        [t('averageScore'), formatOptional(stats.avg_score, na)],
        [t('highestMoveScore'), formatOptional(stats.highest_move_score, na)],
        [t('longestWinStreak'), String(stats.longest_win_streak)],
        [t('totalTime'), formatDuration(stats.total_time, na)],
        [t('averageTime'), formatDuration(stats.avg_time, na)],
        [t('minTime'), formatDuration(stats.min_time, na)],
        [t('maxTime'), formatDuration(stats.max_time, na)],
      ]
    : []

  const statsModal = showStats ? (
    <div
      className="modal-overlay"
      onClick={() => setShowStats(false)}
      role="presentation"
    >
      <div
        className="modal modal-stats"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="stats-title">{t('yourStatistics')}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowStats(false)}
            aria-label={t('closeStatistics')}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {statsLoading && <p className="stats-status">{t('loading')}</p>}
          {!statsLoading && statsError && <p className="error">{statsError}</p>}
          {!statsLoading && !statsError && stats && (
            <table className="stats-table">
              <tbody>
                {statsRows.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  ) : null

  const langSwitch = (
    <div className="lang-switch" role="group" aria-label={t('language')}>
      <button
        type="button"
        className={lang === 'en' ? 'active' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLanguage('en')}
      >
        {t('langEng')}
      </button>
      <button
        type="button"
        className={lang === 'ru' ? 'active' : ''}
        aria-pressed={lang === 'ru'}
        onClick={() => setLanguage('ru')}
      >
        {t('langRus')}
      </button>
    </div>
  )

  if (loading && !game) {
    return (
      <>
        <div className="loading">{t('startingGame')}</div>
        {instructionsModal}
        {statsModal}
      </>
    )
  }

  if (error && !game) {
    return (
      <>
        <div className="error">
          {error}
          <br />
          <button className="btn-restart" onClick={() => createGame(difficulty)} style={{ marginTop: 8 }}>
            {t('retry')}
          </button>
        </div>
        {instructionsModal}
        {statsModal}
      </>
    )
  }

  const displayBoard = optimisticBoard ?? game?.board ?? []
  const blackCount = countPieces(displayBoard, 'B')
  const whiteCount = countPieces(displayBoard, 'W')
  const gameStarted =
    Boolean(optimisticBoard) ||
    (game?.status === 'active' && blackCount + whiteCount > 4)
  const canChangeDifficulty = !loading && !submitting && !gameStarted
  const isHumanTurn = game?.turn === 'W' && game?.status === 'active' && !submitting
  const mustPass = isHumanTurn && validMoves.length === 0
  const gameOver = game?.status === 'finished'
  const turnLabel = gameOver
    ? t('gameOver')
    : submitting
      ? t('aiThinking')
      : mustPass
        ? t('mustPass')
        : game?.turn === 'B'
          ? t('aiTurn')
          : t('yourTurn')

  const hoverFlipKeys =
    flipForesight &&
    hoverMove &&
    isHumanTurn &&
    isValidMove(validMoves, hoverMove.row, hoverMove.col)
      ? new Set(
          collectFlips(displayBoard, 'W', [hoverMove.row, hoverMove.col]).map(
            ([fr, fc]) => `${fr},${fc}`
          )
        )
      : new Set()

  return (
    <>
      <div className="layout">
        <div className="main">
          <header className="header">
            <div className="scoreboard" aria-label={t('score')}>
              <div
                className={`score-card black ${game?.turn === 'B' && !gameOver ? 'active' : ''}`}
              >
                <span className="score-disc black" aria-hidden />
                <div className="score-meta">
                  <span className="score-label">{t('blackAi')}</span>
                  <span className="score-value">{blackCount}</span>
                </div>
              </div>
              <div
                className={`score-card white ${game?.turn === 'W' && !gameOver ? 'active' : ''}`}
              >
                <span className="score-disc white" aria-hidden />
                <div className="score-meta">
                  <span className="score-label">{t('whiteYou')}</span>
                  <span className="score-value">{whiteCount}</span>
                </div>
              </div>
            </div>
            <span className="turn-indicator">
              <span
                className={`turn-dot ${game?.turn?.toLowerCase()} ${isHumanTurn && !submitting ? 'pulse' : ''}`}
                aria-hidden
              />
              {turnLabel}
            </span>
          </header>

          {error && <p className="error">{error}</p>}

          <div
            className="board"
            role="grid"
            aria-label={t('board')}
            onMouseLeave={() => {
              if (hasFineHover()) setHoverMove(null)
            }}
          >
            {Array.from({ length: 64 }, (_, i) => {
              const r = Math.floor(i / 8)
              const c = i % 8
              const cell = displayBoard[r]?.[c]
              const empty = !cell || cell === '.'
              const clickable = empty && isValidMove(validMoves, r, c) && isHumanTurn && !gameOver
              const showDot = empty && isValidMove(validMoves, r, c) && isHumanTurn
              const key = `${r},${c}`
              const isAiPlaced = aiPlacedCells.has(key)
              const isHighlight = highlightCells.has(key)
              const isJustPlaced = justPlaced === key
              const isFlipPreview = flipForesight && hoverFlipKeys.has(key)
              const isHoverTarget =
                flipForesight && hoverMove?.row === r && hoverMove?.col === c && clickable
              return (
                <div
                  key={key}
                  role="gridcell"
                  className={`cell ${clickable ? 'clickable' : ''} ${gameOver ? 'game-over' : ''} ${isAiPlaced ? 'highlight-ai-placed' : ''} ${isHighlight ? 'highlight-ai' : ''} ${isJustPlaced ? 'just-placed' : ''} ${isFlipPreview ? 'flip-preview' : ''} ${isHoverTarget ? 'hover-target' : ''}`}
                  onClick={() => {
                    const suppress = suppressClickRef.current
                    if (suppress && suppress.row === r && suppress.col === c) {
                      suppressClickRef.current = null
                      return
                    }
                    suppressClickRef.current = null
                    if (clickable) playMove(r, c)
                  }}
                  onMouseEnter={() => {
                    if (!hasFineHover()) return
                    if (flipForesight && clickable) setHoverMove({ row: r, col: c })
                    else setHoverMove(null)
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse') return
                    clearLongPress()
                    if (!clickable) {
                      setHoverMove(null)
                      return
                    }
                    if (!flipForesight) return
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId)
                    } catch {
                      /* ignore capture failures */
                    }
                    const timerId = window.setTimeout(() => {
                      setHoverMove({ row: r, col: c })
                      if (longPressRef.current) {
                        longPressRef.current.foresightShown = true
                      }
                    }, LONG_PRESS_MS)
                    longPressRef.current = {
                      row: r,
                      col: c,
                      timerId,
                      foresightShown: false,
                    }
                  }}
                  onPointerUp={() => {
                    if (longPressRef.current?.foresightShown) {
                      suppressClickRef.current = { row: r, col: c }
                    }
                    clearLongPress()
                  }}
                  onPointerCancel={() => {
                    clearLongPress()
                  }}
                  onContextMenu={(e) => {
                    if (!hasFineHover() && flipForesight && clickable) {
                      e.preventDefault()
                    }
                  }}
                  aria-label={
                    cell === 'B'
                      ? t('black')
                      : cell === 'W'
                        ? t('white')
                        : showDot
                          ? t('validMove')
                          : t('empty')
                  }
                >
                  {cell === 'B' && <span className="piece black" />}
                  {cell === 'W' && <span className="piece white" />}
                  {showDot && !(isHoverTarget) && <span className="valid-dot" />}
                  {isHoverTarget && <span className="piece white preview-ghost" />}
                </div>
              )
            })}
          </div>

          {gameOver && (
            <p className="status">
              {blackCount > whiteCount
                ? t('blackWins')
                : whiteCount > blackCount
                  ? t('whiteWins')
                  : t('draw')}
            </p>
          )}
        </div>

        <aside className="side-panel" aria-label={t('gameControls')}>
          {langSwitch}
          <button
            type="button"
            className="btn-instructions"
            onClick={() => {
              setShowStats(false)
              setShowInstructions(true)
            }}
          >
            {t('instructions')}
          </button>
          <button type="button" className="btn-instructions" onClick={openStats}>
            {t('statistics')}
          </button>

          <label className="option-toggle" title={t('flipForesightTitle')}>
            <input
              type="checkbox"
              checked={flipForesight}
              onChange={(e) => setFlipForesight(e.target.checked)}
            />
            <span>{t('flipForesight')}</span>
          </label>

          <section
            className="difficulty-block"
            title={
              canChangeDifficulty
                ? t('difficultyTitleUnlocked')
                : t('difficultyTitleLocked')
            }
          >
            <h3 className="difficulty-block-title">{t('difficulty')}</h3>
            <div className="difficulty-options" role="radiogroup" aria-label={t('difficulty')}>
              <label className="option-toggle">
                <input
                  type="checkbox"
                  checked={difficulty === 'easy'}
                  disabled={!canChangeDifficulty}
                  onChange={() => handleDifficultyChange('easy')}
                />
                <span>{t('easy')}</span>
              </label>
              <label className="option-toggle">
                <input
                  type="checkbox"
                  checked={difficulty === 'medium'}
                  disabled={!canChangeDifficulty}
                  onChange={() => handleDifficultyChange('medium')}
                />
                <span>{t('medium')}</span>
              </label>
              <label className="option-toggle">
                <input
                  type="checkbox"
                  checked={difficulty === 'hard'}
                  disabled={!canChangeDifficulty}
                  onChange={() => handleDifficultyChange('hard')}
                />
                <span>{t('hard')}</span>
              </label>
            </div>
          </section>

          <div className="side-panel-actions">
            {mustPass && (
              <button type="button" className="btn-pass" onClick={() => playPass()} disabled={submitting}>
                {t('pass')}
              </button>
            )}
            <button type="button" className="btn-restart" onClick={handleRestart}>
              {t('restart')}
            </button>
            <button type="button" className="btn-exit" onClick={handleExit}>
              {t('exit')}
            </button>
          </div>
        </aside>
      </div>

      {instructionsModal}
      {statsModal}
    </>
  )
}
