import { useState, useEffect, useCallback, useRef } from 'react'
import { clearGameBootstrap, fetchApi, fetchStats, loadOrCreateGame } from './api'
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
function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return 'N/A'
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

function formatOptional(value) {
  return value == null ? 'N/A' : String(value)
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
      if (!res.ok) throw new Error('Failed to load game')
      const data = await res.json()
      setGame(data)
      return data
    } catch (e) {
      setError(e.message)
      return null
    }
  }, [])

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
        if (!res.ok) throw new Error('Failed to create game')
        const data = await res.json()
        clearGameBootstrap()
        await applyGame(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [applyGame, clearAiHighlight, difficulty]
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
          throw new Error(err.detail || 'Invalid move')
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
          throw new Error(err.detail || 'Cannot pass')
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
        throw new Error(err.detail || 'Failed to set difficulty')
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
      if (!res.ok) throw new Error('Failed to load statistics')
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
          <h2 id="instructions-title">How to Play</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowInstructions(false)}
            aria-label="Close instructions"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Reversi is a strategy board game for two players where the goal is to finish with
            the most pieces of your color on the 8 × 8 board. Players take turns placing pieces
            with their color facing up. A valid move requires you to &quot;flank&quot; or
            &quot;trap&quot; your opponent&apos;s pieces.
          </p>
          <h3>Setup</h3>
          <p>
            The game begins with 4 pieces in the center squares of the board: two dark pieces
            and two light pieces, placed diagonally across from each other.
          </p>
          <h3>Make a Move</h3>
          <p>
            On your turn, place a new piece on any empty square so that it traps one or more of
            your opponent&apos;s pieces in a straight continuous line. This line can be
            horizontal, vertical, or diagonal.
          </p>
          <h3>Flanking &amp; Flipping</h3>
          <p>
            To trap a line, there must already be one of your pieces at the other end of that
            line. When you successfully flank your opponent&apos;s pieces, you flip all of those
            sandwiched pieces to your color.
          </p>
          <h3>Mandatory Captures</h3>
          <p>
            You can only make a move if it traps and flips at least one of your opponent&apos;s
            pieces. If you have no valid moves, you must &quot;Pass&quot; your turn.
          </p>
          <h3>Winning</h3>
          <p>
            The game ends when the board is completely full, or neither player can make a legal
            move. The player with the highest number of their color disks wins the game.
          </p>

          <aside className="instructions-tip" aria-label="Flip foresight">
            <h3>Flip foresight</h3>
            <p>
              Flip foresight is on by default. On a computer, hover a highlighted legal move to
              preview which opponent pieces would flip. On touch devices, press and hold a legal
              move to preview, then tap to play. Turn it off anytime with the toggle in the side
              panel.
            </p>
          </aside>
        </div>
      </div>
    </div>
  ) : null

  const statsRows = stats
    ? [
        ['Since', stats.since ? new Date(stats.since).toLocaleDateString() : 'N/A'],
        ['Days', String(stats.days ?? 0)],
        ['Games started', String(stats.started)],
        ['Games finished', String(stats.finished)],
        ['Abandoned', formatRatio(stats.abandoned, stats.started, stats.abandoned_pct)],
        ['Won', formatRatio(stats.won, stats.finished, stats.won_pct)],
        ['Lost', formatRatio(stats.lost, stats.finished, stats.lost_pct)],
        ['Tied', formatRatio(stats.tied, stats.finished, stats.tied_pct)],
        ['Highest score', formatOptional(stats.highest_score)],
        [
          'Lowest score',
          stats.won + stats.lost === 0 ? 'N/A' : formatOptional(stats.lowest_score),
        ],
        ['Average score', formatOptional(stats.avg_score)],
        ['Highest move score', formatOptional(stats.highest_move_score)],
        ['Longest win streak', String(stats.longest_win_streak)],
        ['Total time', formatDuration(stats.total_time)],
        ['Average time', formatDuration(stats.avg_time)],
        ['Min time', formatDuration(stats.min_time)],
        ['Max time', formatDuration(stats.max_time)],
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
          <h2 id="stats-title">Your statistics</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowStats(false)}
            aria-label="Close statistics"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {statsLoading && <p className="stats-status">Loading…</p>}
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

  if (loading && !game) {
    return (
      <>
        <div className="loading">Starting game…</div>
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
          <button className="btn-restart" onClick={() => createGame(difficulty)} style={{ marginTop: 8 }}>Retry</button>
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
    ? 'Game over'
    : submitting
      ? 'AI is thinking…'
      : mustPass
        ? 'No legal moves — pass'
        : game?.turn === 'B'
          ? "AI's turn"
          : 'Your turn'

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
            <div className="scoreboard" aria-label="Score">
              <div
                className={`score-card black ${game?.turn === 'B' && !gameOver ? 'active' : ''}`}
              >
                <span className="score-disc black" aria-hidden />
                <div className="score-meta">
                  <span className="score-label">Black · AI</span>
                  <span className="score-value">{blackCount}</span>
                </div>
              </div>
              <div
                className={`score-card white ${game?.turn === 'W' && !gameOver ? 'active' : ''}`}
              >
                <span className="score-disc white" aria-hidden />
                <div className="score-meta">
                  <span className="score-label">White · You</span>
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
            aria-label="Reversi board"
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
                  aria-label={cell === 'B' ? 'Black' : cell === 'W' ? 'White' : showDot ? 'Valid move' : 'Empty'}
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
              {blackCount > whiteCount ? 'Black (AI) wins!' : whiteCount > blackCount ? 'White (You) win!' : 'Draw!'}
            </p>
          )}
        </div>

        <aside className="side-panel" aria-label="Game controls">
          <button
            type="button"
            className="btn-instructions"
            onClick={() => {
              setShowStats(false)
              setShowInstructions(true)
            }}
          >
            Instructions
          </button>
          <button type="button" className="btn-instructions" onClick={openStats}>
            Statistics
          </button>

          <label
            className="option-toggle"
            title="Preview flips on hover (desktop) or press-and-hold (touch)"
          >
            <input
              type="checkbox"
              checked={flipForesight}
              onChange={(e) => setFlipForesight(e.target.checked)}
            />
            <span>Flip foresight</span>
          </label>

          <section
            className="difficulty-block"
            title={
              canChangeDifficulty
                ? 'Choose AI difficulty before the first move'
                : 'Difficulty is locked after the game starts'
            }
          >
            <h3 className="difficulty-block-title">Difficulty</h3>
            <div className="difficulty-options" role="radiogroup" aria-label="Difficulty">
              <label className="option-toggle">
                <input
                  type="checkbox"
                  checked={difficulty === 'easy'}
                  disabled={!canChangeDifficulty}
                  onChange={() => handleDifficultyChange('easy')}
                />
                <span>Easy</span>
              </label>
              <label className="option-toggle">
                <input
                  type="checkbox"
                  checked={difficulty === 'medium'}
                  disabled={!canChangeDifficulty}
                  onChange={() => handleDifficultyChange('medium')}
                />
                <span>Medium</span>
              </label>
              <label className="option-toggle">
                <input
                  type="checkbox"
                  checked={difficulty === 'hard'}
                  disabled={!canChangeDifficulty}
                  onChange={() => handleDifficultyChange('hard')}
                />
                <span>Hard</span>
              </label>
            </div>
          </section>

          <div className="side-panel-actions">
            {mustPass && (
              <button type="button" className="btn-pass" onClick={() => playPass()} disabled={submitting}>
                Pass
              </button>
            )}
            <button type="button" className="btn-restart" onClick={handleRestart}>
              Restart
            </button>
            <button type="button" className="btn-exit" onClick={handleExit}>
              Exit
            </button>
          </div>
        </aside>
      </div>

      {instructionsModal}
      {statsModal}
    </>
  )
}
