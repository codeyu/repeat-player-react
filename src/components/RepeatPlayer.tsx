'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  Square,
  Rewind,
  FastForward,
  Volume2,
  Settings,
  RotateCcw,
  RotateCw,
  FileAudio,
  FileText,
  Upload,
  X,
  Gauge,
  Hourglass,
  Repeat,
  ArrowLeftToLine,
  ArrowRightToLine,
  PlaySquare,
  Music3,
  ListMusic,
  SendToBack,
  Mic,
  Voicemail,
  Disc,
  GitCompare
} from 'lucide-react'
import { cn, formatTime, parseLRC, createObjectURL, revokeObjectURL } from '@/lib/utils'
import { RepeatPlayerProps, PlayerState, LRCData, ABHistoryRecord } from '@/types/player'

export default function RepeatPlayer({
  audioFile,
  lyricsFile,
  txtContent,
  onAudioFileChange,
  onLyricsFileChange,
  onTxtContentChange,
  defaultRate = 1.0,
  minRate = 0.5,
  maxRate = 3.0,
  showVideo = true,
  abHistory = [],
  onABHistoryChange,
  onTimeUpdate,
  onLineChange,
  onRepeatStart,
  onRepeatEnd,
  onPlay,
  onPause,
  onStop,
  className,
  showFileUpload = true,
  autoPlay = false
}: RepeatPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    currentRate: defaultRate,
    volume: 1,
    currentLineIndex: 0,
    isRepeating: false,
    dotA: 0,
    dotB: 0,
    isASet: false,
    isBSet: false,
    maxRepeats: 0,
    currentRepeats: 0,
    pauseTime: 0,
    // 新增状态
    repeatPauseTime: 0,
    isQuickRepeating: false,
    quickRepeatStartTime: 0,
    quickRepeatCount: 0,
    currentQuickRepeat: 0,
    // 行控制状态
    isRepeatingCurrentLine: false,
    isRepeatingMultipleLines: false,
    isSpeedRepeatingCurrent: false,
    isSpeedRepeatingMultiple: false,
    currentLineRepeatCount: 0,
    multipleLineRepeatCount: 0,
    speedRepeatPhase: 0,
    // 单行播放状态
    isPlayingCurrentLineOnly: false,
    currentLineEndTime: 0,
    // AB历史记录
    abHistory: abHistory
  })
  
  const [lrcData, setLrcData] = useState<LRCData>({ lyrics: [], timecodes: [] })
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const contentContainerRef = useRef<HTMLDivElement>(null)
  
  // 速度控制状态
  const [isDraggingSpeed, setIsDraggingSpeed] = useState(false)
  const speedButtonRef = useRef<HTMLButtonElement>(null)
  
  // 暂停时间控制状态
  const [isDraggingPauseTime, setIsDraggingPauseTime] = useState(false)
  const pauseTimeButtonRef = useRef<HTMLButtonElement>(null)
  
  // 快速重复控制状态
  const [isDraggingQuickRepeat, setIsDraggingQuickRepeat] = useState(false)
  const quickRepeatButtonRef = useRef<HTMLButtonElement>(null)
  
  // 录音状态
  const [isRecording, setIsRecording] = useState(false)
  const [currentRecordingId, setCurrentRecordingId] = useState<number | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [playingRecordingId, setPlayingRecordingId] = useState<number | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [playingABHistoryId, setPlayingABHistoryId] = useState<number | null>(null)
  const compareIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // 字幕区域状态
  const [activeTab, setActiveTab] = useState<'lrc' | 'txt'>('lrc')
  const [isFullPage, setIsFullPage] = useState(false)
  const [fontSize, setFontSize] = useState<number>(14) // 默认字体大小14px
  const [contentHeight, setContentHeight] = useState<number>(0) // 字幕内容总高度
  
  // 文件输入状态
  const [audioInputValue, setAudioInputValue] = useState('')
  const [lyricsInputValue, setLyricsInputValue] = useState('')

  // 清理URL
  useEffect(() => {
    return () => {
      if (audioUrl) {
        revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // 处理音频文件变化
  useEffect(() => {
    if (audioFile) {
      const url = createObjectURL(audioFile)
      setAudioUrl(url)
      if (audioRef.current) {
        audioRef.current.src = url
        if (autoPlay) {
          audioRef.current.play()
        }
      }
    }
  }, [audioFile, autoPlay])

  // 滚动到指定歌词行，确保在可见范围内（仅在容器内滚动）
  const scrollToCurrentLine = useCallback((lineIndex: number) => {
    if (!lyricsContainerRef.current) return

    const container = lyricsContainerRef.current
    const lineElement = container.querySelector(`[data-line-index="${lineIndex}"]`) as HTMLElement
    
    if (!lineElement) return

    // 手动计算滚动位置，确保不影响主画面
    const containerHeight = container.clientHeight
    const containerScrollTop = container.scrollTop
    const lineTop = lineElement.offsetTop
    const lineHeight = lineElement.offsetHeight
    
    // 计算行元素相对于容器可视区域的位置
    const lineTopInViewport = lineTop - containerScrollTop
    const lineBottomInViewport = lineTopInViewport + lineHeight
    
    // 如果行元素不在可视区域内，则滚动
    if (lineTopInViewport < 0 || lineBottomInViewport > containerHeight) {
      // 将行元素滚动到容器中央
      const lineCenter = lineTop + (lineHeight / 2)
      const containerCenter = containerHeight / 2
      const targetScrollTop = lineCenter - containerCenter
      
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      })
    }
  }, [])

  // 处理歌词文件变化
  useEffect(() => {
    if (lyricsFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const parsed = parseLRC(content)
        setLrcData(parsed)
        
        // 重置当前行索引
        setPlayerState(prev => ({ ...prev, currentLineIndex: 0 }))
        
        // 延迟滚动到第一行，确保DOM已渲染
        setTimeout(() => {
          if (parsed.lyrics.length > 0 && activeTab === 'lrc') {
            // 确保滚动条在最顶部
            if (lyricsContainerRef.current) {
              lyricsContainerRef.current.scrollTop = 0
            }
          }
        }, 200)
      }
      reader.readAsText(lyricsFile)
    }
  }, [lyricsFile, scrollToCurrentLine, activeTab])

  // 计算内容高度
  const calculateContentHeight = useCallback(() => {
    if (!contentContainerRef.current) return
    
    // 获取内容容器的实际高度
    const height = contentContainerRef.current.scrollHeight
    setContentHeight(height)
    console.log('字幕内容高度:', height, 'px')
  }, [])

  // 当切换到LRC标签时，滚动到当前播放行（只在标签切换时调用，不在行变化时调用）
  useEffect(() => {
    if (activeTab === 'lrc' && playerState.currentLineIndex >= 0) {
      setTimeout(() => {
        scrollToCurrentLine(playerState.currentLineIndex)
      }, 100)
    }
  }, [activeTab, scrollToCurrentLine]) // 移除playerState.currentLineIndex依赖

  // 计算内容高度
  useEffect(() => {
    // 延迟计算，确保DOM已更新
    const timer = setTimeout(() => {
      calculateContentHeight()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [lrcData, txtContent, fontSize, activeTab, calculateContentHeight])

  // 更新当前歌词行并智能滚动
  const updateCurrentLine = useCallback((currentTime: number) => {
    if (lrcData.timecodes.length === 0) return

    let newIndex = 0
    for (let i = 0; i < lrcData.timecodes.length; i++) {
      if (lrcData.timecodes[i] <= currentTime) {
        newIndex = i
      } else {
        break
      }
    }

    if (newIndex !== playerState.currentLineIndex) {
      console.log(`🔄 Line changed from ${playerState.currentLineIndex} to ${newIndex}`)
      setPlayerState(prev => ({ ...prev, currentLineIndex: newIndex }))
      onLineChange?.(newIndex, lrcData.lyrics[newIndex] || '')
      
      // 延迟滚动，确保DOM已更新，并且只在LRC标签时滚动
      setTimeout(() => {
        if (activeTab === 'lrc') {
          console.log(`📜 Calling scrollToCurrentLine with index: ${newIndex}`)
          scrollToCurrentLine(newIndex)
        }
      }, 50)
    }
  }, [lrcData, playerState.currentLineIndex, onLineChange, scrollToCurrentLine, activeTab])

  const handleSeek = useCallback((time: number) => {
    // 清除所有重复播放和对比播放状态
    setIsComparing(false)
    setPlayingRecordingId(null)
    setPlayingABHistoryId(null)
    if (compareIntervalRef.current) {
      clearInterval(compareIntervalRef.current)
      compareIntervalRef.current = null
    }
    
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setPlayerState(prev => ({ 
        ...prev, 
        currentTime: time,
        // 清除非AB的重复播放状态，保留AB重复状态
        isQuickRepeating: false,
        isRepeatingCurrentLine: false,
        isRepeatingMultipleLines: false,
        isSpeedRepeatingCurrent: false,
        isSpeedRepeatingMultiple: false,
        isPlayingCurrentLineOnly: false,
        currentQuickRepeat: 0,
        currentLineRepeatCount: 0,
        multipleLineRepeatCount: 0,
        speedRepeatPhase: 0
      }))
    }
    
    // 更新当前歌词行
    updateCurrentLine(time)
  }, [updateCurrentLine])

  // 音频事件处理
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && !isDraggingProgress) {
      const { currentTime, duration } = audioRef.current
      setPlayerState(prev => ({ ...prev, currentTime, duration }))
      onTimeUpdate?.(currentTime, duration)
      
      // 更新当前歌词行
      updateCurrentLine(currentTime)
      
      // 如果正在对比播放，不执行其他重复播放逻辑
      if (isComparing) {
        return
      }
      
      // 检查是否需要重复播放
      if (playerState.isRepeating && playerState.isASet && playerState.isBSet) {
        const startTime = Math.min(playerState.dotA, playerState.dotB)
        const endTime = Math.max(playerState.dotA, playerState.dotB)
        
        // 如果播放时间超过B点，跳回到A点
        if (currentTime >= endTime) {
          // 立即跳转到A点
          if (audioRef.current) {
            audioRef.current.currentTime = startTime
          }
          // 更新状态
          setPlayerState(prev => ({ ...prev, currentTime: startTime }))
          // 更新歌词行
          updateCurrentLine(startTime)
        }
      }
      
      // 检查快速重复播放
      if (playerState.isQuickRepeating) {
        const startTime = playerState.quickRepeatStartTime
        const endTime = playerState.quickRepeatStartTime + 5 // 5秒区间
        
        // 如果播放时间超过结束时间，跳回到开始时间
        if (currentTime >= endTime) {
          // 增加重复次数
          const newCurrentRepeat = playerState.currentQuickRepeat + 1
          
          // 检查是否达到设定的重复次数
          if (playerState.quickRepeatCount > 0 && newCurrentRepeat >= playerState.quickRepeatCount) {
            // 达到设定次数，停止重复
            setPlayerState(prev => ({ 
              ...prev, 
              isQuickRepeating: false,
              currentQuickRepeat: 0
            }))
            audioRef.current?.pause()
            setPlayerState(prev => ({ ...prev, isPlaying: false }))
            onPause?.()
          } else {
            // 继续重复
            if (audioRef.current) {
              audioRef.current.currentTime = startTime
            }
            setPlayerState(prev => ({ 
              ...prev, 
              currentTime: startTime,
              currentQuickRepeat: newCurrentRepeat
            }))
            updateCurrentLine(startTime)
          }
        }
      }
      
      // 检查重复播放当前行
      if (playerState.isRepeatingCurrentLine && lrcData.timecodes.length > 0) {
        const currentLineIndex = playerState.currentLineIndex
        if (currentLineIndex >= 0 && currentLineIndex < lrcData.timecodes.length) {
          const startTime = lrcData.timecodes[currentLineIndex]
          const endTime = currentLineIndex < lrcData.timecodes.length - 1 
            ? lrcData.timecodes[currentLineIndex + 1] 
            : playerState.duration
          
          if (currentTime >= endTime) {
            // 当前行播放完毕，跳回开始
            if (audioRef.current) {
              audioRef.current.currentTime = startTime
            }
            setPlayerState(prev => ({ 
              ...prev, 
              currentTime: startTime,
              currentLineRepeatCount: prev.currentLineRepeatCount + 1
            }))
            updateCurrentLine(startTime)
          }
        }
      }
      
      // 检查重复播放多行
      if (playerState.isRepeatingMultipleLines && lrcData.timecodes.length > 0) {
        const currentLineIndex = playerState.currentLineIndex
        if (currentLineIndex >= 0 && currentLineIndex < lrcData.timecodes.length) {
          const startTime = lrcData.timecodes[currentLineIndex]
          const endTime = currentLineIndex < lrcData.timecodes.length - 1 
            ? lrcData.timecodes[currentLineIndex + 1] 
            : playerState.duration
          
          if (currentTime >= endTime) {
            const newRepeatCount = playerState.multipleLineRepeatCount + 1
            
            if (newRepeatCount >= 3) {
              // 当前行重复3次完成，移动到下一行
              if (currentLineIndex < lrcData.timecodes.length - 1) {
                const nextIndex = currentLineIndex + 1
                const nextTime = lrcData.timecodes[nextIndex]
                setPlayerState(prev => ({ 
                  ...prev, 
                  currentLineIndex: nextIndex,
                  currentTime: nextTime,
                  multipleLineRepeatCount: 0
                }))
                if (audioRef.current) {
                  audioRef.current.currentTime = nextTime
                }
                updateCurrentLine(nextTime)
              } else {
                // 已经是最后一行，停止重复
                setPlayerState(prev => ({ 
                  ...prev, 
                  isRepeatingMultipleLines: false,
                  multipleLineRepeatCount: 0
                }))
                audioRef.current?.pause()
                setPlayerState(prev => ({ ...prev, isPlaying: false }))
                onPause?.()
              }
            } else {
              // 继续重复当前行
              if (audioRef.current) {
                audioRef.current.currentTime = startTime
              }
              setPlayerState(prev => ({ 
                ...prev, 
                currentTime: startTime,
                multipleLineRepeatCount: newRepeatCount
              }))
              updateCurrentLine(startTime)
            }
          }
        }
      }
      
      // 检查变速重复当前行
      if (playerState.isSpeedRepeatingCurrent && lrcData.timecodes.length > 0) {
        const currentLineIndex = playerState.currentLineIndex
        if (currentLineIndex >= 0 && currentLineIndex < lrcData.timecodes.length) {
          const startTime = lrcData.timecodes[currentLineIndex]
          const endTime = currentLineIndex < lrcData.timecodes.length - 1 
            ? lrcData.timecodes[currentLineIndex + 1] 
            : playerState.duration
          
          if (currentTime >= endTime) {
            // 当前阶段播放完毕，切换到下一阶段
            const nextPhase = (playerState.speedRepeatPhase + 1) % 3
            const speeds = [0.7, 1.0, 1.5]
            const nextSpeed = speeds[nextPhase]
            
            setPlayerState(prev => ({ 
              ...prev, 
              speedRepeatPhase: nextPhase,
              currentRate: nextSpeed,
              currentTime: startTime
            }))
            
            if (audioRef.current) {
              audioRef.current.currentTime = startTime
              audioRef.current.playbackRate = nextSpeed
            }
            updateCurrentLine(startTime)
          }
        }
      }
      
      // 检查变速重复多行
      if (playerState.isSpeedRepeatingMultiple && lrcData.timecodes.length > 0) {
        const currentLineIndex = playerState.currentLineIndex
        if (currentLineIndex >= 0 && currentLineIndex < lrcData.timecodes.length) {
          const startTime = lrcData.timecodes[currentLineIndex]
          const endTime = currentLineIndex < lrcData.timecodes.length - 1 
            ? lrcData.timecodes[currentLineIndex + 1] 
            : playerState.duration
          
          if (currentTime >= endTime) {
            // 当前阶段播放完毕
            const nextPhase = (playerState.speedRepeatPhase + 1) % 3
            const speeds = [0.7, 1.0, 1.5]
            
            if (nextPhase === 0) {
              // 完成一轮变速，移动到下一行
              if (currentLineIndex < lrcData.timecodes.length - 1) {
                const nextIndex = currentLineIndex + 1
                const nextTime = lrcData.timecodes[nextIndex]
                setPlayerState(prev => ({ 
                  ...prev, 
                  currentLineIndex: nextIndex,
                  currentTime: nextTime,
                  speedRepeatPhase: 0,
                  currentRate: speeds[0]
                }))
                if (audioRef.current) {
                  audioRef.current.currentTime = nextTime
                  audioRef.current.playbackRate = speeds[0]
                }
                updateCurrentLine(nextTime)
              } else {
                // 已经是最后一行，停止重复
                setPlayerState(prev => ({ 
                  ...prev, 
                  isSpeedRepeatingMultiple: false,
                  speedRepeatPhase: 0
                }))
                audioRef.current?.pause()
                setPlayerState(prev => ({ ...prev, isPlaying: false }))
                onPause?.()
              }
            } else {
              // 继续当前行的下一阶段
              const nextSpeed = speeds[nextPhase]
              setPlayerState(prev => ({ 
                ...prev, 
                speedRepeatPhase: nextPhase,
                currentRate: nextSpeed,
                currentTime: startTime
              }))
              if (audioRef.current) {
                audioRef.current.currentTime = startTime
                audioRef.current.playbackRate = nextSpeed
              }
              updateCurrentLine(startTime)
            }
          }
        }
      }
      
      // 检查单行播放是否结束
      if (playerState.isPlayingCurrentLineOnly && currentTime >= playerState.currentLineEndTime) {
        // 单行播放结束，停止播放
        audioRef.current?.pause()
        setPlayerState(prev => ({ 
          ...prev, 
          isPlaying: false,
          isPlayingCurrentLineOnly: false,
          currentLineEndTime: 0
        }))
        onPause?.()
      }
    }
  }, [isDraggingProgress, onTimeUpdate, updateCurrentLine, playerState.isRepeating, playerState.isASet, playerState.isBSet, playerState.dotA, playerState.dotB, playerState.isQuickRepeating, playerState.quickRepeatStartTime, playerState.quickRepeatCount, playerState.currentQuickRepeat, playerState.isRepeatingCurrentLine, playerState.isRepeatingMultipleLines, playerState.isSpeedRepeatingCurrent, playerState.isSpeedRepeatingMultiple, playerState.currentLineIndex, playerState.multipleLineRepeatCount, playerState.speedRepeatPhase, playerState.isPlayingCurrentLineOnly, playerState.currentLineEndTime, lrcData, onPause])

  const handlePlay = useCallback(() => {
    // 清除所有重复播放和对比播放状态
    setIsComparing(false)
    setPlayingRecordingId(null)
    setPlayingABHistoryId(null)
    if (compareIntervalRef.current) {
      clearInterval(compareIntervalRef.current)
      compareIntervalRef.current = null
    }
    
    audioRef.current?.play()
    setPlayerState(prev => ({ 
      ...prev, 
      isPlaying: true,
      // 清除非AB的重复播放状态，保留AB重复状态
      isQuickRepeating: false,
      isRepeatingCurrentLine: false,
      isRepeatingMultipleLines: false,
      isSpeedRepeatingCurrent: false,
      isSpeedRepeatingMultiple: false,
      isPlayingCurrentLineOnly: false,
      currentLineEndTime: 0,
      currentQuickRepeat: 0,
      currentLineRepeatCount: 0,
      multipleLineRepeatCount: 0,
      speedRepeatPhase: 0
    }))
    onPlay?.()
  }, [onPlay])

  const handlePause = useCallback(() => {
    // 清除所有重复播放和对比播放状态
    setIsComparing(false)
    setPlayingRecordingId(null)
    setPlayingABHistoryId(null)
    if (compareIntervalRef.current) {
      clearInterval(compareIntervalRef.current)
      compareIntervalRef.current = null
    }
    
    audioRef.current?.pause()
    setPlayerState(prev => ({ 
      ...prev, 
      isPlaying: false,
      // 清除非AB的重复播放状态，保留AB重复状态
      isQuickRepeating: false,
      isRepeatingCurrentLine: false,
      isRepeatingMultipleLines: false,
      isSpeedRepeatingCurrent: false,
      isSpeedRepeatingMultiple: false,
      isPlayingCurrentLineOnly: false,
      currentQuickRepeat: 0,
      currentLineRepeatCount: 0,
      multipleLineRepeatCount: 0,
      speedRepeatPhase: 0
    }))
    onPause?.()
  }, [onPause])

  const handleStop = useCallback(() => {
    // 清除所有重复播放和对比播放状态
    setIsComparing(false)
    setPlayingRecordingId(null)
    setPlayingABHistoryId(null)
    if (compareIntervalRef.current) {
      clearInterval(compareIntervalRef.current)
      compareIntervalRef.current = null
    }
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlayerState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      currentTime: 0,
      currentLineIndex: 0, // 重置到第一行
      // 清除所有重复播放状态
      isRepeating: false,
      isQuickRepeating: false,
      isRepeatingCurrentLine: false,
      isRepeatingMultipleLines: false,
      isSpeedRepeatingCurrent: false,
      isSpeedRepeatingMultiple: false,
      isPlayingCurrentLineOnly: false,
      currentQuickRepeat: 0,
      currentLineRepeatCount: 0,
      multipleLineRepeatCount: 0,
      speedRepeatPhase: 0,
      // 清除AB点状态
      isASet: false,
      isBSet: false,
      dotA: 0,
      dotB: 0
    }))
    
    // 滚动到顶部
    setTimeout(() => {
      if (lyricsContainerRef.current && activeTab === 'lrc') {
        lyricsContainerRef.current.scrollTop = 0
      }
    }, 100)
    
    onStop?.()
  }, [onStop, activeTab])

  const handleSpeedChange = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
      setPlayerState(prev => ({ ...prev, currentRate: rate }))
    }
  }, [])

  // 速度控制：拖动调整速度
  const handleSpeedMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDraggingSpeed(true)
    
    const startY = e.clientY
    const startRate = playerState.currentRate
    let hasMoved = false
    
    const handleMouseMove = (e: MouseEvent) => {
      hasMoved = true
      const deltaY = startY - e.clientY // 向上为正，向下为负
      const deltaRate = deltaY * 0.005 // 调整灵敏度
      const newRate = Math.max(0.5, Math.min(3.0, startRate + deltaRate))
      
      // 四舍五入到0.1的倍数
      const roundedRate = Math.round(newRate * 10) / 10
      handleSpeedChange(roundedRate)
    }
    
    const handleMouseUp = () => {
      setIsDraggingSpeed(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      
      // 如果没有移动，则重置到1x
      if (!hasMoved) {
        handleSpeedChange(defaultRate)
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [playerState.currentRate, handleSpeedChange, defaultRate])

  // 暂停时间控制：拖动调整暂停时间
  const handlePauseTimeMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDraggingPauseTime(true)
    
    const startY = e.clientY
    const startPauseTime = playerState.repeatPauseTime
    let hasMoved = false
    
    const handleMouseMove = (e: MouseEvent) => {
      hasMoved = true
      const deltaY = startY - e.clientY // 向上为正，向下为负
      const deltaPauseTime = Math.round(deltaY / 50) // 每50px增加1秒
      const newPauseTime = Math.max(0, Math.min(10, startPauseTime + deltaPauseTime))
      
      setPlayerState(prev => ({ ...prev, repeatPauseTime: newPauseTime }))
    }
    
    const handleMouseUp = () => {
      setIsDraggingPauseTime(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      
      // 如果没有移动，则重置到0秒
      if (!hasMoved) {
        setPlayerState(prev => ({ ...prev, repeatPauseTime: 0 }))
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [playerState.repeatPauseTime])

  // 快速重复控制：拖动调整重复次数
  const handleQuickRepeatMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsDraggingQuickRepeat(true)
    
    const startY = e.clientY
    const startCount = playerState.quickRepeatCount
    let hasMoved = false
    
    const handleMouseMove = (e: MouseEvent) => {
      hasMoved = true
      const deltaY = startY - e.clientY // 向上为正，向下为负
      const deltaCount = Math.round(deltaY / 50) // 每50px增加1次
      const newCount = Math.max(0, Math.min(10, startCount + deltaCount))
      
      setPlayerState(prev => ({ ...prev, quickRepeatCount: newCount }))
    }
    
    const handleMouseUp = () => {
      setIsDraggingQuickRepeat(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      
      // 如果没有移动，则切换快速重复状态
      if (!hasMoved) {
        if (playerState.isQuickRepeating) {
          // 停止快速重复
          setPlayerState(prev => ({ 
            ...prev, 
            isQuickRepeating: false, 
            currentQuickRepeat: 0 
          }))
        } else {
          // 开始快速重复
          if (audioRef.current) {
            const currentTime = audioRef.current.currentTime
            const startTime = Math.max(0, currentTime - 5)
            setPlayerState(prev => ({ 
              ...prev, 
              isQuickRepeating: true,
              quickRepeatStartTime: startTime,
              currentQuickRepeat: 0
            }))
            handleSeek(startTime)
            handlePlay()
          }
        }
      }
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [playerState.isQuickRepeating, playerState.quickRepeatCount, handleSeek, handlePlay])

  // 播放当前行
  const handlePlayCurrentLine = useCallback(() => {
    if (lrcData.timecodes.length === 0) return
    
    const currentLineIndex = playerState.currentLineIndex
    if (currentLineIndex >= 0 && currentLineIndex < lrcData.timecodes.length) {
      const startTime = lrcData.timecodes[currentLineIndex]
      const endTime = currentLineIndex < lrcData.timecodes.length - 1 
        ? lrcData.timecodes[currentLineIndex + 1] 
        : playerState.duration
      
      handleSeek(startTime)
      handlePlay()
      
      // 设置一个状态标记，在handleTimeUpdate中检查是否到达结束时间
      setPlayerState(prev => ({ 
        ...prev, 
        isPlayingCurrentLineOnly: true,
        currentLineEndTime: endTime
      }))
    }
  }, [lrcData, playerState.currentLineIndex, playerState.duration, handleSeek, handlePlay])

  // 上一行
  const handlePreviousLine = useCallback(() => {
    if (playerState.currentLineIndex > 0) {
      const newIndex = playerState.currentLineIndex - 1
      const newTime = lrcData.timecodes[newIndex]
      setPlayerState(prev => ({ ...prev, currentLineIndex: newIndex }))
      handleSeek(newTime)
      updateCurrentLine(newTime)
    }
  }, [playerState.currentLineIndex, lrcData, handleSeek, updateCurrentLine])

  // 下一行
  const handleNextLine = useCallback(() => {
    if (playerState.currentLineIndex < lrcData.timecodes.length - 1) {
      const newIndex = playerState.currentLineIndex + 1
      const newTime = lrcData.timecodes[newIndex]
      setPlayerState(prev => ({ ...prev, currentLineIndex: newIndex }))
      handleSeek(newTime)
      updateCurrentLine(newTime)
    }
  }, [playerState.currentLineIndex, lrcData, handleSeek, updateCurrentLine])

  // 重复播放当前行
  const handleRepeatCurrentLine = useCallback(() => {
    if (playerState.isRepeatingCurrentLine) {
      // 停止重复
      setPlayerState(prev => ({ 
        ...prev, 
        isRepeatingCurrentLine: false,
        currentLineRepeatCount: 0
      }))
    } else {
      // 开始重复当前行
      setPlayerState(prev => ({ 
        ...prev, 
        isRepeatingCurrentLine: true,
        currentLineRepeatCount: 0
      }))
    }
  }, [playerState.isRepeatingCurrentLine])

  // 重复播放多行
  const handleRepeatMultipleLines = useCallback(() => {
    if (playerState.isRepeatingMultipleLines) {
      // 停止重复
      setPlayerState(prev => ({ 
        ...prev, 
        isRepeatingMultipleLines: false,
        multipleLineRepeatCount: 0
      }))
    } else {
      // 开始重复多行
      setPlayerState(prev => ({ 
        ...prev, 
        isRepeatingMultipleLines: true,
        multipleLineRepeatCount: 0
      }))
    }
  }, [playerState.isRepeatingMultipleLines])

  // 变速重复当前行
  const handleSpeedRepeatCurrent = useCallback(() => {
    if (playerState.isSpeedRepeatingCurrent) {
      // 停止变速重复
      setPlayerState(prev => ({ 
        ...prev, 
        isSpeedRepeatingCurrent: false,
        speedRepeatPhase: 0
      }))
    } else {
      // 开始变速重复当前行
      setPlayerState(prev => ({ 
        ...prev, 
        isSpeedRepeatingCurrent: true,
        speedRepeatPhase: 0
      }))
    }
  }, [playerState.isSpeedRepeatingCurrent])

  // 变速重复多行
  const handleSpeedRepeatMultiple = useCallback(() => {
    if (playerState.isSpeedRepeatingMultiple) {
      // 停止变速重复
      setPlayerState(prev => ({ 
        ...prev, 
        isSpeedRepeatingMultiple: false,
        speedRepeatPhase: 0
      }))
    } else {
      // 开始变速重复多行
      setPlayerState(prev => ({ 
        ...prev, 
        isSpeedRepeatingMultiple: true,
        speedRepeatPhase: 0
      }))
    }
  }, [playerState.isSpeedRepeatingMultiple])

  // AB复读功能
  const startABRepeat = useCallback(() => {
    if (playerState.isASet && playerState.isBSet) {
      const startTime = Math.min(playerState.dotA, playerState.dotB)
      const endTime = Math.max(playerState.dotA, playerState.dotB)
      
      // 检查是否已存在相同的AB记录
      const existsRecord = playerState.abHistory.find(record => 
        Math.abs(record.startTime - startTime) < 0.1 && 
        Math.abs(record.endTime - endTime) < 0.1
      )
      
      let newHistory = playerState.abHistory
      
      // 如果不存在相同的记录，才添加新记录
      if (!existsRecord) {
        const newRecord = {
          id: Date.now(),
          name: `AB ${playerState.abHistory.length + 1}`,
          startTime,
          endTime,
          createdAt: new Date()
        }
        
        newHistory = [...playerState.abHistory, newRecord].slice(-10) // 最多保存10条记录
        
        // 通知父组件AB历史记录已更新
        onABHistoryChange?.(newHistory)
      }
      
      setPlayerState(prev => ({ 
        ...prev, 
        dotA: startTime, 
        dotB: endTime, 
        isRepeating: true,
        abHistory: newHistory
      }))
      
      handleSeek(startTime)
      handlePlay()
      onRepeatStart?.()
    }
  }, [playerState.isASet, playerState.isBSet, playerState.dotA, playerState.dotB, playerState.abHistory, handleSeek, handlePlay, onRepeatStart, onABHistoryChange])

  const setPointA = useCallback(() => {
    setPlayerState(prev => {
      const newState = { ...prev, dotA: prev.currentTime, isASet: true }
      return newState
    })
  }, [])

  const setPointB = useCallback(() => {
    setPlayerState(prev => {
      const newState = { ...prev, dotB: prev.currentTime, isBSet: true }
      return newState
    })
  }, [])

  const clearAB = useCallback(() => {
    setPlayerState(prev => ({ 
      ...prev, 
      isASet: false, 
      isBSet: false, 
      isRepeating: false 
    }))
    onRepeatEnd?.()
  }, [onRepeatEnd])

  // 播放AB历史记录
  const playABHistory = useCallback((record: ABHistoryRecord) => {
    // 设置正在播放的AB历史记录ID
    setPlayingABHistoryId(record.id)
    
    // 清除对比播放状态
    setIsComparing(false)
    setPlayingRecordingId(null)
    if (compareIntervalRef.current) {
      clearInterval(compareIntervalRef.current)
      compareIntervalRef.current = null
    }
    
    setPlayerState(prev => ({ 
      ...prev, 
      dotA: record.startTime,
      dotB: record.endTime,
      isASet: true,
      isBSet: true,
      isRepeating: true,
      isPlaying: true,
      // 清除非AB的重复播放状态
      isQuickRepeating: false,
      isRepeatingCurrentLine: false,
      isRepeatingMultipleLines: false,
      isSpeedRepeatingCurrent: false,
      isSpeedRepeatingMultiple: false,
      isPlayingCurrentLineOnly: false,
      currentQuickRepeat: 0,
      currentLineRepeatCount: 0,
      multipleLineRepeatCount: 0,
      speedRepeatPhase: 0
    }))
    
    // 直接控制音频播放，避免调用handlePlay清除状态
    if (audioRef.current) {
      audioRef.current.currentTime = record.startTime
      audioRef.current.play()
    }
    
    onRepeatStart?.()
  }, [onRepeatStart])

  // 删除AB历史记录
  const deleteABHistory = useCallback((recordId: number) => {
    const newHistory = playerState.abHistory.filter(record => record.id !== recordId)
    setPlayerState(prev => ({ 
      ...prev, 
      abHistory: newHistory
    }))
    
    // 通知父组件AB历史记录已更新
    onABHistoryChange?.(newHistory)
  }, [playerState.abHistory, onABHistoryChange])

  // 开始录音
  const startRecording = useCallback(async (recordId: number) => {
    try {
      // 暂停MP3播放
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        setPlayerState(prev => ({ ...prev, isPlaying: false }))
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      // 检查支持的MIME类型
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg']
      let mimeType = 'audio/webm'
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      console.log('使用录音格式:', mimeType)
      
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (event) => {
        console.log('录音数据:', event.data.size, 'bytes')
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        console.log('录音完成，Blob大小:', blob.size, 'bytes, URL:', url)
        
        // 更新AB历史记录，添加录音
        const newHistory = playerState.abHistory.map(record => 
          record.id === recordId 
            ? { ...record, recording: url }
            : record
        )
        
        setPlayerState(prev => ({ 
          ...prev, 
          abHistory: newHistory
        }))
        
        onABHistoryChange?.(newHistory)
        
        // 停止所有音频轨道
        stream.getTracks().forEach(track => track.stop())
      }
      
      recorder.start()
      setMediaRecorder(recorder)
      setRecordedChunks(chunks)
      setIsRecording(true)
      setCurrentRecordingId(recordId)
      
    } catch (error) {
      console.error('录音失败:', error)
      alert('无法访问麦克风，请检查权限设置')
    }
  }, [playerState.abHistory, onABHistoryChange])

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      setCurrentRecordingId(null)
      setMediaRecorder(null)
      setRecordedChunks([])
    }
  }, [mediaRecorder, isRecording])

  // 播放录音
  const playRecording = useCallback((recordingUrl: string, recordId: number) => {
    console.log('尝试播放录音:', recordingUrl)
    const audio = new Audio(recordingUrl)
    
    // 设置播放状态
    setPlayingRecordingId(recordId)
    
    audio.addEventListener('loadstart', () => console.log('开始加载录音'))
    audio.addEventListener('canplay', () => console.log('录音可以播放'))
    audio.addEventListener('ended', () => {
      console.log('录音播放结束')
      setPlayingRecordingId(null)
    })
    audio.addEventListener('error', (e) => {
      console.error('录音播放错误:', e)
      setPlayingRecordingId(null)
    })
    
    audio.play().catch(error => {
      console.error('播放录音失败:', error)
      alert('播放录音失败，请检查录音文件')
      setPlayingRecordingId(null)
    })
  }, [])

  // 重新录音
  const reRecord = useCallback((recordId: number) => {
    // 清除现有录音
    const newHistory = playerState.abHistory.map(record => 
      record.id === recordId 
        ? { ...record, recording: null }
        : record
    )
    
    setPlayerState(prev => ({ 
      ...prev, 
      abHistory: newHistory
    }))
    
    onABHistoryChange?.(newHistory)
    
    // 开始新的录音
    startRecording(recordId)
  }, [playerState.abHistory, onABHistoryChange, startRecording])

  // 对比播放功能
  const handleComparePlayback = useCallback(() => {
    // 如果正在对比播放，停止播放
    if (isComparing) {
      console.log('停止对比播放')
      setIsComparing(false)
      setPlayingRecordingId(null)
      
      // 停止主音频播放
      if (audioRef.current) {
        audioRef.current.pause()
      }
      
      // 清除定时器
      if (compareIntervalRef.current) {
        clearInterval(compareIntervalRef.current)
        compareIntervalRef.current = null
      }
      
      return
    }

    console.log('开始对比播放检查...')
    console.log('当前AB状态:', { isASet: playerState.isASet, isBSet: playerState.isBSet, dotA: playerState.dotA, dotB: playerState.dotB })
    console.log('AB历史记录:', playerState.abHistory)
    
    if (!playerState.isASet || !playerState.isBSet) {
      console.log('对比播放失败：请先设置A点和B点')
      return
    }

    // 查找当前AB音段对应的历史记录
    const currentABRecord = playerState.abHistory.find(record => 
      Math.abs(record.startTime - playerState.dotA) < 0.1 && 
      Math.abs(record.endTime - playerState.dotB) < 0.1
    )

    console.log('找到的匹配记录:', currentABRecord)

    if (!currentABRecord || !currentABRecord.recording) {
      console.log('对比播放失败：未找到对应的录音文件，请先录制')
      return
    }

    console.log('开始对比播放：先播放AB音段，再播放录音')
    
    // 停止所有其他重复播放状态
    setPlayerState(prev => ({
      ...prev,
      isRepeating: false,
      isQuickRepeating: false,
      isRepeatingCurrentLine: false,
      isRepeatingMultipleLines: false,
      isSpeedRepeatingCurrent: false,
      isSpeedRepeatingMultiple: false,
      isPlayingCurrentLineOnly: false
    }))
    
    setIsComparing(true)

    // 先播放AB音段
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = playerState.dotA
      audio.play()

      // 使用定时器而不是事件监听器，避免与主handleTimeUpdate冲突
      compareIntervalRef.current = setInterval(() => {
        // 检查是否还在对比播放状态，如果被停止则清除定时器
        if (!isComparing) {
          console.log('对比播放被停止，清除定时器')
          if (compareIntervalRef.current) {
            clearInterval(compareIntervalRef.current)
            compareIntervalRef.current = null
          }
          return
        }
        
        console.log('AB播放中，当前时间:', audio.currentTime, '目标B点:', playerState.dotB)
        if (audio.currentTime >= playerState.dotB) {
          console.log('AB段播放完成，准备播放录音')
          audio.pause()
          
          // 清除定时器
          if (compareIntervalRef.current) {
            clearInterval(compareIntervalRef.current)
            compareIntervalRef.current = null
          }
          
          // 再次检查是否还在对比播放状态
          if (!isComparing) {
            console.log('对比播放被停止，不播放录音')
            return
          }
          
          // 停顿0.5秒后播放录音
          setTimeout(() => {
            // 最后一次检查状态
            if (!isComparing) {
              console.log('对比播放被停止，取消录音播放')
              return
            }
            
            console.log('开始播放录音:', currentABRecord.recording)
            const recordingAudio = new Audio(currentABRecord.recording!)
            
            recordingAudio.addEventListener('loadstart', () => console.log('录音开始加载'))
            recordingAudio.addEventListener('canplay', () => console.log('录音可以播放'))
            recordingAudio.addEventListener('ended', () => {
              console.log('录音播放完成')
              setIsComparing(false)
              setPlayingRecordingId(null)
            })
            
            recordingAudio.addEventListener('error', (e) => {
              console.error('播放录音失败:', e)
              setIsComparing(false)
              setPlayingRecordingId(null)
            })
            
            setPlayingRecordingId(currentABRecord.id)
            recordingAudio.play().then(() => {
              console.log('录音播放成功开始')
            }).catch(error => {
              console.error('播放录音失败:', error)
              setIsComparing(false)
              setPlayingRecordingId(null)
            })
          }, 500)
        }
      }, 100) // 每100ms检查一次
    }
  }, [isComparing, playerState.isASet, playerState.isBSet, playerState.dotA, playerState.dotB, playerState.abHistory])

  // AB按钮切换功能
  const toggleABRepeat = useCallback(() => {
    if (playerState.isRepeating) {
      // 如果正在重复，停止重复播放
      setPlayerState(prev => ({ ...prev, isRepeating: false }))
      setPlayingABHistoryId(null) // 清除AB历史播放状态
      onRepeatEnd?.()
    } else {
      // 如果未重复，开始重复播放
      startABRepeat()
    }
  }, [playerState.isRepeating, startABRepeat, onRepeatEnd])

  // 进度条交互
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || isDraggingProgress) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percentage * playerState.duration
    
    handleSeek(newTime)
    updateCurrentLine(newTime)
  }, [isDraggingProgress, playerState.duration, handleSeek, updateCurrentLine])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingProgress(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current) return
      
      const rect = progressBarRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      const newTime = percentage * playerState.duration
      
      // 更新显示但不播放
      setPlayerState(prev => ({ ...prev, currentTime: newTime }))
      updateCurrentLine(newTime)
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!progressBarRef.current) return
      
      const rect = progressBarRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      const newTime = percentage * playerState.duration
      
      handleSeek(newTime)
      updateCurrentLine(newTime)
      
      setIsDraggingProgress(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [playerState.duration, handleSeek, updateCurrentLine])

  // 文件上传处理
  const handleAudioFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    onAudioFileChange?.(file)
  }, [onAudioFileChange])

  const handleLyricsFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    onLyricsFileChange?.(file)
    
    // 如果是txt文件，读取内容并设置到txtContent
    if (file && (file.name.endsWith('.txt') || file.type === 'text/plain')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        onTxtContentChange?.(content)
        setActiveTab('txt') // 切换到txt标签
      }
      reader.readAsText(file)
    }
  }, [onLyricsFileChange, onTxtContentChange])

  // 上传音频文件
  const handleUploadAudioFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      onAudioFileChange?.(file)
      setAudioInputValue(file.name)
    }
  }, [onAudioFileChange])

  // 加载音频URL
  const handleLoadAudioUrl = useCallback(async () => {
    if (!audioInputValue.trim()) return
    
    try {
      const response = await fetch(audioInputValue.trim())
      const blob = await response.blob()
      const file = new File([blob], 'audio.mp3', { type: blob.type })
      onAudioFileChange?.(file)
      setAudioInputValue(file.name)
    } catch (error) {
      console.error('Failed to load audio URL:', error)
      alert('加载音频URL失败')
    }
  }, [audioInputValue, onAudioFileChange])

  // 上传歌词文件
  const handleUploadLyricsFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      onLyricsFileChange?.(file)
      setLyricsInputValue(file.name)
      
      // 如果是txt文件，读取内容
      if (file.name.endsWith('.txt') || file.type === 'text/plain') {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          onTxtContentChange?.(content)
          setActiveTab('txt')
        }
        reader.readAsText(file)
      }
    }
  }, [onLyricsFileChange, onTxtContentChange])

  // 加载歌词URL
  const handleLoadLyricsUrl = useCallback(async () => {
    if (!lyricsInputValue.trim()) return
    
    try {
      const response = await fetch(lyricsInputValue.trim())
      const content = await response.text()
      
      if (lyricsInputValue.endsWith('.lrc')) {
        // LRC文件
        const lrcData = parseLRC(content)
        setLrcData(lrcData)
        const file = new File([content], 'lyrics.lrc', { type: 'text/plain' })
        onLyricsFileChange?.(file)
      } else {
        // 文本文件
        onTxtContentChange?.(content)
        setActiveTab('txt')
        const file = new File([content], 'lyrics.txt', { type: 'text/plain' })
        onLyricsFileChange?.(file)
      }
      
      setLyricsInputValue('lyrics file loaded')
    } catch (error) {
      console.error('Failed to load lyrics URL:', error)
      alert('加载歌词URL失败')
    }
  }, [lyricsInputValue, onLyricsFileChange, onTxtContentChange])

  // 歌词行点击
  const handleLyricLineClick = useCallback((index: number) => {
    if (lrcData.timecodes[index] !== undefined) {
      handleSeek(lrcData.timecodes[index])
      setPlayerState(prev => ({ ...prev, currentLineIndex: index }))
      
      // 延迟滚动，确保状态更新完成
      setTimeout(() => {
        scrollToCurrentLine(index)
      }, 10)
    }
  }, [lrcData.timecodes, handleSeek, scrollToCurrentLine])

  // 字幕区域控制函数
  const handleFullPage = useCallback(() => {
    setIsFullPage(true)
    // 延迟计算高度，确保DOM已更新
    setTimeout(() => {
      calculateContentHeight()
    }, 100)
  }, [calculateContentHeight])

  const handleScrollMode = useCallback(() => {
    setIsFullPage(false)
  }, [])

  const handleSmallFont = useCallback(() => {
    setFontSize(prev => Math.max(8, prev - 2)) // 每次减小2px，最小8px
  }, [])

  const handleLargeFont = useCallback(() => {
    setFontSize(prev => Math.min(32, prev + 2)) // 每次增大2px，最大32px
  }, [])

  // 获取字体大小样式
  const getFontSizeStyle = () => {
    return { fontSize: `${fontSize}px` }
  }

  // 获取容器高度样式
  const getContainerHeightClass = () => {
    return isFullPage ? '' : 'max-h-60'
  }

  // 获取容器高度样式（内联样式）
  const getContainerHeightStyle = () => {
    if (isFullPage && contentHeight > 0) {
      // 全页模式：使用内容高度 + 一些padding
      const calculatedHeight = Math.min(contentHeight + 32, window.innerHeight * 0.7)
      return { height: `${calculatedHeight}px` }
    }
    return isFullPage ? { height: '70vh' } : {}
  }

  // 渲染歌词区域
  const renderLyrics = () => {
    const hasLrcContent = lrcData.lyrics.length > 0
    const hasTxtContent = txtContent && txtContent.trim().length > 0

    // 如果没有内容，不显示歌词区域
    if (!hasLrcContent && !hasTxtContent) return null

    return (
      <div className="bg-white border-t border-gray-200">
        {/* 标签页和控制按钮 */}
        <div className="flex items-center justify-between p-2 border-b border-gray-100">
          {/* 左侧标签页 */}
          <div className="flex space-x-1">
            {hasLrcContent && (
              <button
                onClick={() => setActiveTab('lrc')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  activeTab === 'lrc' 
                    ? "bg-primary-100 text-primary-700" 
                    : "text-gray-600 hover:text-gray-800"
                )}
              >
                LRC
              </button>
            )}
            {hasTxtContent && (
              <button
                onClick={() => setActiveTab('txt')}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  activeTab === 'txt' 
                    ? "bg-primary-100 text-primary-700" 
                    : "text-gray-600 hover:text-gray-800"
                )}
              >
                TXT
              </button>
            )}
          </div>

          {/* 右侧控制按钮 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handleFullPage}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                isFullPage 
                  ? "bg-blue-100 text-blue-700" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              )}
              title="全页显示"
            >
              全页
            </button>
            <button
              onClick={handleScrollMode}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                !isFullPage 
                  ? "bg-blue-100 text-blue-700" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              )}
              title="滚动模式"
            >
              滚动
            </button>
            <button
              onClick={handleSmallFont}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                fontSize <= 10
                  ? "bg-green-100 text-green-700" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              )}
              title={`减小字体 (当前: ${fontSize}px)`}
              disabled={fontSize <= 8}
            >
              小字
            </button>
            <button
              onClick={handleLargeFont}
              className={cn(
                "px-2 py-1 text-xs rounded transition-colors",
                fontSize >= 20
                  ? "bg-green-100 text-green-700" 
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              )}
              title={`增大字体 (当前: ${fontSize}px)`}
              disabled={fontSize >= 32}
            >
              大字
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div 
          ref={lyricsContainerRef}
          className={cn(
            "overflow-y-auto bg-white",
            getContainerHeightClass()
          )}
          style={{ 
            scrollBehavior: 'smooth',
            contain: 'layout style', // 限制滚动影响范围
            ...getContainerHeightStyle()
          }}
        >
          <div ref={contentContainerRef}>
          {activeTab === 'lrc' && hasLrcContent && (
            <div className="p-2">
              {lrcData.lyrics.map((line, index) => (
                <div
                  key={index}
                  data-line-index={index}
                  className={cn(
                    "flex items-center px-3 py-2 mb-1 rounded cursor-pointer transition-all duration-200",
                    "hover:bg-gray-50",
                    index === playerState.currentLineIndex && "bg-primary-50 border-l-4 border-primary-500 shadow-sm"
                  )}
                  onClick={() => handleLyricLineClick(index)}
                >
                  <span 
                    className={cn(
                      "w-8 mr-3 transition-colors flex-shrink-0",
                      index === playerState.currentLineIndex ? "text-primary-600 font-medium" : "text-gray-500"
                    )}
                    style={getFontSizeStyle()}
                  >
                    {index + 1}
                  </span>
                  <span 
                    className={cn(
                      "transition-colors leading-relaxed",
                      index === playerState.currentLineIndex ? "text-primary-800 font-medium" : "text-gray-700"
                    )}
                    style={getFontSizeStyle()}
                  >
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'txt' && hasTxtContent && (
            <div className="p-4">
              <div 
                className={cn(
                  "leading-relaxed whitespace-pre-wrap",
                  "text-gray-800"
                )}
                style={getFontSizeStyle()}
              >
                {txtContent}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden", className)}>
      {/* 音频元素 */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handlePause}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setPlayerState(prev => ({ ...prev, duration: audioRef.current!.duration }))
          }
        }}
      />

      {/* 文件上传区域 */}
      {showFileUpload && (
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
          <div className="space-y-2">
            {/* 音频输入 */}
            <div className="flex items-center space-x-2">
              <FileAudio className="w-4 h-4 text-gray-400" />
              <div className="flex-1 flex space-x-1">
                <input
                  type="text"
                  placeholder="输入音频URL或显示文件名..."
                  value={audioInputValue}
                  onChange={(e) => setAudioInputValue(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="px-2 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 cursor-pointer">
                  上传MP3
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleUploadAudioFile}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleLoadAudioUrl}
                  disabled={!audioInputValue.trim()}
                  className="px-2 py-1.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  加载URL
                </button>
              </div>
            </div>

            {/* 歌词输入 */}
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <div className="flex-1 flex space-x-1">
                <input
                  type="text"
                  placeholder="输入歌词URL或显示文件名..."
                  value={lyricsInputValue}
                  onChange={(e) => setLyricsInputValue(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="px-2 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 cursor-pointer">
                  上传字幕
                  <input
                    type="file"
                    accept=".lrc,.txt"
                    onChange={handleUploadLyricsFile}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleLoadLyricsUrl}
                  disabled={!lyricsInputValue.trim()}
                  className="px-2 py-1.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  加载URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 播放器主体 */}
      <div className="p-4">
        {/* 进度条 */}
        <div className="mb-4">
          <div
            ref={progressBarRef}
            className="relative h-3 bg-gray-200 rounded-full cursor-pointer select-none"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
          >
            <div
              className="absolute top-0 left-0 h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${playerState.duration ? (playerState.currentTime / playerState.duration) * 100 : 0}%` }}
            />
            
            {/* 进度滑块 */}
            <div
              className={cn(
                "absolute top-1/2 w-4 h-4 bg-white border-2 border-primary-500 rounded-full transform -translate-y-1/2 cursor-pointer transition-all",
                isDraggingProgress ? "scale-110 shadow-lg" : "hover:scale-110"
              )}
              style={{ left: `${playerState.duration ? (playerState.currentTime / playerState.duration) * 100 : 0}%` }}
            />
            
            {/* A/B点标记 */}
            {playerState.isASet && (
              <div
                className="absolute top-0 w-5 h-5 bg-success-500 rounded-full flex items-center justify-center text-white text-xs font-bold transform -translate-y-1"
                style={{ left: `${playerState.duration ? (playerState.dotA / playerState.duration) * 100 : 0}%` }}
              >
                A
              </div>
            )}
            {playerState.isBSet && (
              <div
                className="absolute top-0 w-5 h-5 bg-danger-500 rounded-full flex items-center justify-center text-white text-xs font-bold transform -translate-y-1"
                style={{ left: `${playerState.duration ? (playerState.dotB / playerState.duration) * 100 : 0}%` }}
              >
                B
              </div>
            )}
          </div>
          
          {/* 时间显示 */}
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>{formatTime(playerState.currentTime)}</span>
            <span>{formatTime(playerState.duration)}</span>
          </div>
        </div>

        {/* AB历史记录 */}
        <div className="space-y-2 mb-4 min-h-[3rem]">
          {/* AB播放按钮 */}
          <div className="flex items-center justify-start space-x-2">
            {playerState.abHistory.length > 0 ? (
              playerState.abHistory.map((record, index) => (
                <div
                  key={record.id}
                  className="relative group"
                >
                  <button
                    onClick={() => playABHistory(record)}
                    className={cn(
                      "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200 border-2 cursor-pointer text-xs font-medium",
                      playingABHistoryId === record.id
                        ? "bg-blue-100 text-blue-700 border-blue-300 animate-pulse"
                        : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    )}
                    title={playingABHistoryId === record.id ? `正在播放 ${record.name}` : `播放 ${record.name}: ${formatTime(record.startTime)} - ${formatTime(record.endTime)}`}
                  >
                    AB{index + 1}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteABHistory(record.id)
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                    title="删除此记录"
                  >
                    ×
                  </button>
                </div>
                ))
              ) : null}
            </div>
            
            {/* 录音按钮 */}
            <div className="flex items-center justify-start space-x-2">
              {playerState.abHistory.length > 0 ? (
                playerState.abHistory.map((record, index) => (
                <div
                  key={`record-${record.id}`}
                  className="relative group"
                >
                  {!record.recording ? (
                    // 录音按钮
                    <button
                      onClick={() => {
                        if (isRecording && currentRecordingId === record.id) {
                          stopRecording()
                        } else {
                          startRecording(record.id)
                        }
                      }}
                      className={cn(
                        "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200 border-2 cursor-pointer text-xs",
                        isRecording && currentRecordingId === record.id
                          ? "bg-red-100 text-red-700 border-red-300 animate-pulse"
                          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                      )}
                      title={isRecording && currentRecordingId === record.id ? "点击停止录音" : "点击开始录音"}
                      disabled={isRecording && currentRecordingId !== record.id}
                    >
                      {isRecording && currentRecordingId === record.id ? (
                        <Disc className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    // 播放录音按钮
                    <div className="relative group">
                      <button
                        onClick={() => playRecording(record.recording!, record.id)}
                        className={cn(
                          "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200 border-2 cursor-pointer text-xs",
                          playingRecordingId === record.id
                            ? "bg-green-100 text-green-700 border-green-300 animate-pulse"
                            : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        )}
                        title="播放录音"
                      >
                        <Voicemail className={cn(
                          "w-4 h-4",
                          playingRecordingId === record.id && "animate-pulse"
                        )} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          reRecord(record.id)
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-blue-600"
                        title="重新录音"
                      >
                        <Mic className="w-2 h-2" />
                      </button>
                    </div>
                  )}
                </div>
                ))
              ) : null}
            </div>
          </div>

        {/* AB复读控制 */}
        <div className="flex items-center justify-center space-x-3 mb-4">
          <button
            onClick={setPointA}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer font-bold",
              playerState.isASet 
                ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200" 
                : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            )}
            title="设置A点"
          >
            A
          </button>
          
          <button
            onClick={setPointB}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer font-bold",
              playerState.isBSet 
                ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200" 
                : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            )}
            title="设置B点"
          >
            B
          </button>
          
          <button
            onClick={clearAB}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            title="清除AB点"
          >
            <X className="w-4 h-4" />
          </button>
          
          <button
            onClick={toggleABRepeat}
            disabled={!playerState.isASet || !playerState.isBSet}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 font-bold",
              !playerState.isASet || !playerState.isBSet
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                : playerState.isRepeating
                  ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            )}
            title={playerState.isRepeating ? "停止AB复读" : "开始AB复读"}
          >
            AB
          </button>
          
          <button
            onClick={handleComparePlayback}
            disabled={(!playerState.isASet || !playerState.isBSet) && !isComparing}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer",
              (!playerState.isASet || !playerState.isBSet) && !isComparing
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                : isComparing
                  ? "bg-blue-100 text-blue-700 border-blue-300 animate-pulse hover:bg-blue-200"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
            )}
            title={isComparing ? "点击停止对比播放" : "对比播放AB音段和录音"}
          >
            <GitCompare className="w-4 h-4" />
          </button>
        </div>

        {/* 播放控制按钮组 */}
        <div className="flex items-center justify-center space-x-3 mb-4">
          {/* 主要播放控制按钮 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={playerState.isPlaying ? handlePause : handlePlay}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="播放/暂停"
            >
              {playerState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            
            <button
              onClick={handleStop}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="停止"
            >
              <Square className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleSeek(Math.max(0, playerState.currentTime - 3))}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="快退3秒"
            >
              <Rewind className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleSeek(Math.min(playerState.duration, playerState.currentTime + 3))}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="快进3秒"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          {/* 分隔线 */}
          <div className="flex items-center justify-center text-gray-400 text-lg font-bold mx-2">
            |
          </div>

          {/* 行控制按钮组 */}
          <div className="flex items-center space-x-2">
            {/* 播放当前行 */}
            <button
              onClick={handlePlayCurrentLine}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="播放当前行，播完自动停止"
            >
                <PlaySquare className="w-4 h-4" />
            </button>

            {/* 上一行 */}
            <button
              onClick={handlePreviousLine}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="移动到上一行"
            >
              <ArrowLeftToLine className="w-4 h-4" />
            </button>

            {/* 下一行 */}
            <button
              onClick={handleNextLine}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              title="移动到下一行"
            >
              <ArrowRightToLine className="w-4 h-4" />
            </button>

            {/* 重复播放当前行 */}
            <button
              onClick={handleRepeatCurrentLine}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer",
                playerState.isRepeatingCurrentLine
                  ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="重复播放当前行"
            >
              <Music3 className="w-4 h-4" />
            </button>

            {/* 重复播放多行 */}
            <button
              onClick={handleRepeatMultipleLines}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer",
                playerState.isRepeatingMultipleLines
                  ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="重复播放多行，每行重复3次"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* 变速重复当前行 */}
            <button
              onClick={handleSpeedRepeatCurrent}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer",
                playerState.isSpeedRepeatingCurrent
                  ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="变速重复当前行：0.7x→1x→1.5x循环"
            >
              <Music3 className="w-4 h-4" /><Gauge className="w-3 h-3" />
            </button>

            {/* 变速重复多行 */}
            <button
              onClick={handleSpeedRepeatMultiple}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer",
                playerState.isSpeedRepeatingMultiple
                  ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="变速重复多行：每行0.7x→1x→1.5x"
            >
              <ListMusic className="w-4 h-4" /><Gauge className="w-3 h-3" />
            </button>
          </div>

          {/* 第二个分隔线 */}
          <div className="flex items-center justify-center text-gray-400 text-lg font-bold mx-2">
            |
          </div>

          {/* 速度和暂停时间控制 */}
          <div className="flex items-center space-x-2">
            <button
              ref={speedButtonRef}
              onMouseDown={handleSpeedMouseDown}
              className={cn(
                "flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer select-none",
                isDraggingSpeed
                  ? "bg-blue-100 text-blue-700 border-blue-300 shadow-lg transform scale-105"
                  : playerState.currentRate !== defaultRate
                    ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                    : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="点击重置到1x，拖动调整速度"
            >
              <Gauge className="w-3 h-3 mb-0.5" />
              <span className="text-xs font-medium">{playerState.currentRate.toFixed(1)}x</span>
            </button>
            
            {/* 暂停时间控制按钮 */}
            <button
              ref={pauseTimeButtonRef}
              onMouseDown={handlePauseTimeMouseDown}
              className={cn(
                "flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer select-none",
                isDraggingPauseTime
                  ? "bg-blue-100 text-blue-700 border-blue-300 shadow-lg transform scale-105"
                  : playerState.repeatPauseTime > 0
                    ? "bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200"
                    : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="点击重置到0秒，拖动调整暂停时间"
            >
              <Hourglass className="w-3 h-3 mb-0.5" />
              <span className="text-xs font-medium">{playerState.repeatPauseTime}s</span>
            </button>
            
            {/* 快速重复控制按钮 */}
            <button
              ref={quickRepeatButtonRef}
              onMouseDown={handleQuickRepeatMouseDown}
              className={cn(
                "flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 border-2 cursor-pointer select-none",
                isDraggingQuickRepeat
                  ? "bg-blue-100 text-blue-700 border-blue-300 shadow-lg transform scale-105"
                  : playerState.isQuickRepeating
                    ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                    : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              )}
              title="点击切换快速重复，拖动调整重复次数"
            >
              <SendToBack className="w-3 h-3 mb-0.5" />
              <span className="text-xs font-medium">
                {playerState.quickRepeatCount > 0 ? playerState.quickRepeatCount.toString() : '0'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 歌词区域 */}
      {renderLyrics()}
    </div>
  )
}
