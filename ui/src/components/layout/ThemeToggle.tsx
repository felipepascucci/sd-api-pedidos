import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const escuro = resolvedTheme !== 'light'
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      title={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label="Alternar tema"
    >
      {escuro ? <Sun /> : <Moon />}
    </Button>
  )
}
