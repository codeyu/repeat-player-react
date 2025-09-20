# RepeatPlayer React

一个功能强大的React媒体播放器组件，支持AB重复播放、录音、歌词同步和高级播放控制。

## 功能特点

- 🎵 **音频播放**: 支持MP3等音频格式
- 🔁 **AB重复播放**: 设置A、B点进行片段重复播放
- 📝 **歌词同步**: 支持LRC格式歌词文件，实时同步显示
- 🎙️ **录音功能**: 为AB片段录制音频进行对比学习
- ⚡ **变速播放**: 0.5x - 3.0x 播放速度调节
- 📱 **响应式设计**: 使用Tailwind CSS，支持各种屏幕尺寸
- 🎯 **智能滚动**: 自动滚动到当前播放歌词行
- 🔧 **高度可定制**: 支持自定义样式和回调函数

## 安装

```bash
npm install repeat-player-react
```

## 基本用法

```tsx
import React from 'react'
import { RepeatPlayer } from 'repeat-player-react'

function App() {
  const handleAudioFileChange = (file: File | null) => {
    console.log('音频文件:', file)
  }

  const handleLyricsFileChange = (file: File | null) => {
    console.log('歌词文件:', file)
  }

  return (
    <RepeatPlayer
      audioFile={audioFile}
      lyricsFile={lyricsFile}
      onAudioFileChange={handleAudioFileChange}
      onLyricsFileChange={handleLyricsFileChange}
    />
  )
}
```

## API 文档

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `audioFile` | `File \| null` | - | 音频文件 |
| `lyricsFile` | `File \| null` | - | LRC歌词文件 |
| `txtContent` | `string \| null` | - | 纯文本内容 |
| `onAudioFileChange` | `(file: File \| null) => void` | - | 音频文件变化回调 |
| `onLyricsFileChange` | `(file: File \| null) => void` | - | 歌词文件变化回调 |
| `onTxtContentChange` | `(content: string \| null) => void` | - | 文本内容变化回调 |
| `defaultRate` | `number` | `1.0` | 默认播放速度 |
| `minRate` | `number` | `0.5` | 最小播放速度 |
| `maxRate` | `number` | `3.0` | 最大播放速度 |
| `showVideo` | `boolean` | `true` | 是否显示视频元素 |
| `abHistory` | `ABHistoryRecord[]` | `[]` | AB播放历史记录 |
| `onABHistoryChange` | `(history: ABHistoryRecord[]) => void` | - | AB历史变化回调 |
| `onTimeUpdate` | `(currentTime: number, duration: number) => void` | - | 播放时间更新回调 |
| `onLineChange` | `(lineIndex: number, lineText: string) => void` | - | 歌词行变化回调 |
| `onRepeatStart` | `() => void` | - | 重复播放开始回调 |
| `onRepeatEnd` | `() => void` | - | 重复播放结束回调 |
| `onPlay` | `() => void` | - | 播放开始回调 |
| `onPause` | `() => void` | - | 暂停回调 |
| `onStop` | `() => void` | - | 停止回调 |
| `className` | `string` | - | 自定义CSS类名 |
| `showFileUpload` | `boolean` | `true` | 是否显示文件上传区域 |
| `autoPlay` | `boolean` | `false` | 是否自动播放 |

### 类型定义

```typescript
interface ABHistoryRecord {
  id: number
  name: string
  startTime: number
  endTime: number
  createdAt: Date
  recording?: string | null
}

interface PlayerState {
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
  // ... 更多状态
}
```

## 高级功能

### AB重复播放

```tsx
<RepeatPlayer
  abHistory={abHistory}
  onABHistoryChange={setAbHistory}
  onRepeatStart={() => console.log('开始重复播放')}
  onRepeatEnd={() => console.log('结束重复播放')}
/>
```

### 录音功能

组件会自动为每个AB历史记录提供录音功能：
- 点击录音按钮开始录音
- 录音时MP3播放会自动暂停
- 录音完成后可以播放对比

### 歌词同步

```tsx
<RepeatPlayer
  lyricsFile={lrcFile}
  onLineChange={(index, text) => {
    console.log(`当前播放: ${index + 1} - ${text}`)
  }}
/>
```

## 样式定制

组件使用Tailwind CSS，你可以通过`className`属性添加自定义样式：

```tsx
<RepeatPlayer
  className="my-custom-player"
  // 其他属性...
/>
```

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持音频播放和AB重复
- 支持LRC歌词同步
- 支持录音功能
- 支持变速播放
- 支持多种播放控制模式
