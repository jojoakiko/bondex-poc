"use client"

import React from "react"

import { useState, useRef } from "react"
import { ArrowLeft, Info, X, Ruler, Banknote, Flame, Leaf, Package, Camera, Plus, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import type { BookingData } from "../traveler-flow"
import { uploadPhoto } from "@/lib/photos-api"

interface LuggageInputScreenProps {
  data: BookingData
  onUpdate: (data: BookingData) => void
  onNext: () => void
  onBack: () => void
}

type Size = "S" | "M" | "L" | "LL"

interface LuggageItem {
  id: string
  photos: string[] 
  size: Size | null
  estimatedWeight: string
  autoDetected: boolean
}

const SIZE_INFO: Record<Size, {
  label: string
  sub: string
  dimensions: string
  maxCm: number
  weight: string
  maxKg: number
  defaultWeight: number
  examples: string
  image: string
}> = {
  S: {
    label: "Cabin-size suitcase",
    sub: "Carry-on luggage",
    dimensions: "Up to 100 cm",
    maxCm: 100,
    weight: "Up to 10 kg",
    maxKg: 10,
    defaultWeight: 7,
    examples: "Small carry-on, backpack",
    image: "/luggage-s.jpg",
  },
  M: {
    label: "Standard suitcase",
    sub: "Most travelers",
    dimensions: "Up to 120 cm",
    maxCm: 120,
    weight: "Up to 15 kg",
    maxKg: 15,
    defaultWeight: 12,
    examples: "Medium suitcase, duffel bag",
    image: "/luggage-m.jpg",
  },
  L: {
    label: "Large suitcase",
    sub: "Checked baggage",
    dimensions: "Up to 160 cm",
    maxCm: 160,
    weight: "Up to 25 kg",
    maxKg: 25,
    defaultWeight: 20,
    examples: "Large suitcase, golf bag",
    image: "/luggage-l.jpg",
  },
  LL: {
    label: "Oversized item",
    sub: "Large or special items",
    dimensions: "Up to 200 cm",
    maxCm: 200,
    weight: "Up to 30 kg",
    maxKg: 30,
    defaultWeight: 25,
    examples: "Ski equipment, surfboard",
    image: "/luggage-ll.jpg",
  },
}

function estimateSizeFromPhoto(_photoUrl: string): { size: Size; confidence: number } {
  const sizes: Size[] = ["S", "M", "L", "LL"]
  const weights = [0.2, 0.45, 0.25, 0.1]
  const rand = Math.random()
  let cumulative = 0
  for (let i = 0; i < sizes.length; i++) {
    cumulative += weights[i]
    if (rand <= cumulative) {
      return { size: sizes[i], confidence: 0.7 + Math.random() * 0.25 }
    }
  }
  return { size: "M", confidence: 0.8 }
}

const PROHIBITED_ITEMS = [
  { icon: Banknote, label: "Cash & valuables" },
  { icon: Flame, label: "Dangerous goods" },
  { icon: Leaf, label: "Perishables" },
  { icon: Package, label: "Poorly packed fragile items" },
]

function createEmptyItem(): LuggageItem {
  return {
    id: crypto.randomUUID(),
    photos: [],
    size: null,
    estimatedWeight: "",
    autoDetected: false,
  }
}

function initItems(data: BookingData): LuggageItem[] {
  if (data.items.length > 0) {
    return data.items.map((item) => ({
      id: item.id,
      photos: item.photos,
      size: item.size as Size,
      estimatedWeight: item.estimatedWeight?.toString() || "",
      autoDetected: false,
    }))
  }
  return [createEmptyItem()]
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Failed to read file as data URL"))
      }
    }
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export function LuggageInputScreen({ data, onUpdate, onNext, onBack }: LuggageInputScreenProps) {
  const [items, setItems] = useState<LuggageItem[]>(() => initItems(data))
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showProhibitedModal, setShowProhibitedModal] = useState(false)
  const [showSizeModal, setShowSizeModal] = useState<Size | null>(null)
  const [uploadingItemIds, setUploadingItemIds] = useState<Record<string, boolean>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const updateItem = (id: string, updates: Partial<LuggageItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  const handleAddPhoto = (itemId: string) => {
    fileInputRefs.current[itemId]?.click()
  }

  const handleFileChange = (itemId: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const item = items.find((i) => i.id === itemId)
    if (!item || item.photos.length >= 3) return

    try {
      setUploadingItemIds((prev) => ({ ...prev, [itemId]: true }))
      
      const dataUrl = await readFileAsDataUrl(file)

      const isFirstPhoto = item.photos.length === 0
      let newPhotos: string[] = [...item.photos]

      try {
        const { photoUrl } = await uploadPhoto(file)
        newPhotos = [...item.photos, photoUrl]
      } catch (err) {
        console.error("Photo upload failed", err)
        return
      }

      if (isFirstPhoto) {
        const estimation = estimateSizeFromPhoto(dataUrl)
        updateItem(itemId, {
          photos: newPhotos,
          size: estimation.size,
          estimatedWeight: SIZE_INFO[estimation.size].defaultWeight.toString(),
          autoDetected: true,
        })
      } else {
        updateItem(itemId, { photos: newPhotos })
      }
    } finally {
      setUploadingItemIds((prev) => ({ ...prev, [itemId]: false }))
      
      e.target.value = ""
    }
  }

  const handleRemovePhoto = (itemId: string, index: number) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const removed = item.photos[index]
    if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed)

    const newPhotos = [...item.photos]
    newPhotos.splice(index, 1)
    
    if (newPhotos.length === 0) {
      updateItem(itemId, { photos: newPhotos, size: null, estimatedWeight: "", autoDetected: false })
    } else {
      updateItem(itemId, { photos: newPhotos })
    }
  }

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()])
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    const item = items.find((i) => i.id === id)
    item?.photos.forEach((p) => { if (p?.startsWith("blob:")) URL.revokeObjectURL(p) })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const allItemsValid = items.every((item) => item.photos.length >= 1 && item.size !== null)
  const canContinue = allItemsValid

  const handleContinue = () => {
    if (!canContinue) return
    setShowConfirmModal(true)
  }

  const handleConfirm = () => {
    setShowConfirmModal(false)
    onUpdate({
      ...data,
      items: items.map((item) => ({
        id: item.id,
        size: item.size!,
        photos: item.photos,
        estimatedWeight: item.estimatedWeight ? parseFloat(item.estimatedWeight) : undefined,
      })),
    })
    onNext()
  }

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-background">
      {}
      <header className="p-4 flex items-center gap-3 border-b border-border">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-semibold text-lg text-foreground">Your luggage</h1>
          <p className="text-sm text-muted-foreground">
            {items.length === 1 ? "Photo first, then select size." : `${items.length} items`}
          </p>
        </div>
      </header>

      {}
      <div className="flex-1 overflow-auto p-4 space-y-6">

        {}
        <p className="text-xs text-muted-foreground text-center">
          Handled by Japan{"'"}s nationwide delivery network
        </p>

        {items.map((item, itemIndex) => (
          <div key={item.id} className="space-y-4">

            {}
            {itemIndex > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground">Item {itemIndex + 1}</span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {}
            <div className="p-4 rounded-lg bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-medium text-foreground">
                    {items.length > 1 ? `Luggage ${itemIndex + 1} photos` : "Luggage photos"}
                  </h3>
                </div>
                {item.photos.length === 0 && (
                  <span className="text-[10px] font-medium text-destructive">Min 1 photo</span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Include handles and casters. Multiple photos OK.
              </p>

              <input
                ref={(el) => { fileInputRefs.current[item.id] = el }}
                type="file"
                accept="image/*"
                onChange={handleFileChange(item.id)}
                className="hidden"
                aria-label="Select luggage photo"
              />

              <div className="flex gap-2">
                {item.photos.map((photo, photoIndex) => (
                  <div key={photoIndex} className="w-20 h-20 rounded-lg bg-muted overflow-hidden relative group shrink-0">
                    <img src={photo || "/placeholder.svg"} alt={`Luggage photo ${photoIndex + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(item.id, photoIndex)}
                      className="absolute top-1 right-1 p-0.5 bg-background/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {item.photos.length < 3 && (
                  <button
                    onClick={() => handleAddPhoto(item.id)}
                    disabled={!!uploadingItemIds[item.id]}
                    className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-muted/50 transition-colors shrink-0 ${
                      item.photos.length === 0 ? "border-foreground/30" : "border-muted-foreground/20"
                    }`}
                  >
                    {uploadingItemIds[item.id] ? (
                      <>
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                        <span className="text-[10px] text-muted-foreground">Uploading</span>
                      </>
                    ) : (
                      <>
                        <Camera className={`w-5 h-5 ${item.photos.length === 0 ? "text-muted-foreground" : "text-muted-foreground/50"}`} />
                        <span className="text-[10px] text-muted-foreground">{item.photos.length}/3</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {}
            <div className="grid grid-cols-2 gap-3">
              {(["S", "M", "L", "LL"] as Size[]).map((size) => {
                const info = SIZE_INFO[size]
                const isSelected = item.size === size
                return (
                  <button
                    key={size}
                    onClick={() => {
                      updateItem(item.id, {
                        size,
                        estimatedWeight: SIZE_INFO[size].defaultWeight.toString(),
                        autoDetected: false,
                      })
                    }}
                    className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-muted-foreground bg-card"
                    }`}
                  >
                    <div className="aspect-square relative mb-3 rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={info.image || "/placeholder.svg"}
                        alt={`${size} size luggage`}
                        fill
                        className="object-cover"
                      />
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowSizeModal(size)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowSizeModal(size)
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-background/90 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`View ${size} size details`}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {item.autoDetected && isSelected && (
                      <span className="absolute top-2 left-2 text-[10px] font-medium bg-foreground text-background px-1.5 py-0.5 rounded-full">
                        Auto
                      </span>
                    )}

                    <p className="text-sm font-medium text-foreground leading-tight">{info.label}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-muted-foreground">{info.dimensions}</span>
                      <span className="text-[11px] text-muted-foreground/50">|</span>
                      <span className="text-[11px] text-muted-foreground">{info.weight}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {}
            {item.size && (
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor={`weight-${item.id}`} className="text-sm font-medium text-foreground">
                    Estimated weight
                  </label>
                  {item.autoDetected && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      Auto-estimated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`weight-${item.id}`}
                    type="number"
                    min="1"
                    max={SIZE_INFO[item.size].maxKg}
                    step="1"
                    value={item.estimatedWeight}
                    onChange={(e) => updateItem(item.id, { estimatedWeight: e.target.value, autoDetected: false })}
                    className="w-24 text-center"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">kg</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Max {SIZE_INFO[item.size].maxKg} kg for {item.size}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {"An estimate is fine. The carrier will measure it."}
                </p>
              </div>
            )}
          </div>
        ))}

        {}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"If your item is larger than selected, we'll automatically adjust the size and charge the difference. Delivery will not be stopped."}
          </p>
        </div>

        {}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Ruler className="w-4 h-4 shrink-0" />
          <span>Need exact size? A measuring tape is available at the front desk.</span>
        </div>

        {}
        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add another luggage</span>
        </button>
      </div>

      {}
      <div className="p-4 border-t border-border bg-card">
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full h-12"
        >
          {items.length === 1 ? "Continue" : `Continue with ${items.length} items`}
        </Button>
      </div>

      {}
      {showProhibitedModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            onClick={() => setShowProhibitedModal(false)}
          />
          <div className="relative bg-card w-full max-w-md rounded-t-2xl border-t border-border p-6 pb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Prohibited items</h2>
              <button
                onClick={() => setShowProhibitedModal(false)}
                className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {PROHIBITED_ITEMS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-foreground">{label}</span>
                </div>
              ))}
            </div>

            <a
              href="https://www.kuronekoyamato.co.jp/ytc/en/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              View full list on carrier website
            </a>
          </div>
        </div>
      )}

      {}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="relative bg-card w-full max-w-md rounded-t-2xl border-t border-border p-6 pb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Before you continue</h2>

            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Package className="w-3.5 h-3.5 text-foreground" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  My {items.length === 1 ? "item contains" : "items contain"} no prohibited goods (cash, dangerous goods, perishables).
                  {" "}
                  <a
                    href="/legal/terms#luggage-guidelines"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    View list
                  </a>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Ruler className="w-3.5 h-3.5 text-foreground" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  If the carrier measures a different size, the price adjusts automatically. No action needed.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-foreground/5 border border-foreground/10 mb-5">
              <p className="text-sm font-semibold text-foreground">
                By continuing, you agree to our{" "}
                <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary transition-colors">
                  Terms of Service
                </a>.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 h-12"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 h-12"
              >
                Agree and continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {}
      {showSizeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            onClick={() => setShowSizeModal(null)}
          />
          <div className="relative bg-card w-full max-w-md rounded-t-2xl border-t border-border p-6 pb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{SIZE_INFO[showSizeModal].label}</h2>
              <button
                onClick={() => setShowSizeModal(null)}
                className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <svg width="120" height="160" viewBox="0 0 120 160" className="text-foreground">
                  <rect x="20" y="30" width="80" height="110" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="45" y="10" width="30" height="25" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="50" y1="35" x2="50" y2="30" stroke="currentColor" strokeWidth="2" />
                  <line x1="70" y1="35" x2="70" y2="30" stroke="currentColor" strokeWidth="2" />
                  <circle cx="35" cy="145" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="85" cy="145" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <div className="absolute -right-8 top-8 bottom-8 flex flex-col items-center justify-center">
                  <div className="w-px h-full bg-muted-foreground/50 relative">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 border-t-2 border-r-2 border-muted-foreground/50 rotate-[-45deg]" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 border-t-2 border-r-2 border-muted-foreground/50 rotate-[135deg]" />
                  </div>
                </div>
                <div className="absolute left-5 right-5 -bottom-6 flex items-center justify-center">
                  <div className="h-px w-full bg-muted-foreground/50 relative">
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-muted-foreground/50 rotate-[-135deg]" />
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-muted-foreground/50 rotate-[45deg]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl flex-1">
                <svg width="24" height="24" viewBox="0 0 24 24" className="text-muted-foreground">
                  <path d="M3 5v14h18V5H3zm16 12H5V7h14v10z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 12h10M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-muted-foreground">Total (H+W+D)</span>
                <span className="text-sm font-semibold text-foreground">{SIZE_INFO[showSizeModal].dimensions}</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl flex-1">
                <svg width="24" height="24" viewBox="0 0 24 24" className="text-muted-foreground">
                  <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-muted-foreground">Weight</span>
                <span className="text-sm font-semibold text-foreground">{SIZE_INFO[showSizeModal].weight}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
