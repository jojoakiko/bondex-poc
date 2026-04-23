"use client"

import React, { useState, useRef, useCallback, useMemo } from "react"
import { ArrowLeft, MapPin, Search, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatFacilityAddress, type FacilityRecord } from "@/lib/facilities-data"
import type { BookingData } from "../traveler-flow"

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

const PICKUP_TIME_SLOTS = [
  "8:00 - 12:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
  "19:00 - 21:00",
]

interface DestinationScreenProps {
  data: BookingData
  onUpdate: (data: Partial<BookingData>) => void
  onNext: () => void
  onBack: () => void
}

export function DestinationScreen({ data, onUpdate, onNext, onBack }: DestinationScreenProps) {
  const [pickupConfirmed, setPickupConfirmed] = useState(false)
  const [pickupLocation, setPickupLocation] = useState<FacilityRecord | null>(null)
  const [pickupQuery, setPickupQuery] = useState("")
  const [pickupPredictions, setPickupPredictions] = useState<{ place_id: string; name: string; secondary: string }[]>([])
  const [pickupLoading, setPickupLoading] = useState(false)
  const pickupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [pickupDate, setPickupDate] = useState(data.pickup?.pickupDate || "")
  const [pickupTimeSlot, setPickupTimeSlot] = useState(data.pickup?.pickupTime || "")

  const pickupDateOptions = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() + 1)
    return Array.from({ length: 4 }).map((_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return {
        ymd: formatYmdLocal(d),
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        earliest: i === 0,
      }
    })
  }, [])

  const fetchPickupPredictions = useCallback(async (q: string) => {
    if (!q) { setPickupPredictions([]); return }
    setPickupLoading(true)
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setPickupPredictions(json.predictions ?? [])
    } catch {
      setPickupPredictions([])
    } finally {
      setPickupLoading(false)
    }
  }, [])

  const searchPickupPlaces = useCallback((q: string) => {
    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current)
    if (!q) { setPickupPredictions([]); return }
    pickupTimerRef.current = setTimeout(() => fetchPickupPredictions(q), 300)
  }, [fetchPickupPredictions])

  const selectPickupPlace = useCallback(async (placeId: string, placeName: string) => {
    setPickupQuery(placeName)
    setPickupPredictions([])
    try {
      const res = await fetch(`/api/places?place_id=${placeId}`)
      const detail = await res.json()
      const facility: FacilityRecord = {
        id: detail.id,
        name: detail.name,
        destType: "hotel",
        full_name: detail.name,
        company: detail.name,
        email: "",
        phone: "",
        country: "JP",
        zip: detail.zip ?? "",
        province: detail.province ?? "",
        city: detail.city ?? "",
        address1: detail.address1 ?? "",
        address2: "",
        extra: "",
      }
      setPickupLocation(facility)
      setPickupConfirmed(true)
    } catch {
      // ignore
    }
  }, [])

  const canContinue = pickupConfirmed && !!pickupDate && !!pickupTimeSlot

  const handleContinue = () => {
    if (!pickupLocation) return
    onUpdate({
      pickup: {
        id: pickupLocation.id,
        name: pickupLocation.name,
        address: formatFacilityAddress(pickupLocation),
        facility: pickupLocation,
        pickupDate,
        pickupTime: pickupTimeSlot,
      },
    })
    onNext()
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full pb-8 bg-background">
      <div className="p-4 flex items-center gap-4 border-b border-border sticky top-0 bg-white/80 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pick Up</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Step 1 of 6</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Pickup Point */}
        <div className={`p-4 rounded-2xl border-2 transition-all ${pickupConfirmed ? "bg-muted/30 border-transparent shadow-none" : "bg-primary/5 border-primary shadow-lg shadow-primary/10"}`}>
          {pickupConfirmed && pickupLocation ? (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 mt-1 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Pickup Point</p>
                <p className="font-bold text-base">{pickupLocation.name}</p>
                <p className="text-xs text-muted-foreground">{formatFacilityAddress(pickupLocation)}</p>
                <div className="mt-2 flex items-center gap-1.5 text-primary text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Location confirmed</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickupConfirmed(false)
                      setPickupQuery("")
                      setPickupPredictions([])
                      setPickupDate("")
                      setPickupTimeSlot("")
                    }}
                    className="ml-auto text-[10px] text-muted-foreground underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] uppercase font-black tracking-widest text-primary">Search Pickup Location</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Enter hotel name..."
                  className="pl-9 h-12 rounded-xl border-primary"
                  value={pickupQuery}
                  onChange={(e) => {
                    setPickupQuery(e.target.value)
                    searchPickupPlaces(e.target.value)
                  }}
                  onKeyDown={(e: import("react").KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current)
                      fetchPickupPredictions(pickupQuery)
                    }
                  }}
                />
                {(pickupLoading || pickupPredictions.length > 0) && pickupQuery && (
                  <div className="absolute top-full w-full mt-1 border rounded-xl bg-white z-30 shadow-2xl overflow-hidden">
                    {pickupLoading ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
                    ) : pickupPredictions.length > 0 ? (
                      pickupPredictions.map((p) => (
                        <button
                          key={p.place_id}
                          type="button"
                          onClick={() => selectPickupPlace(p.place_id, p.name)}
                          className="w-full p-4 text-left hover:bg-muted border-b last:border-0"
                        >
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.secondary}</p>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground text-center">No results found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pickup Date & Time — shown after location confirmed */}
        {pickupConfirmed && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">
                Pick up date
              </p>
              {pickupDateOptions.map((opt) => {
                const isSelected = pickupDate === opt.ymd
                return (
                  <button
                    key={opt.ymd}
                    type="button"
                    onClick={() => setPickupDate(opt.ymd)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`font-bold text-base ${isSelected ? "text-foreground" : "text-muted-foreground/80"}`}>
                          {opt.label}
                        </div>
                        {opt.earliest && (
                          <div className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-black uppercase italic">
                            Earliest
                          </div>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-border"}`}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground pl-1">
                Pick up time
              </p>
              {PICKUP_TIME_SLOTS.map((slot) => {
                const isSelected = pickupTimeSlot === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setPickupTimeSlot(slot)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-full">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className={`font-bold text-sm ${isSelected ? "text-foreground" : "text-muted-foreground/80"}`}>
                        {slot}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-border"}`}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-border mt-auto">
        <Button
          className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl transition-all shadow-primary/20"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
