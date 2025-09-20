export interface ABHistoryRecord {
  id: number
  name: string
  startTime: number
  endTime: number
  createdAt: Date
  recording?: string | null  // 录音文件的URL或Blob
}

export interface RepeatPlayerProps {
  // 文件上传属性
  audioFile?: File | null
  lyricsFile?: File | null
  txtContent?: string | null
  onAudioFileChange?: (file: File | null) => void
  onLyricsFileChange?: (file: File | null) => void
  onTxtContentChange?: (content: string | null) => void
  
  // 播放器配置
  defaultRate?: number
  minRate?: number
  maxRate?: number
  showVideo?: boolean
  
  // AB历史记录属性
  abHistory?: ABHistoryRecord[]
  onABHistoryChange?: (history: ABHistoryRecord[]) => void
  
  // 事件回调
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onLineChange?: (index: number, text: string) => void
  onRepeatStart?: () => void
  onRepeatEnd?: () => void
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  
  // UI配置
  className?: string
  showFileUpload?: boolean
  autoPlay?: boolean
}

export interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  currentRate: number
  volume: number
  currentLineIndex: number
  isRepeating: boolean
  dotA: number
  dotB: number
  isASet: boolean
  isBSet: boolean
  maxRepeats: number
  currentRepeats: number
  pauseTime: number
  // 新增状态
  repeatPauseTime: number  // 复读暂停时间（0-10秒）
  isQuickRepeating: boolean  // 是否在快速重复播放
  quickRepeatStartTime: number  // 快速重复开始时间
  quickRepeatCount: number  // 快速重复次数设置（0-10，0表示不控制）
  currentQuickRepeat: number  // 当前快速重复次数
  // 行控制状态
  isRepeatingCurrentLine: boolean  // 是否在重复播放当前行
  isRepeatingMultipleLines: boolean  // 是否在重复播放多行
  isSpeedRepeatingCurrent: boolean  // 是否在变速重复当前行
  isSpeedRepeatingMultiple: boolean  // 是否在变速重复多行
  currentLineRepeatCount: number  // 当前行重复次数
  multipleLineRepeatCount: number  // 多行重复次数
  speedRepeatPhase: number  // 变速重复阶段（0:0.7x, 1:1x, 2:1.5x）
  // 单行播放状态
  isPlayingCurrentLineOnly: boolean  // 是否只播放当前行
  currentLineEndTime: number  // 当前行结束时间
  // AB历史记录
  abHistory: ABHistoryRecord[]  // AB播放历史记录
}

export interface LRCData {
  lyrics: string[]
  timecodes: number[]
}
