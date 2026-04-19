'use client'

import React from 'react'
import { Search } from 'lucide-react'

interface Props {
  value: string
  placeholder?: string
  onChange: (v: string) => void
  onSearch: () => void
}

export function SearchBar({ value, placeholder, onChange, onSearch }: Props) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <Search
          size={18}
          strokeWidth={2.5}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSearch() }}
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-text placeholder:text-muted outline-none mochi-spring focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </div>
      <button
        type="button"
        onClick={onSearch}
        className="mochi-spring flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover active:scale-95"
      >
        <Search size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
