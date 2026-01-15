'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Moon, Sun, Monitor, Sparkles } from 'lucide-react'

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  const themeOptions = [
    {
      value: 'light',
      label: 'Light',
      icon: Sun,
      description: 'Always use light mode'
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: Moon,
      description: 'Always use dark mode'
    },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Follow system preference'
    },
    {
      value: 'rose',
      label: 'Richelle Theme',
      icon: Sparkles,
      description: 'Richelle Theme'
    }
  ]

  const handleThemeChange = async (newTheme: string) => {
    try {
      // Update theme in next-themes
      setTheme(newTheme)

      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          theme: newTheme,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.error('Theme update error:', error)
        throw error
      }

      toast.success('Theme updated successfully')
    } catch (err) {
      toast.error('Failed to update theme')
      console.error('Theme change error:', err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how BudgetBud looks and feels.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Theme</h3>
          <div className="grid grid-cols-1 gap-3">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = theme === option.value

              return (
                <div
                  key={option.value}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => handleThemeChange(option.value)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
