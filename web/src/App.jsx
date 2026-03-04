import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API = 'http://127.0.0.1:8000'
const AI_DELAY_MS = 1400
const HIGHLIGHT_AI_MS = 800

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

function cellsChanged(prevBoard, nextBoard) {
  const set = new Set()
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((prevBoard[r]?.[c] || '.') !== (nextBoard[r]?.[c] || '.'))
        set.add(`${r},${c}`)
  return set
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
  /** Cells that just changed from AI move (for highlight animation) */
  const [highlightCells, setHighlightCells] = useState(new Set())
  /** Cell where human just placed (for brief place animation) */
  const [justPlaced, setJustPlaced] = useState(null)

  const fetchGame = useCallback(async (id) => {
    if (!id) return
    setError(null)
    try {
      const res = await fetch(`${API}/game/${id}`)
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
      const res = await fetch(`${API}/game/${id}/valid-moves`)
      if (!res.ok) return
      const data = await res.json()
      setValidMoves(data.moves || [])
    } catch {
      setValidMoves([])
    }
  }, [])

  const createGame = useCallback(async () => {
    setLoading(true)
    setError(null)
    setOptimisticBoard(null)
    setHighlightCells(new Set())
    setJustPlaced(null)
    try {
      const res = await fetch(`${API}/game`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create game')
      const data = await res.json()
      setGameId(data.id)
      setGame(data)
      await fetchValidMoves(data.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fetchValidMoves])

  useEffect(() => {
    createGame()
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
    setSubmitting(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/game/${gameId}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row, col }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Invalid move')
        }
        const data = await res.json()
        const changed = cellsChanged(afterHuman, data.board)
        setGame(data)
        setOptimisticBoard(null)
        setJustPlaced(null)
        setHighlightCells(changed)
        await fetchValidMoves(gameId)
        setTimeout(() => setHighlightCells(new Set()), HIGHLIGHT_AI_MS)
      } catch (e) {
        setError(e.message)
        setOptimisticBoard(null)
        setJustPlaced(null)
      } finally {
        setSubmitting(false)
      }
    }, AI_DELAY_MS)
  }

  const handleRestart = () => {
    createGame()
  }

  const handleExit = () => {
    if (typeof window.Telegram?.WebApp?.close === 'function') {
      window.Telegram.WebApp.close()
    } else {
      window.close()
    }
  }

  if (loading && !game) {
    return <div className="loading">Starting game…</div>
  }

  if (error && !game) {
    return (
      <div className="error">
        {error}
        <br />
        <button className="btn-restart" onClick={createGame} style={{ marginTop: 8 }}>Retry</button>
      </div>
    )
  }

  const displayBoard = optimisticBoard ?? game?.board ?? []
  const blackCount = countPieces(displayBoard, 'B')
  const whiteCount = countPieces(displayBoard, 'W')
  const isHumanTurn = game?.turn === 'W' && game?.status === 'active' && !submitting
  const gameOver = game?.status === 'finished'
  const turnLabel = gameOver
    ? 'Game over'
    : submitting
      ? 'AI is thinking…'
      : game?.turn === 'B'
        ? "AI's turn"
        : 'Your turn'

  return (
    <>
      <header className="header">
        <span className="score">Black: {blackCount} – White: {whiteCount}</span>
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
      >
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8)
          const c = i % 8
          const cell = displayBoard[r]?.[c]
          const empty = !cell || cell === '.'
          const clickable = empty && isValidMove(validMoves, r, c) && isHumanTurn && !gameOver
          const showDot = empty && isValidMove(validMoves, r, c) && isHumanTurn
          const key = `${r},${c}`
          const isHighlight = highlightCells.has(key)
          const isJustPlaced = justPlaced === key
          return (
            <div
              key={key}
              role="gridcell"
              className={`cell ${clickable ? 'clickable' : ''} ${gameOver ? 'game-over' : ''} ${isHighlight ? 'highlight-ai' : ''} ${isJustPlaced ? 'just-placed' : ''}`}
              onClick={() => clickable && playMove(r, c)}
              aria-label={cell === 'B' ? 'Black' : cell === 'W' ? 'White' : showDot ? 'Valid move' : 'Empty'}
            >
              {cell === 'B' && <span className="piece black" />}
              {cell === 'W' && <span className="piece white" />}
              {showDot && <span className="valid-dot" />}
            </div>
          )
        })}
      </div>

      {gameOver && (
        <p className="status">
          {blackCount > whiteCount ? 'Black (AI) wins!' : whiteCount > blackCount ? 'White (You) win!' : 'Draw!'}
        </p>
      )}

      <footer className="footer">
        <button type="button" className="btn-restart" onClick={handleRestart}>
          Restart
        </button>
        <button type="button" className="btn-exit" onClick={handleExit}>
          Exit
        </button>
      </footer>
    </>
  )
}
