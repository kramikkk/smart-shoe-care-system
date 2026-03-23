'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useDeviceFilter } from '@/contexts/DeviceFilterContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Terminal, Wifi, WifiOff, AlertTriangle, ArrowUp, ArrowDown, RotateCw, Zap, Power, Activity, DollarSign, Unlink, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Square, RotateCcw as Home, MapPin, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'

type LogEntry = {
  id: number
  timestamp: string
  type: string
  message: string
}

type MotorId = 'left' | 'right' | 'both'
const MOTOR_PREFIX: Record<MotorId, string> = { left: 'MOTOR_LEFT_', right: 'MOTOR_RIGHT_', both: 'MOTOR_' }

const RELAYS = [
  { ch: 1, name: 'Bill + Coin Acceptors' },
  { ch: 2, name: 'Bottom Exhaust' },
  { ch: 3, name: 'Centrifugal Blower Fan' },
  { ch: 4, name: 'Left PTC Ceramic Heater' },
  { ch: 5, name: 'Diaphragm Pump' },
  { ch: 6, name: 'Right PTC Ceramic Heater' },
  { ch: 7, name: 'Ultrasonic Mist Maker + Mist Fan' },
  { ch: 8, name: 'UVC Light' },
]

export default function CommandsPage() {
  const { selectedDevice } = useDeviceFilter()

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isDeviceReady, setIsDeviceReady] = useState(false)

  // Log
  const [log, setLog] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)

  const addLog = useCallback((type: string, message: string) => {
    setLog(prev => [{
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    }, ...prev].slice(0, 200))
  }, [])

  // Relay state
  const [relayStates, setRelayStates] = useState<boolean[]>(Array(8).fill(false))

  // Servo
  const [servoAngle, setServoAngle] = useState(0)   // last sent / confirmed angle
  const [sliderAngle, setSliderAngle] = useState(0) // live slider position
  const [servoBusy, setServoBusy] = useState(false)

  // Stepper 1
  const [s1Pos, setS1Pos] = useState<number | null>(null)           // steps, from wsLog
  const [s1TargetMm, setS1TargetMm] = useState(0)                   // slider drag target
  const [s1SpeedLevel, setS1SpeedLevel] = useState<'slow'|'normal'|'fast'>('normal')

  // Stepper 2
  const [s2Pos, setS2Pos] = useState<number | null>(null)           // steps, from wsLog
  const [s2TargetMm, setS2TargetMm] = useState(0)                   // slider drag target
  const [s2SpeedLevel, setS2SpeedLevel] = useState<'slow'|'normal'|'fast'>('normal')

  // DC Motors
  const [motorSpeed, setMotorSpeed] = useState<Record<MotorId, 0 | 50 | 100>>({ left: 0, right: 0, both: 0 })
  const [motorDir, setMotorDir] = useState<Record<MotorId, 'fwd' | 'rev'>>({ left: 'fwd', right: 'fwd', both: 'fwd' })

  // RGB
  const [rgbR, setRgbR] = useState(255)
  const [rgbG, setRgbG] = useState(128)
  const [rgbB, setRgbB] = useState(0)
  const [activeColorCmd, setActiveColorCmd] = useState<string | null>(null)

  // ── WebSocket connection (mirrors SensorDataContext.tsx pattern) ──────────

  useEffect(() => {
    if (!selectedDevice) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/ws?deviceId=${encodeURIComponent(selectedDevice)}`
    let ws: WebSocket

    const connect = () => {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        ws.send(JSON.stringify({ type: 'subscribe', deviceId: selectedDevice }))
        addLog('system', 'Connected to device')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'serial-command') return // filter echo-back
          if (msg.type === 'device-online') {
            setIsDeviceReady(true)
          } else if (msg.type === 'firmware-log') {
            setIsDeviceReady(true)
            const text: string = msg.message || ''
            // Parse stepper position from INFO wsLog: "S1 pos=4800 spd=400 IDLE"
            const s1Steps = text.match(/\bS1\s+pos=(-?\d+)/)
            if (s1Steps) setS1Pos(parseInt(s1Steps[1]))
            const s2Steps = text.match(/\bS2\s+pos=(-?\d+)/)
            if (s2Steps) setS2Pos(parseInt(s2Steps[1]))
            addLog(msg.level || 'info', text || JSON.stringify(msg))
          } else if (msg.type === 'service-status') {
            addLog('service', `Progress: ${msg.progress}% — ${msg.timeRemaining}s remaining`)
          } else if (msg.type === 'service-complete') {
            addLog('service', `Complete: ${msg.serviceType}`)
          } else if (msg.type === 'classification-result') {
            addLog('classify', `Result: ${msg.result} (${(msg.confidence * 100).toFixed(1)}%)`)
          } else if (msg.type === 'classification-error') {
            addLog('error', `Classification error: ${msg.error}`)
          }
        } catch { /* ignore */ }
      }

      ws.onerror = () => { setIsConnected(false); setIsDeviceReady(false) }
      ws.onclose = () => {
        setIsConnected(false)
        setIsDeviceReady(false)
        reconnectRef.current = setTimeout(() => connect(), 5000)
      }
    }

    setS1Pos(null)
    setS2Pos(null)
    setMotorSpeed({ left: 0, right: 0, both: 0 })
    setMotorDir({ left: 'fwd', right: 'fwd', both: 'fwd' })
    setIsDeviceReady(false)
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close()
    }
  }, [selectedDevice, addLog])

  // ── Send helper ───────────────────────────────────────────────────────────

  const send = useCallback((command: string) => {
    if (!isConnected || !selectedDevice || !wsRef.current) {
      toast.error('Not connected to device')
      return
    }
    wsRef.current.send(JSON.stringify({ type: 'serial-command', deviceId: selectedDevice, command }))
    addLog('sent', `→ ${command}`)
  }, [isConnected, selectedDevice, addLog])

  // ── Servo helper ──────────────────────────────────────────────────────────
  const sendServo = useCallback((angle: number) => {
    setServoAngle(angle)
    setSliderAngle(angle)
    send(`SERVO_${angle}`)
  }, [send])

  // ── Motor helper ──────────────────────────────────────────────────────────
  const applyMotor = useCallback((id: MotorId, speed: 0 | 50 | 100, dir: 'fwd' | 'rev') => {
    setMotorSpeed(p => ({ ...p, [id]: speed }))
    setMotorDir(p => ({ ...p, [id]: dir }))
    const prefix = MOTOR_PREFIX[id]
    if (speed === 0) { send(`${prefix}BRAKE`); return }
    const pwm = speed === 100 ? 255 : 128
    send(`${prefix}${dir === 'fwd' ? pwm : -pwm}`)
  }, [send])

  // ── Shorthand: disabled when not connected, device not ready, OR servo demo is running ───────
  const disabled = !isConnected || !isDeviceReady || servoBusy

  // ── Badge color ───────────────────────────────────────────────────────────

  const badgeVariant = (type: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (type.toLowerCase()) {
      case 'error': return 'destructive'
      case 'warn': return 'outline'
      case 'sent': return 'secondary'
      default: return 'default'
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!selectedDevice) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <Terminal className="w-12 h-12 opacity-30" />
        <p className="text-lg font-medium">Select a device to send commands</p>
      </div>
    )
  }

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4 h-full pb-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Device <span className="text-primary">Commands</span>
          </h1>
          <p className="text-muted-foreground text-sm">Send firmware commands directly to the device.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {!isConnected
            ? <><WifiOff className="w-4 h-4 text-red-500" /><span className="text-red-500">Disconnected</span></>
            : !isDeviceReady
            ? <><Wifi className="w-4 h-4 text-yellow-500 animate-pulse" /><span className="text-yellow-500">Waiting for device…</span></>
            : <><Wifi className="w-4 h-4 text-green-500" /><span className="text-green-500">Device ready</span></>
          }
        </div>
      </div>

      {/* Servo demo banner — shown across ALL tabs while demo is running */}
      {servoBusy && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 text-sm text-yellow-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Servo demo running — all commands are disabled for ~6 seconds.
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="relays" className="flex flex-col gap-4 flex-1">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="relays">Relays</TabsTrigger>
          <TabsTrigger value="servos">Servos</TabsTrigger>
          <TabsTrigger value="motors">DC Motors</TabsTrigger>
          <TabsTrigger value="steppers">Linear Actuators</TabsTrigger>
          <TabsTrigger value="rgb">RGB LED</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* ── RELAYS ── */}
        <TabsContent value="relays" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RELAYS.map((relay, idx) => (
              <Card key={relay.ch} className={`glass-card border-none transition-all duration-300 ${relayStates[idx] ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}>
                <CardContent className="px-4 py-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{relay.name}</p>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 transition-all duration-300 ${
                      relayStates[idx]
                        ? 'bg-primary shadow-[0_0_8px_3px_hsl(var(--primary)/0.5)]'
                        : 'bg-muted-foreground/20'
                    }`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">Ch.{relay.ch}</Badge>
                    <Switch
                      checked={relayStates[idx]}
                      onCheckedChange={() => {
                        const newState = !relayStates[idx]
                        setRelayStates(prev => { const n = [...prev]; n[idx] = newState; return n })
                        send(`RELAY_${idx + 1}_${newState ? 'ON' : 'OFF'}`)
                      }}
                      disabled={disabled}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <button
            disabled={disabled}
            onClick={() => { send('RELAY_ALL_OFF'); setRelayStates(Array(8).fill(false)) }}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Power className="w-4 h-4" />
            Turn All Relays Off
          </button>
        </TabsContent>

        {/* ── SERVOS ── */}
        <TabsContent value="servos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Arc indicator */}
            <Card className="glass-card border-none flex items-center justify-center">
              <CardContent className="pt-6 pb-4 flex flex-col items-center gap-2 w-full">
                {(() => {
                  const r = 80
                  const cx = 110
                  const cy = 105
                  const toXY = (deg: number) => {
                    const rad = Math.PI - (deg * Math.PI / 180)
                    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
                  }
                  const arcPath = (deg: number) => {
                    if (deg <= 0) return ''
                    const end = toXY(deg)
                    const large = deg > 90 ? 1 : 0
                    return `M ${cx - r},${cy} A ${r},${r} 0 ${large},1 ${end.x.toFixed(2)},${end.y.toFixed(2)}`
                  }
                  const needle = toXY(servoAngle)
                  const sliderNeedle = toXY(sliderAngle)

                  // Tapered pointer polygon from pivot toward arc
                  const pointerTip = toXY(sliderAngle)
                  const dx = pointerTip.x - cx, dy = pointerTip.y - cy
                  const len = Math.sqrt(dx * dx + dy * dy) || 1
                  const ux = dx / len, uy = dy / len   // unit vec toward arc
                  const px = -uy * 4, py = ux * 4      // perpendicular, half-base width
                  const tipX = (cx + ux * (r - 2)).toFixed(2)
                  const tipY = (cy + uy * (r - 2)).toFixed(2)
                  const pointerPts = `${(cx + px).toFixed(1)},${(cy + py).toFixed(1)} ${(cx - px).toFixed(1)},${(cy - py).toFixed(1)} ${tipX},${tipY}`

                  // Same for confirmed needle (solid)
                  const cdx = needle.x - cx, cdy = needle.y - cy
                  const clen = Math.sqrt(cdx * cdx + cdy * cdy) || 1
                  const cux = cdx / clen, cuy = cdy / clen
                  const cpx = -cuy * 3, cpy = cux * 3
                  const ctipX = (cx + cux * (r - 2)).toFixed(2)
                  const ctipY = (cy + cuy * (r - 2)).toFixed(2)
                  const confirmedPts = `${(cx + cpx).toFixed(1)},${(cy + cpy).toFixed(1)} ${(cx - cpx).toFixed(1)},${(cy - cpy).toFixed(1)} ${ctipX},${ctipY}`

                  // Full arc length for dasharray
                  const fullArc = Math.PI * r
                  const sliderDash = (sliderAngle / 180) * fullArc
                  const confirmedDash = (servoAngle / 180) * fullArc
                  const fullArcPath = `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`

                  const primary = 'hsl(var(--primary))'
                  const bg = 'hsl(var(--background))'

                  return (
                    <svg viewBox="0 0 220 125" className="w-full max-w-xs">
                      {/* Background arc */}
                      <path d={fullArcPath} fill="none" strokeLinecap="round"
                        style={{ stroke: 'currentColor', strokeOpacity: 0.12, strokeWidth: 10 }} />
                      {/* Slider arc — real-time preview (always rendered, dasharray fills up to slider pos) */}
                      <path d={fullArcPath} fill="none" strokeLinecap="round"
                        strokeDasharray={`${sliderDash.toFixed(1)} 1000`}
                        style={{ stroke: primary, strokeOpacity: 0.3, strokeWidth: 10 }} />
                      {/* Confirmed arc — full opacity, overlaid */}
                      <path d={fullArcPath} fill="none" strokeLinecap="round"
                        strokeDasharray={`${confirmedDash.toFixed(1)} 1000`}
                        style={{ stroke: primary, strokeWidth: 10 }} />
                      {/* Ghost pointer (dragging) */}
                      {sliderAngle !== servoAngle && (
                        <polygon points={pointerPts} style={{ fill: primary, fillOpacity: 0.35 }} />
                      )}
                      {/* Confirmed tapered pointer */}
                      <polygon points={confirmedPts} style={{ fill: primary }} />
                      {/* Center pivot ring */}
                      <circle cx={cx} cy={cy} r="7" style={{ fill: primary }} />
                      <circle cx={cx} cy={cy} r="4" style={{ fill: bg }} />
                      {/* Angle labels */}
                      <text x={cx - r + 4} y={cy + 19} fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity="0.7">0°</text>
                      <text x={cx} y={cy - r - 8} fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity="0.7">90°</text>
                      <text x={cx + r - 4} y={cy + 19} fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity="0.7">180°</text>
                    </svg>
                  )
                })()}
                {/* Angle value + status outside SVG so it never clips */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-3xl font-bold tabular-nums">{sliderAngle}°</span>
                  <p className="text-xs text-muted-foreground">
                    {sliderAngle !== servoAngle
                      ? `Drag to adjust · last sent: ${servoAngle}°`
                      : `Position confirmed at ${servoAngle}°`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex flex-col gap-4">
              {/* Preset buttons */}
              <Card className="glass-card border-none">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Positions</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                  {([0, 90, 180] as const).map(angle => (
                    <button
                      key={angle}
                      disabled={disabled}
                      onClick={() => sendServo(angle)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl py-3 border transition-all duration-150 ${
                        servoAngle === angle
                          ? 'bg-primary/10 border-primary/50 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/20'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <span className="text-xl font-bold">{angle}°</span>
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {angle === 0 ? 'Start' : angle === 90 ? 'Center' : 'End'}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Slider */}
              <Card className="glass-card border-none">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Custom Angle</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={1}
                    value={sliderAngle}
                    disabled={disabled}
                    onChange={e => setSliderAngle(Number(e.target.value))}
                    onMouseUp={e => sendServo(Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={e => sendServo(Number((e.target as HTMLInputElement).value))}
                    className="w-full accent-primary disabled:opacity-40"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0°</span><span>90°</span><span>180°</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Demo card */}
            <Card className="glass-card border-none md:col-span-2">
              <CardContent className="py-4 flex items-center justify-between gap-6">
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm">Full Range Demo</p>
                  <p className="text-xs text-muted-foreground">
                    Sweeps 0° → 90° → 180° → 0°. <span className="text-yellow-500 font-medium">Blocks all device operations for ~6 seconds</span> — all commands will be re-enabled automatically.
                  </p>
                </div>
                <button
                  disabled={disabled}
                  onClick={() => {
                    send('SERVO_DEMO')
                    setServoBusy(true)
                    setTimeout(() => setServoBusy(false), 7000)
                  }}
                  className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all duration-150 ${
                    servoBusy
                      ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 cursor-wait'
                      : 'border-border hover:bg-muted/20 hover:border-foreground/30'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <RotateCw className={`w-4 h-4 ${servoBusy ? 'animate-spin' : ''}`} />
                  {servoBusy ? 'Running…' : 'Run Demo'}
                </button>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ── DC MOTORS ── */}
        <TabsContent value="motors" className="space-y-4">

          {/* Motor cards — Both in center (primary), Left & Right flanking */}
          <div className="grid grid-cols-3 gap-4">
            {([
              { id: 'left' as MotorId, label: 'Left Brush' },
              { id: 'both' as MotorId, label: 'Both Brushes' },
              { id: 'right' as MotorId, label: 'Right Brush' },
            ]).map(({ id, label }) => {
              const spd = motorSpeed[id]
              const dir = motorDir[id]
              const running = spd > 0
              const isBoth = id === 'both'

              return (
                <Card key={id} className={`glass-card border-none transition-all duration-300 ${running ? (dir === 'fwd' ? 'ring-1 ring-blue-500/40' : 'ring-1 ring-orange-500/40') : ''}`}>
                  <CardContent className="pt-5 pb-4 flex flex-col items-center gap-4">

                    {/* Spinning indicator */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                        running
                          ? dir === 'fwd'
                            ? 'bg-blue-500/10 shadow-[0_0_16px_rgba(59,130,246,0.25)]'
                            : 'bg-orange-500/10 shadow-[0_0_16px_rgba(249,115,22,0.25)]'
                          : 'bg-muted/20'
                      }`}>
                        {dir === 'fwd'
                          ? <RotateCw className={`w-7 h-7 transition-colors duration-300 ${running ? 'text-blue-400' : 'text-muted-foreground/30'} ${running ? 'animate-spin' : ''}`}
                              style={{ animationDuration: spd === 100 ? '0.6s' : '1.2s' }}
                            />
                          : <RotateCcw className={`w-7 h-7 transition-colors duration-300 ${running ? 'text-orange-400' : 'text-muted-foreground/30'} ${running ? 'animate-spin' : ''}`}
                              style={{ animationDuration: spd === 100 ? '0.6s' : '1.2s', animationDirection: 'reverse' }}
                            />
                        }
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-sm">{label}</p>
                        <p className={`text-xs font-medium ${running ? (dir === 'fwd' ? 'text-blue-400' : 'text-orange-400') : 'text-muted-foreground/50'}`}>
                          {running ? `${spd}% · ${dir === 'fwd' ? 'Forward' : 'Reverse'}` : 'Stopped'}
                        </p>
                      </div>
                    </div>

                    {/* Speed selector — segmented pill */}
                    <div className="w-full rounded-xl bg-muted/20 p-1 grid grid-cols-3 gap-1">
                      {([0, 50, 100] as const).map(s => (
                        <button
                          key={s}
                          disabled={disabled}
                          onClick={() => applyMotor(id, s, dir)}
                          className={`rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 ${
                            spd === s
                              ? s === 0
                                ? 'bg-background shadow text-foreground'
                                : dir === 'fwd'
                                  ? 'bg-blue-600 text-white shadow'
                                  : 'bg-orange-600 text-white shadow'
                              : 'text-muted-foreground hover:text-foreground'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {s === 0 ? 'Off' : `${s}%`}
                        </button>
                      ))}
                    </div>

                    {/* Direction toggle */}
                    <div className="w-full grid grid-cols-2 gap-2">
                      <button
                        disabled={disabled}
                        onClick={() => applyMotor(id, spd, 'fwd')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-150 border ${
                          dir === 'fwd'
                            ? 'bg-blue-600 border-blue-600 text-white shadow'
                            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <ArrowUp className="w-3 h-3" /> Forward
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => applyMotor(id, spd, 'rev')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-150 border ${
                          dir === 'rev'
                            ? 'bg-orange-600 border-orange-600 text-white shadow'
                            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <ArrowDown className="w-3 h-3" /> Reverse
                      </button>
                    </div>

                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Emergency stop */}
          <button
            disabled={disabled}
            onClick={() => {
              send('MOTOR_BRAKE')
              setMotorSpeed({ left: 0, right: 0, both: 0 })
            }}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-bold text-sm bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            Emergency Stop — Cut All Brush Motors
          </button>

        </TabsContent>

        {/* ── LINEAR ACTUATORS ── */}
        <TabsContent value="steppers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              {
                n: 1, label: 'Top Actuator', sub: '480 mm stroke',
                maxMm: 480, stepsPerMm: 10, precision: 1,
                pos: s1Pos, targetMm: s1TargetMm, setTargetMm: setS1TargetMm,
                speedLevel: s1SpeedLevel, setSpeedLevel: setS1SpeedLevel,
                jog: [-50, -10, 10, 50] as number[], step: 1,
                onRefresh: () => send('STEPPER1_INFO'),
                onReturn:  () => send('STEPPER1_RETURN'),
                onZero:    () => { send('STEPPER1_HOME'); setS1Pos(0); setS1TargetMm(0) },
                onStop:    () => send('STEPPER1_STOP'),
                onMove:    (delta: number) => send(`STEPPER1_MM_${delta}`),
                onSpeed:   (lvl: string) => send(`STEPPER1_SPEED_${[200,400,800][['slow','normal','fast'].indexOf(lvl)]}`),
              },
              {
                n: 2, label: 'Side Actuator', sub: '100 mm stroke',
                maxMm: 100, stepsPerMm: 200, precision: 2,
                pos: s2Pos, targetMm: s2TargetMm, setTargetMm: setS2TargetMm,
                speedLevel: s2SpeedLevel, setSpeedLevel: setS2SpeedLevel,
                jog: [-20, -5, 5, 20] as number[], step: 0.5,
                onRefresh: () => send('STEPPER2_INFO'),
                onReturn:  () => send('STEPPER2_RETURN'),
                onZero:    () => { send('STEPPER2_HOME'); setS2Pos(0); setS2TargetMm(0) },
                onStop:    () => send('STEPPER2_STOP'),
                onMove:    (delta: number) => send(`STEPPER2_MM_${delta}`),
                onSpeed:   (lvl: string) => send(`STEPPER2_SPEED_${[3000,12000,24000][['slow','normal','fast'].indexOf(lvl)]}`),
              },
            ]).map(({ n, label, sub, maxMm, stepsPerMm, precision, pos, targetMm, setTargetMm,
                      speedLevel, setSpeedLevel, jog, step,
                      onRefresh, onReturn, onZero, onStop, onMove, onSpeed }) => {
              const posMm  = pos !== null ? pos / stepsPerMm : null
              const pct    = posMm !== null ? Math.min(100, Math.max(0, (posMm / maxMm) * 100)) : 0
              const tgtPct = Math.min(100, Math.max(0, (targetMm / maxMm) * 100))
              const btn    = 'rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed'
              return (
                <Card key={n} className="glass-card border-none">
                  <CardContent className="pt-5 pb-5 space-y-5">

                    {/* ── Header: title + position + refresh ── */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1.5 rounded-xl text-sm font-mono font-bold border transition-all duration-500 ${
                          posMm !== null ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground/40'
                        }`}>
                          {posMm !== null ? `${posMm.toFixed(precision)} mm` : '— mm'}
                        </div>
                        <button disabled={disabled} onClick={onRefresh}
                          className={`${btn} p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20`}>
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* ── Position bar ── */}
                    <div className="space-y-2">
                      <div className="relative h-3 rounded-full bg-muted/20 overflow-hidden">
                        {/* Target fill */}
                        <div className="absolute inset-y-0 left-0 rounded-full bg-primary/20 transition-all duration-150"
                          style={{ width: `${tgtPct}%` }} />
                        {/* Confirmed fill */}
                        <div className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground/50">
                        <span>0 mm</span><span>{maxMm / 2} mm</span><span>{maxMm} mm</span>
                      </div>
                    </div>

                    {/* ── Jog controls ── */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Jog</p>
                      <div className="grid grid-cols-5 gap-2">
                        <button disabled={disabled} onClick={() => onMove(jog[0])}
                          className={`${btn} py-3 flex flex-col items-center gap-1 border border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground`}>
                          <ChevronsLeft className="w-4 h-4" />
                          <span className="text-[10px]">{Math.abs(jog[0])}</span>
                        </button>
                        <button disabled={disabled} onClick={() => onMove(jog[1])}
                          className={`${btn} py-3 flex flex-col items-center gap-1 border border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground`}>
                          <ChevronLeft className="w-4 h-4" />
                          <span className="text-[10px]">{Math.abs(jog[1])}</span>
                        </button>
                        <button disabled={disabled} onClick={onStop}
                          className={`${btn} py-3 flex flex-col items-center gap-1 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30`}>
                          <Square className="w-4 h-4 fill-current" />
                          <span className="text-[10px] font-bold">Stop</span>
                        </button>
                        <button disabled={disabled} onClick={() => onMove(jog[2])}
                          className={`${btn} py-3 flex flex-col items-center gap-1 border border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground`}>
                          <ChevronRight className="w-4 h-4" />
                          <span className="text-[10px]">{Math.abs(jog[2])}</span>
                        </button>
                        <button disabled={disabled} onClick={() => onMove(jog[3])}
                          className={`${btn} py-3 flex flex-col items-center gap-1 border border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground`}>
                          <ChevronsRight className="w-4 h-4" />
                          <span className="text-[10px]">{Math.abs(jog[3])}</span>
                        </button>
                      </div>
                    </div>

                    {/* ── Go to position ── */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Go to Position</p>
                        <span className="text-xs font-mono font-bold text-primary">{targetMm} mm</span>
                      </div>
                      <input type="range" min={0} max={maxMm} step={step} value={targetMm} disabled={disabled}
                        onChange={e => setTargetMm(Number(e.target.value))}
                        className="w-full accent-primary disabled:opacity-40" />
                      <button disabled={disabled}
                        onClick={() => onMove(targetMm - (posMm ?? 0))}
                        className={`${btn} w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2`}>
                        <MapPin className="w-4 h-4" />
                        Move to {targetMm} mm
                      </button>
                    </div>

                    {/* ── Speed ── */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Speed</p>
                      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/20">
                        {(['slow','normal','fast'] as const).map(lvl => (
                          <button key={lvl} disabled={disabled}
                            onClick={() => { setSpeedLevel(lvl); onSpeed(lvl) }}
                            className={`rounded-lg py-1.5 text-xs font-semibold capitalize transition-all duration-150 ${
                              speedLevel === lvl
                                ? 'bg-background shadow text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}>
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Utilities ── */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                      <button disabled={disabled} onClick={onReturn}
                        className={`${btn} py-2 flex items-center justify-center gap-1.5 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20`}>
                        <Home className="w-3.5 h-3.5" /> Return to 0
                      </button>
                      <button disabled={disabled} onClick={onZero}
                        className={`${btn} py-2 flex items-center justify-center gap-1.5 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/20`}>
                        <MapPin className="w-3.5 h-3.5" /> Zero Here
                      </button>
                    </div>

                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Stop both — bottom, less prominent */}
          <button disabled={disabled}
            onClick={() => { send('STEPPER1_STOP'); send('STEPPER2_STOP') }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <Square className="w-4 h-4 fill-current" /> Stop Both Actuators
          </button>
        </TabsContent>

        {/* ── RGB LED ── */}
        <TabsContent value="rgb">
          {(() => {
            const previewColor = `rgb(${rgbR},${rgbG},${rgbB})`
            const brightness = rgbR * 0.299 + rgbG * 0.587 + rgbB * 0.114
            const isOff = rgbR === 0 && rgbG === 0 && rgbB === 0

            const PRESETS = [
              { label: 'White',  cmd: 'RGB_WHITE',  color: '#f8fafc', r: 255, g: 255, b: 255 },
              { label: 'Blue',   cmd: 'RGB_BLUE',   color: '#3b82f6', r: 59,  g: 130, b: 246 },
              { label: 'Green',  cmd: 'RGB_GREEN',  color: '#22c55e', r: 34,  g: 197, b: 94  },
              { label: 'Violet', cmd: 'RGB_VIOLET', color: '#a78bfa', r: 139, g: 92,  b: 246 },
              { label: 'Off',    cmd: 'RGB_OFF',    color: '#1e293b', r: 0,   g: 0,   b: 0   },
            ]

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left — preview + presets */}
                <Card className="glass-card border-none">
                  <CardContent className="pt-6 pb-5 flex flex-col items-center gap-6">

                    {/* Glowing preview orb */}
                    <div className="relative flex items-center justify-center w-32 h-32">
                      <div className="absolute inset-0 rounded-full transition-all duration-500"
                        style={{ backgroundColor: previewColor, opacity: 0.15, filter: 'blur(20px)', transform: 'scale(1.4)' }} />
                      <div className="relative w-28 h-28 rounded-full border border-white/10 transition-all duration-500 flex items-center justify-center"
                        style={{ backgroundColor: previewColor }}>
                        {isOff && <span className="text-xs font-medium text-white/30">OFF</span>}
                      </div>
                    </div>

                    {/* Preset swatches */}
                    <div className="w-full grid grid-cols-5 gap-2">
                      {PRESETS.map(({ label, cmd, color, r, g, b }) => (
                        <button key={cmd} disabled={disabled}
                          onClick={() => {
                            send(cmd)
                            setRgbR(r); setRgbG(g); setRgbB(b)
                            setActiveColorCmd(cmd)
                          }}
                          className={`flex flex-col items-center gap-2 py-2.5 px-1 rounded-xl border transition-all duration-200 ${
                            activeColorCmd === cmd
                              ? 'border-white/20 bg-white/5 scale-[1.06]'
                              : 'border-transparent hover:border-white/10 hover:bg-white/5'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <div className="w-9 h-9 rounded-full border border-white/10 transition-all duration-300"
                            style={{
                              backgroundColor: color,
                              boxShadow: activeColorCmd === cmd ? `0 0 14px 3px ${color}90` : 'none',
                            }} />
                          <span className="text-[10px] font-medium text-muted-foreground leading-none">{label}</span>
                        </button>
                      ))}
                    </div>

                  </CardContent>
                </Card>

                {/* Right — RGB sliders */}
                <Card className="glass-card border-none">
                  <CardContent className="pt-5 pb-5 space-y-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Color</p>

                    {([
                      { label: 'Red',   val: rgbR, set: setRgbR,   accent: '#ef4444', track: 'rgba(239,68,68,0.18)'   },
                      { label: 'Green', val: rgbG, set: setRgbG,   accent: '#22c55e', track: 'rgba(34,197,94,0.18)'   },
                      { label: 'Blue',  val: rgbB, set: setRgbB,   accent: '#3b82f6', track: 'rgba(59,130,246,0.18)'  },
                    ] as { label: string; val: number; set: (v: number) => void; accent: string; track: string }[]).map(({ label, val, set, accent, track }) => (
                      <div key={label} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold" style={{ color: accent }}>{label}</span>
                          <span className="text-xs font-mono tabular-nums text-muted-foreground w-8 text-right">{val}</span>
                        </div>
                        <div className="relative h-6 rounded-full flex items-center" style={{ backgroundColor: track }}>
                          <input type="range" min={0} max={255} step={1} value={val} disabled={disabled}
                            onChange={e => { set(Number(e.target.value)); setActiveColorCmd('custom') }}
                            className="w-full disabled:opacity-40"
                            style={{ accentColor: accent }} />
                        </div>
                      </div>
                    ))}

                    {/* Apply button — tinted with the current preview color */}
                    <button disabled={disabled}
                      onClick={() => { send(`RGB_CUSTOM_${rgbR}_${rgbG}_${rgbB}`); setActiveColorCmd('custom') }}
                      className="w-full py-3 rounded-xl text-sm font-semibold border border-white/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: isOff ? undefined : previewColor,
                        color: brightness > 140 ? '#000' : '#fff',
                        boxShadow: isOff ? 'none' : `0 0 20px 2px ${previewColor}50`,
                      }}
                    >
                      {isOff ? 'Turn Off' : 'Apply Color'}
                    </button>

                    {/* Numeric readout */}
                    <p className="text-center text-[11px] font-mono text-muted-foreground/50">
                      rgb({rgbR}, {rgbG}, {rgbB})
                    </p>
                  </CardContent>
                </Card>

              </div>
            )
          })()}
        </TabsContent>

        {/* ── SYSTEM ── */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-card border-none">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-muted-foreground" />Device Status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Queries device state — response appears in the log below.</p>
                <Button disabled={disabled} onClick={() => send('STATUS')}>Query Status</Button>
              </CardContent>
            </Card>
            <Card className="glass-card border-none ring-1 ring-yellow-500/30">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4 text-yellow-500" /><span className="text-yellow-500">Reset Money Counters</span></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Resets all coin and bill totals to ₱0. This cannot be undone.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10" disabled={disabled}>Reset Money</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Money Counters?</AlertDialogTitle>
                      <AlertDialogDescription>All coin and bill totals will be reset to ₱0. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => send('RESET_MONEY')}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
            <Card className="glass-card border-none ring-1 ring-destructive/30">
              <CardHeader><CardTitle className="text-base text-destructive flex items-center gap-2"><WifiOff className="w-4 h-4" />Reset WiFi</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Clears WiFi credentials and restarts. Device will be offline for 10–30 seconds.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={disabled}>Reset WiFi</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset WiFi Credentials?</AlertDialogTitle>
                      <AlertDialogDescription>The device will clear its WiFi settings and restart. It will be offline for 10–30 seconds and must be reconfigured.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { send('RESET_WIFI'); toast.info('Command sent — device is restarting. This may take 10–30 seconds.') }}>
                        Reset WiFi
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
            <Card className="glass-card border-none ring-1 ring-destructive/30">
              <CardHeader><CardTitle className="text-base text-destructive flex items-center gap-2"><Unlink className="w-4 h-4" />Reset Pairing</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Clears pairing, generates new pairing code, and restarts. Device will be offline for 10–30 seconds.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={disabled}>Reset Pairing</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Device Pairing?</AlertDialogTitle>
                      <AlertDialogDescription>The device will lose its pairing status, generate a new pairing code, and restart. It must be re-paired after coming back online.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { send('RESET_PAIRING'); toast.info('Command sent — device is restarting. This may take 10–30 seconds.') }}>
                        Reset Pairing
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
            <Card className="glass-card border-none ring-1 ring-destructive/30 md:col-span-2">
              <CardHeader><CardTitle className="text-base text-destructive flex items-center gap-2"><RotateCcw className="w-4 h-4" />Factory Reset</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Clears all settings — WiFi credentials, pairing, money counters — and restarts. Device must be fully reconfigured after this operation.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={disabled}>Factory Reset</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Factory Reset Device?</AlertDialogTitle>
                      <AlertDialogDescription>This will erase all WiFi credentials, pairing data, and money counters, then restart the device. The device will be completely offline and must be fully reconfigured from scratch.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { send('FACTORY_RESET'); toast.info('Factory reset sent — device is restarting. Full reconfiguration required.') }}>
                        Factory Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Live Response Log ── */}
      <Card className="glass-card border-none flex-shrink-0">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Live Response Log</CardTitle>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setLog([])}>Clear</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-40 overflow-y-auto font-mono text-xs px-4 pb-3 space-y-1">
            {log.length === 0 && <p className="text-muted-foreground/50 pt-2">No messages yet…</p>}
            {log.map(entry => (
              <div key={entry.id} className="flex items-start gap-2">
                <span className="text-muted-foreground/50 flex-shrink-0 pt-0.5">{entry.timestamp}</span>
                <Badge variant={badgeVariant(entry.type)} className="text-[10px] px-1 py-0 h-4 flex-shrink-0 capitalize">
                  {entry.type}
                </Badge>
                <span className="text-foreground/80 break-all">{entry.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
