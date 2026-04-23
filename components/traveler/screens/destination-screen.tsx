"use client"

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { 
  ArrowLeft, MapPin, Search, User, AlertTriangle,
  ArrowRight, CheckCircle2, X, Clock,
  Calendar, PlaneTakeoff, Hotel, ShieldCheck, AlertCircle, Upload, FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar as DateCalendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  formatFacilityAddress,
  type FacilityRecord,
} from "@/lib/facilities-data"
import type { BookingData } from "../traveler-flow"


function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

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

  const [selectedFacility, setSelectedFacility] = useState<FacilityRecord | null>(() =>
    data.destination.facility ?? null
  )
  const [searchQuery, setSearchQuery] = useState(data.destination.name || "")
  const [predictions, setPredictions] = useState<{ place_id: string; name: string; secondary: string }[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchPlaces = useCallback((q: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!q) { setPredictions([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setPlacesLoading(true)
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setPredictions(data.predictions ?? [])
      } catch {
        setPredictions([])
      } finally {
        setPlacesLoading(false)
      }
    }, 300)
  }, [])

  const selectPlace = useCallback(async (placeId: string, placeName: string) => {
    setSearchQuery(placeName)
    setPredictions([])
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
      setSelectedFacility(facility)
    } catch {
      setSelectedFacility(null)
    }
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

  const [arrivalDate, setArrivalDate] = useState(data.destination.checkInDate || "")
  const [arrivalTime, setArrivalTime] = useState("") 
  const [bookingName, setBookingName] = useState(data.destination.bookingName || "")
  const [bookingDoc, setBookingDoc] = useState<File | null>(null)
  const bookingDocRef = useRef<HTMLInputElement>(null)
  const [sameAsBooking, setSameAsBooking] = useState(true)
  const [recipientName, setRecipientName] = useState("")
  const [flightNumber, setFlightNumber] = useState("")
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const isAirport = selectedFacility?.destType === "airport"

  
  const minArrival = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 1)
    return { ymd: formatYmdLocal(d), start: d }
  }, [])

  
  useEffect(() => {
    if (!arrivalDate) return
    if (arrivalDate < minArrival.ymd) setArrivalDate(minArrival.ymd)
  }, [arrivalDate, minArrival.ymd])

  
  const logisticsStatus = useMemo(() => {
    if (!isAirport || !arrivalDate || !arrivalTime) return null
    
    const flightDate = parseYmdLocal(arrivalDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    
    const shippingDeadline = new Date(flightDate)
    shippingDeadline.setDate(flightDate.getDate() - 2)
    
    
    const [hours, minutes] = arrivalTime.split(":").map(Number)
    let pickupHour = hours - 2
    const pickupTime = `${pickupHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`

    const isPossible = shippingDeadline >= today

    return {
      shippingDeadline: shippingDeadline.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      pickupDeadline: pickupTime,
      isPossible,
      error: !isPossible ? "空港配送はフライトの2日前までの予約が必須です。" : null
    }
  }, [isAirport, arrivalDate, arrivalTime])



  const effectiveRecipient = sameAsBooking ? bookingName : recipientName

  const canContinue = useMemo(() => {
    const hasRecipient = sameAsBooking ? !!bookingName : !!recipientName
    const basicInfo = pickupConfirmed && selectedFacility && arrivalDate && arrivalTime && bookingName && bookingDoc && hasRecipient
    if (isAirport) {
      return !!(basicInfo && flightNumber && logisticsStatus?.isPossible)
    }
    return !!basicInfo
  }, [pickupConfirmed, selectedFacility, arrivalDate, arrivalTime, bookingName, bookingDoc, sameAsBooking, recipientName, isAirport, flightNumber, logisticsStatus])

  
  const handleContinue = () => {
    if (!selectedFacility || !pickupLocation) return
    onUpdate({
      pickup: {
        id: pickupLocation.id,
        name: pickupLocation.name,
        address: formatFacilityAddress(pickupLocation),
        facility: pickupLocation,
      },
      destination: {
        name: selectedFacility.name,
        address: formatFacilityAddress(selectedFacility),
        type: selectedFacility.destType,
        checkInDate: arrivalDate,
        bookingName: bookingName,
        recipientName: effectiveRecipient,
        facility: selectedFacility,
      },
    })
    onNext()
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full pb-8 bg-background">
      {}
      <div className="p-4 flex items-center gap-4 border-b border-border sticky top-0 bg-white/80 backdrop-blur-md z-20">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold tracking-tight">Trip Plan</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        
        {}
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
                    onClick={() => { setPickupConfirmed(false); setPickupQuery(""); setPickupPredictions([]) }}
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
                {pickupPredictions.length > 0 && (
                  <div className="absolute top-full w-full mt-1 border rounded-xl bg-white z-30 shadow-2xl overflow-hidden">
                    {pickupLoading ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
                    ) : (
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
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Destination & Logistics */}
        {pickupConfirmed && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Where to?"
                  className="pl-9 h-14 rounded-2xl shadow-sm focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSelectedFacility(null)
                    searchPlaces(e.target.value)
                  }}
                />
                {!selectedFacility && predictions.length > 0 && (
                  <div className="absolute top-full w-full mt-1 border rounded-xl bg-white z-30 shadow-2xl overflow-hidden">
                    {placesLoading ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
                    ) : (
                      predictions.map((p) => (
                        <button
                          key={p.place_id}
                          onClick={() => selectPlace(p.place_id, p.name)}
                          className="w-full p-4 text-left hover:bg-muted border-b last:border-0"
                        >
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.secondary}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3"/> {isAirport ? "Flight Date" : "Check-in Date"}</label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-12 w-full justify-start rounded-xl border-input bg-background px-3 text-left font-normal shadow-xs",
                          !arrivalDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                        {arrivalDate
                          ? parseYmdLocal(arrivalDate).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DateCalendar
                        mode="single"
                        selected={arrivalDate ? parseYmdLocal(arrivalDate) : undefined}
                        onSelect={(d) => {
                          if (d) {
                            setArrivalDate(formatYmdLocal(d))
                            setDatePickerOpen(false)
                          }
                        }}
                        disabled={{ before: minArrival.start }}
                        defaultMonth={arrivalDate ? parseYmdLocal(arrivalDate) : minArrival.start}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/> {isAirport ? "Flight Time" : "Arrival Time"}</label>
                  <select
                    className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                  >
                    <option value="">--:00</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = i.toString().padStart(2, "0")
                      return <option key={h} value={`${h}:00`}>{h}:00</option>
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* 物流SLAステータス */}
            {isAirport && logisticsStatus && (
              <div className={`p-4 rounded-xl border ${logisticsStatus.isPossible ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20 shadow-lg"}`}>
                <div className="flex items-start gap-3">
                  {logisticsStatus.isPossible ? <ShieldCheck className="w-5 h-5 text-primary mt-0.5" /> : <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />}
                  <div className="space-y-1">
                    <p className={`text-xs font-bold ${logisticsStatus.isPossible ? "text-primary" : "text-destructive"}`}>
                      {logisticsStatus.isPossible ? "Logistics Schedule Confirmed" : "Critical Alert: Deadlines"}
                    </p>
                    <div className="text-[10px] text-muted-foreground space-y-1 leading-relaxed">
                      {logisticsStatus.isPossible ? (
                        <>
                          <p>• Airport counter pickup by: <strong>{logisticsStatus.pickupDeadline}</strong></p>
                          <p>• Shipping deadline from hotel: <strong>{logisticsStatus.shippingDeadline}</strong></p>
                        </>
                      ) : (
                        <p className="font-bold text-destructive">{logisticsStatus.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* フライト・名前情報 */}
            <div className="space-y-4 pt-2 border-t border-dashed">
              {isAirport && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground ml-1">Flight Number</label>
                  <Input placeholder="e.g. JL001 / NH211" className="h-12 rounded-xl uppercase font-mono border-primary/20" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} />
                </div>
              )}

              {/* Booking Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground ml-1">Booking Name</label>
                <Input placeholder="Name on booking" className="h-12 rounded-xl" value={bookingName} onChange={(e) => setBookingName(e.target.value)} />
              </div>

              {/* Booking Confirmation Upload (Required) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 ml-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Booking Confirmation</label>
                  <span className="text-[9px] font-bold text-destructive">Required</span>
                </div>
                <input
                  ref={bookingDocRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setBookingDoc(f)
                  }}
                  className="hidden"
                  aria-label="Upload booking confirmation"
                />
                {bookingDoc ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{bookingDoc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(bookingDoc.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={() => { setBookingDoc(null); if (bookingDocRef.current) bookingDocRef.current.value = "" }}
                      className="p-1 rounded-full hover:bg-muted transition-colors shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => bookingDocRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-foreground/40 hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload confirmation screenshot or PDF</span>
                  </button>
                )}
              </div>

              {/* Recipient Name with "Same as booking" checkbox */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground ml-1">Recipient Name</label>
                <button
                  type="button"
                  onClick={() => setSameAsBooking(!sameAsBooking)}
                  className="flex items-center gap-2 ml-1"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                    sameAsBooking ? "bg-foreground border-foreground" : "border-muted-foreground"
                  }`}>
                    {sameAsBooking && (
                      <svg className="w-2.5 h-2.5 text-background" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className="text-xs text-foreground">Same as booking name</span>
                </button>
                {!sameAsBooking && (
                  <Input
                    placeholder="Recipient full name"
                    className="h-12 rounded-xl"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="p-4 bg-white border-t border-border mt-auto">
        <Button 
          className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl transition-all shadow-primary/20"
          disabled={!canContinue} 
          onClick={handleContinue}
        >
          {logisticsStatus?.error ? "Schedule Error" : "Confirm & Save Time"}
        </Button>
      </div>
    </div>
  )
}
