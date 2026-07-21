const STORAGE_KEY = 'othello-lang'

export const translations = {
  en: {
    langEng: 'Eng',
    langRus: 'Рус',
    language: 'Language',

    instructions: 'Instructions',
    statistics: 'Statistics',
    flipForesight: 'Flip foresight',
    flipForesightTitle:
      'Preview flips on hover (desktop) or press-and-hold (touch)',
    difficulty: 'Difficulty',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    difficultyTitleUnlocked: 'Choose AI difficulty before the first move',
    difficultyTitleLocked: 'Difficulty is locked after the game starts',
    pass: 'Pass',
    restart: 'Restart',
    exit: 'Exit',
    score: 'Score',
    blackAi: 'Black · AI',
    whiteYou: 'White · You',
    gameOver: 'Game over',
    aiThinking: 'AI is thinking…',
    mustPass: 'No legal moves — pass',
    aiTurn: "AI's turn",
    yourTurn: 'Your turn',
    board: 'Reversi board',
    black: 'Black',
    white: 'White',
    validMove: 'Valid move',
    empty: 'Empty',
    blackWins: 'Black (AI) wins!',
    whiteWins: 'White (You) win!',
    draw: 'Draw!',
    startingGame: 'Starting game…',
    retry: 'Retry',
    gameControls: 'Game controls',

    howToPlay: 'How to Play',
    closeInstructions: 'Close instructions',
    intro:
      'Reversi is a strategy board game for two players where the goal is to finish with the most pieces of your color on the 8 × 8 board. Players take turns placing pieces with their color facing up. A valid move requires you to "flank" or "trap" your opponent\'s pieces.',
    setup: 'Setup',
    setupText:
      'The game begins with 4 pieces in the center squares of the board: two dark pieces and two light pieces, placed diagonally across from each other.',
    makeMove: 'Make a Move',
    makeMoveText:
      "On your turn, place a new piece on any empty square so that it traps one or more of your opponent's pieces in a straight continuous line. This line can be horizontal, vertical, or diagonal.",
    flanking: 'Flanking & Flipping',
    flankingText:
      "To trap a line, there must already be one of your pieces at the other end of that line. When you successfully flank your opponent's pieces, you flip all of those sandwiched pieces to your color.",
    mandatory: 'Mandatory Captures',
    mandatoryText:
      'You can only make a move if it traps and flips at least one of your opponent\'s pieces. If you have no valid moves, you must "Pass" your turn.',
    winning: 'Winning',
    winningText:
      'The game ends when the board is completely full, or neither player can make a legal move. The player with the highest number of their color disks wins the game.',
    flipForesightTip: 'Flip foresight',
    flipForesightText:
      'Flip foresight is on by default. On a computer, hover a highlighted legal move to preview which opponent pieces would flip. On touch devices, press and hold a legal move to preview, then tap to play. Turn it off anytime with the toggle in the side panel.',

    yourStatistics: 'Your statistics',
    closeStatistics: 'Close statistics',
    loading: 'Loading…',
    since: 'Since',
    days: 'Days',
    gamesStarted: 'Games started',
    gamesFinished: 'Games finished',
    abandoned: 'Abandoned',
    won: 'Won',
    lost: 'Lost',
    tied: 'Tied',
    highestScore: 'Highest score',
    lowestScore: 'Lowest score',
    averageScore: 'Average score',
    highestMoveScore: 'Highest move score',
    longestWinStreak: 'Longest win streak',
    totalTime: 'Total time',
    averageTime: 'Average time',
    minTime: 'Min time',
    maxTime: 'Max time',
    na: 'N/A',

    failedLoadGame: 'Failed to load game',
    failedCreateGame: 'Failed to create game',
    invalidMove: 'Invalid move',
    cannotPass: 'Cannot pass',
    failedSetDifficulty: 'Failed to set difficulty',
    failedLoadStats: 'Failed to load statistics',
  },
  ru: {
    langEng: 'Eng',
    langRus: 'Рус',
    language: 'Язык',

    instructions: 'Инструкции',
    statistics: 'Статистика',
    flipForesight: 'Подсказка переворотов',
    flipForesightTitle:
      'Предпросмотр переворотов при наведении (компьютер) или долгом нажатии (сенсор)',
    difficulty: 'Сложность',
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
    difficultyTitleUnlocked: 'Выберите сложность ИИ до первого хода',
    difficultyTitleLocked: 'Сложность нельзя изменить после начала игры',
    pass: 'Пас',
    restart: 'Заново',
    exit: 'Выход',
    score: 'Счёт',
    blackAi: 'Чёрные · ИИ',
    whiteYou: 'Белые · Вы',
    gameOver: 'Игра окончена',
    aiThinking: 'ИИ думает…',
    mustPass: 'Нет ходов — пас',
    aiTurn: 'Ход ИИ',
    yourTurn: 'Ваш ход',
    board: 'Доска Реверси',
    black: 'Чёрный',
    white: 'Белый',
    validMove: 'Допустимый ход',
    empty: 'Пусто',
    blackWins: 'Победа чёрных (ИИ)!',
    whiteWins: 'Победа белых (Вы)!',
    draw: 'Ничья!',
    startingGame: 'Загрузка игры…',
    retry: 'Повторить',
    gameControls: 'Управление',

    howToPlay: 'Как играть',
    closeInstructions: 'Закрыть инструкции',
    intro:
      'Реверси — стратегическая настольная игра для двоих, цель которой — закончить партию с наибольшим числом фишек своего цвета на доске 8 × 8. Игроки по очереди ставят фишки своей стороной вверх. Допустимый ход должен «зажать» или «окружить» фишки соперника.',
    setup: 'Начало',
    setupText:
      'Игра начинается с 4 фишек в центральных клетках доски: две тёмные и две светлые, стоящие по диагонали друг напротив друга.',
    makeMove: 'Как ходить',
    makeMoveText:
      'В свой ход поставьте новую фишку на любую пустую клетку так, чтобы она зажала одну или несколько фишек соперника в непрерывную прямую линию — горизонтальную, вертикальную или диагональную.',
    flanking: 'Захват и переворот',
    flankingText:
      'Чтобы зажать линию, на другом её конце уже должна стоять ваша фишка. Когда вы успешно окружаете фишки соперника, все зажатые фишки переворачиваются на ваш цвет.',
    mandatory: 'Обязательный захват',
    mandatoryText:
      'Ход возможен только если он зажимает и переворачивает хотя бы одну фишку соперника. Если допустимых ходов нет, вы должны сделать «Пас».',
    winning: 'Победа',
    winningText:
      'Игра заканчивается, когда доска полностью заполнена или ни один из игроков не может сделать ход. Побеждает тот, у кого больше фишек своего цвета.',
    flipForesightTip: 'Подсказка переворотов',
    flipForesightText:
      'Подсказка переворотов включена по умолчанию. На компьютере наведите курсор на подсвеченный допустимый ход, чтобы увидеть, какие фишки соперника перевернутся. На сенсорных устройствах зажмите допустимый ход для предпросмотра, затем коснитесь, чтобы сходить. Отключить подсказку можно в любой момент переключателем на боковой панели.',

    yourStatistics: 'Ваша статистика',
    closeStatistics: 'Закрыть статистику',
    loading: 'Загрузка…',
    since: 'С',
    days: 'Дней',
    gamesStarted: 'Начато игр',
    gamesFinished: 'Завершено игр',
    abandoned: 'Брошено',
    won: 'Побед',
    lost: 'Поражений',
    tied: 'Ничьих',
    highestScore: 'Лучший счёт',
    lowestScore: 'Худший счёт',
    averageScore: 'Средний счёт',
    highestMoveScore: 'Лучший ход',
    longestWinStreak: 'Серия побед',
    totalTime: 'Общее время',
    averageTime: 'Среднее время',
    minTime: 'Мин. время',
    maxTime: 'Макс. время',
    na: 'н/д',

    failedLoadGame: 'Не удалось загрузить игру',
    failedCreateGame: 'Не удалось создать игру',
    invalidMove: 'Недопустимый ход',
    cannotPass: 'Нельзя сделать пас',
    failedSetDifficulty: 'Не удалось изменить сложность',
    failedLoadStats: 'Не удалось загрузить статистику',
  },
}

export function getInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ru') return saved
  } catch {
    /* ignore */
  }
  return 'en'
}

export function saveLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

export function translate(lang, key) {
  return translations[lang]?.[key] ?? translations.en[key] ?? key
}
