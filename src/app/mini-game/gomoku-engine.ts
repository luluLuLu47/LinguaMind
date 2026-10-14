/**
 * 五子棋核心逻辑 — Gomoku Engine
 *
 * 棋盘 15×15，黑子先手。玩家是黑子（●），AI 是白子（○）。
 * 五子连珠（横/竖/斜）即胜。
 *
 * AI 策略：
 * 1. 如果 AI 能一步赢，直接下
 * 2. 如果玩家能一步赢，堵住
 * 3. 否则评估所有空位，选得分最高的
 *    得分 = AI 连子潜力 + 阻断玩家潜力
 */

export const BOARD_SIZE = 15
export const WIN_LENGTH = 5

export type Cell = 0 | 1 | 2  // 0=空, 1=黑(玩家), 2=白(AI)
export type Board = Cell[][]

export interface Move {
  row: number
  col: number
}

export interface GameStats {
  correctAnswers: number
  wrongAnswers: number
  totalQuestions: number
  maxCombo: number
  wordsLearned: string[]  // 答对过的单词
}

export function createBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 0 as Cell)
  )
}

/** 检查是否有人赢，返回获胜方 1/2 或 0 */
export function checkWinner(board: Board): Cell {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c]
      if (cell === 0) continue
      // 检查 4 个方向
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]
      for (const [dr, dc] of dirs) {
        let count = 1
        for (let i = 1; i < WIN_LENGTH; i++) {
          const nr = r + dr * i
          const nc = c + dc * i
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break
          if (board[nr][nc] !== cell) break
          count++
        }
        if (count >= WIN_LENGTH) return cell
      }
    }
  }
  return 0
}

/** 检查棋盘是否满了（平局） */
export function isBoardFull(board: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return false
    }
  }
  return true
}

/** 获取所有空位 */
function getEmptyCells(board: Board): Move[] {
  const cells: Move[] = []
  // 只考虑已有棋子周围 2 格内的空位，大幅减少计算量
  const candidates = new Set<string>()
  let hasStone = false

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) {
        hasStone = true
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr
            const nc = c + dc
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) {
              candidates.add(`${nr},${nc}`)
            }
          }
        }
      }
    }
  }

  // 如果棋盘空，下中心
  if (!hasStone) {
    return [{ row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) }]
  }

  for (const key of candidates) {
    const [r, c] = key.split(",").map(Number)
    cells.push({ row: r, col: c })
  }
  return cells
}

/**
 * 评估某个位置对某方的价值
 * 计算 4 个方向上连子的潜力
 */
function evaluatePosition(board: Board, row: number, col: number, player: Cell): number {
  let totalScore = 0
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]]

  for (const [dr, dc] of dirs) {
    let consecutive = 1   // 假设下了这子后的连子数
    let openEnds = 0      // 开放端数量

    // 正方向
    for (let i = 1; i < 5; i++) {
      const nr = row + dr * i
      const nc = col + dc * i
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break
      if (board[nr][nc] === player) consecutive++
      else {
        if (board[nr][nc] === 0) openEnds++
        break
      }
    }
    // 反方向
    for (let i = 1; i < 5; i++) {
      const nr = row - dr * i
      const nc = col - dc * i
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break
      if (board[nr][nc] === player) consecutive++
      else {
        if (board[nr][nc] === 0) openEnds++
        break
      }
    }

    // 评分表
    if (consecutive >= 5) totalScore += 100000
    else if (consecutive === 4 && openEnds === 2) totalScore += 10000   // 活四
    else if (consecutive === 4 && openEnds === 1) totalScore += 1000   // 冲四
    else if (consecutive === 3 && openEnds === 2) totalScore += 1000   // 活三
    else if (consecutive === 3 && openEnds === 1) totalScore += 100   // 眠三
    else if (consecutive === 2 && openEnds === 2) totalScore += 100   // 活二
    else if (consecutive === 2 && openEnds === 1) totalScore += 10    // 眠二
    else if (consecutive === 1 && openEnds === 2) totalScore += 10
  }

  return totalScore
}

/**
 * AI 决策：
 * 1. 能赢就赢
 * 2. 能堵就堵
 * 3. 否则选最大化 (AI得分 + 玩家得分*0.8) 的位置
 */
export function aiMove(board: Board): Move {
  const emptyCells = getEmptyCells(board)

  // 如果是空棋盘，下中心
  if (emptyCells.length === 1 && board[emptyCells[0].row][emptyCells[0].col] === 0) {
    // 检查是不是真的空棋盘
    let hasStone = true
    for (let r = 0; r < BOARD_SIZE && hasStone; r++) {
      for (let c = 0; c < BOARD_SIZE && hasStone; c++) {
        if (board[r][c] !== 0) hasStone = false
      }
    }
    if (hasStone) return emptyCells[0]
  }

  let bestMove = emptyCells[0]
  let bestScore = -1

  for (const cell of emptyCells) {
    // AI（白子 2）在这个位置的攻击力
    const aiScore = evaluatePosition(board, cell.row, cell.col, 2)
    // 玩家（黑子 1）在这个位置的攻击力（AI 下这里就能防守）
    const playerScore = evaluatePosition(board, cell.row, cell.col, 1)

    // 综合分：攻击 + 防守（防守略低权重，鼓励进攻）
    const score = aiScore + playerScore * 0.85

    if (score > bestScore) {
      bestScore = score
      bestMove = cell
    }
  }

  return bestMove
}

/**
 * 检查某方是否可以一步获胜
 * 返回获胜位置，如果没有返回 null
 */
export function findWinningMove(board: Board, player: Cell): Move | null {
  const emptyCells = getEmptyCells(board)
  for (const cell of emptyCells) {
    board[cell.row][cell.col] = player
    const win = checkWinner(board)
    board[cell.row][cell.col] = 0
    if (win === player) return cell
  }
  return null
}

/**
 * 更聪明的 AI：先检查能不能赢，再检查要不要堵
 */
export function smartAiMove(board: Board): Move {
  // 1. AI 能赢就赢
  const aiWin = findWinningMove(board, 2)
  if (aiWin) return aiWin

  // 2. 玩家能赢就堵
  const playerWin = findWinningMove(board, 1)
  if (playerWin) return playerWin

  // 3. 否则用评估函数
  return aiMove(board)
}
