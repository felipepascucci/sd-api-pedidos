import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/common'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState icon={Compass} title="Página não encontrada" description="Esse endereço não existe no painel.">
      <Button asChild size="sm" variant="outline" className="mt-2">
        <Link to="/">Voltar para a visão geral</Link>
      </Button>
    </EmptyState>
  )
}
