import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // Fallback para contextos sem Clipboard API (ex.: http em IP não-localhost).
    const area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

interface Props {
  text: string | (() => string)
  label?: string
  size?: 'xs' | 'sm' | 'icon-xs' | 'icon-sm'
  variant?: 'ghost' | 'outline' | 'secondary'
}

export function CopyButton({ text, label, size, variant = 'ghost' }: Props) {
  const [copiado, setCopiado] = useState(false)
  const onClick = async () => {
    const ok = await copiar(typeof text === 'function' ? text() : text)
    if (ok) {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } else {
      toast.error('Não foi possível copiar')
    }
  }
  const Icone = copiado ? Check : Copy
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (label ? 'xs' : 'icon-xs')}
      onClick={onClick}
      title={label ?? 'Copiar'}
      aria-label={label ?? 'Copiar'}
    >
      <Icone className={copiado ? 'text-emerald-500' : undefined} />
      {label}
    </Button>
  )
}
