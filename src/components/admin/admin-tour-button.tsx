import 'driver.js/dist/driver.css'

import { driver } from 'driver.js'
import { CircleHelp } from 'lucide-react'

import type { AdminTour, AdminTourStep } from '@/components/admin/admin-tours'
import { useTourHidden } from '@/components/admin/tour-preference'
import { Button } from '@/components/ui/button'

const isOnPage = (anchor: string) => document.querySelector(`[data-tour="${anchor}"]`) !== null

// The step's own anchor, or its fallback when only the fallback is on the page.
function anchorFor(step: AdminTourStep): string {
  if (isOnPage(step.anchor) || !step.fallback) return step.anchor
  return isOnPage(step.fallback) ? step.fallback : step.anchor
}

// driver.js reads the DOM, so it starts only from a click, never during render or on the server.
export function startAdminTour(tour: AdminTour): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  driver({
    animate: !reduceMotion,
    allowClose: true,
    // The highlighted control is not clickable while the tour runs, so a step cannot open a dialog behind it.
    disableActiveInteraction: true,
    showProgress: true,
    popoverClass: 'admin-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    // A step's action ends the tour, then clicks a real control or dispatches an event. It never submits a form.
    onPopoverRender: (popover, { driver: active, index }) => {
      const action = index === undefined ? undefined : tour.steps[index]?.action
      if (!action) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'driver-popover-footer-btn admin-tour-action'
      button.textContent = action.label
      button.addEventListener('click', () => {
        active.destroy()
        if ('event' in action) window.dispatchEvent(new Event(action.event))
        else document.querySelector<HTMLElement>(`[data-tour="${action.click}"]`)?.click()
      })
      popover.footerButtons.prepend(button)
    },
    steps: tour.steps.map((step) => ({
      element: `[data-tour="${anchorFor(step)}"]`,
      skipMissingElement: step.skipMissing ?? false,
      popover: { title: step.title, description: step.description },
    })),
  }).drive()
}

export function AdminTourButton({ tour }: { tour: AdminTour }) {
  const hidden = useTourHidden()
  if (hidden) return null
  return (
    <Button type="button" variant="outline" onClick={() => startAdminTour(tour)}>
      <CircleHelp data-icon="inline-start" />
      Take a tour
    </Button>
  )
}
