import { Button } from '@/components/ui/button'

/**
 * UserChip — header identity affordance (Angular user-profile-indicator parity).
 * Initials chip (with the full loginId as a tooltip) when identified; a
 * "Sign in" button otherwise. Props come from {@link useUserInfo}.
 */
export interface UserChipProps {
  loginId: string | null
  initials: string
  isIdentified: boolean
}

export function UserChip({ loginId, initials, isIdentified }: UserChipProps) {
  if (!isIdentified) {
    return (
      <Button type="button" size="sm" variant="outline">
        Sign in
      </Button>
    )
  }
  return (
    <div
      title={loginId ?? undefined}
      className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {initials}
    </div>
  )
}
