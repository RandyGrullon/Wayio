'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { InputProps } from '@/components/ui/Input'

/**
 * Campo de contraseña con el botón «ojo» de 44 px (docs/DISENO.md §6.9):
 * alterna entre texto y puntos, con aria-label y aria-pressed.
 */
export function CampoClave(props: Omit<InputProps, 'type' | 'suffix'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <IconButton
          label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          size="icon"
          className="size-11"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
        >
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      }
    />
  )
}
