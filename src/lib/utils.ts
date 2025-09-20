import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00"
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function parseLRC(lrcContent: string): { lyrics: string[], timecodes: number[] } {
  const lines = lrcContent.split('\n')
  const lyrics: string[] = []
  const timecodes: number[] = []
  
  lines.forEach(line => {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/)
    if (match) {
      const minutes = parseInt(match[1])
      const seconds = parseInt(match[2])
      const hundredths = parseInt(match[3])
      const time = minutes * 60 + seconds + hundredths / 100
      
      timecodes.push(time)
      lyrics.push(match[4].trim())
    }
  })
  
  return { lyrics, timecodes }
}

export function createObjectURL(file: File): string {
  return URL.createObjectURL(file)
}

export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url)
}
