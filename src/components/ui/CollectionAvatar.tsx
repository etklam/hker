'use client'

import React from 'react'

interface Props {
  title: string
  className?: string
}

export function CollectionAvatar({ title, className = '' }: Props) {
  const char = title.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-accent-soft text-accent font-bold text-lg select-none ${className}`}
      style={{ width: '2.5rem', height: '2.5rem' }}
    >
      {char}
    </div>
  )
}
