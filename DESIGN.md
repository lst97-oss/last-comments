# DESIGN.md — Frontend Styling & Design System Rules

## 1. Core Principles

Follow modern frontend styling best practices using Tailwind CSS and standard CSS.

The primary objective is to produce clean, consistent, maintainable, accessible, and scalable user interfaces.

### General Rules

- Prefer Tailwind CSS for standard component styling.
- Use standard CSS when it provides a cleaner or more maintainable solution.
- Do not force every styling requirement into Tailwind utilities.
- Do not create unnecessary CSS classes when Tailwind utilities are sufficient.
- Avoid excessive utility classes, arbitrary values, duplicated styles, and unnecessary colour variations.
- Prioritize consistency, readability, accessibility, and maintainability over visual complexity.
- Follow the project's existing design system before introducing new styling conventions.
- Do not introduce additional styling libraries without a clear architectural reason.
- Use the existing Tailwind CSS version and its recommended configuration patterns.

---

## 2. Tailwind CSS vs Standard CSS

### Prefer Tailwind CSS For

- Layouts using Flexbox or Grid.
- Spacing, padding, margins, and gaps.
- Typography and text alignment.
- Backgrounds and borders.
- Border radius and shadows.
- Responsive layouts.
- Common hover, focus, active, and disabled states.
- Simple transitions and animations.
- Standard component styling.
- Light and dark theme utilities.

### Prefer Standard CSS For

- Complex animations and keyframes.
- Advanced pseudo-elements and selectors.
- Complex visual effects.
- Repeated styling patterns that cannot be reasonably simplified through reusable components.
- Global styling and CSS resets.
- Font declarations.
- Third-party component overrides.
- Complex styling involving CSS inheritance.
- Dynamic styling that benefits from CSS custom properties.
- Browser-specific styling requirements.

### Decision Rules

1. First determine whether Tailwind can express the styling clearly.
2. If Tailwind produces unnecessarily complex or difficult-to-maintain markup, consider standard CSS.
3. Prefer extracting reusable React components over duplicating large sets of Tailwind classes.
4. Do not automatically extract CSS classes simply because a component contains several utilities.
5. Do not mix Tailwind and CSS for the same styling responsibility without a clear reason.
6. Avoid rewriting existing working CSS into Tailwind unless there is a measurable maintainability benefit.

The correct solution is whichever approach expresses the styling intent most clearly with the least unnecessary complexity.

---

## 3. Prevent Excessive Tailwind Utility Usage

Avoid unnecessarily long or repetitive Tailwind class lists.

### Rules

- Use Tailwind utilities when they are straightforward and readable.
- Avoid excessive arbitrary values such as `w-[347px]` or `rounded-[13px]` when standard design tokens are sufficient.
- Avoid repeating identical utility combinations throughout the application.
- Extract shared components when repeated styling represents the same UI responsibility.
- Use component variants for reusable styling differences.
- Prefer `clsx`, `tailwind-merge`, or an existing `cn()` helper for conditional classes.
- Use Class Variance Authority (CVA) or an equivalent pattern when managing complex reusable component variants.
- Do not create component abstractions solely to shorten class strings.
- Avoid dynamically constructing incomplete Tailwind class names that cannot be reliably detected during compilation.

### Avoid

Creating large class lists simply to achieve small visual differences.

Do not use multiple conflicting utilities such as:
- `p-4 p-6`
- `bg-primary bg-secondary`
- `text-sm text-lg`
- `rounded-md rounded-xl`

unless they are intentionally separated by responsive or state variants.

### Preferred Approach

When styling becomes difficult to read:
1. Remove unnecessary or conflicting utilities.
2. Replace arbitrary values with existing design tokens.
3. Extract repeated structures into reusable components.
4. Use component variants where appropriate.
5. Move genuinely complex styling into CSS when it improves clarity.

Do not impose an arbitrary maximum number of Tailwind classes. Evaluate complexity and maintainability instead.

---

## 4. Centralized Theme Management

All project theme colours must be centrally managed.

### Rules

- Define theme colours using semantic design tokens.
- Keep theme definitions in the project's global styling system.
- For Tailwind CSS v4, use CSS custom properties and `@theme` or `@theme inline` as appropriate.
- Support light and dark themes through centralized token definitions.
- Do not hardcode brand colours throughout individual components.
- Do not create duplicate tokens with identical purposes.
- Reuse existing tokens before introducing additional ones.
- Use consistent naming conventions.

### Standard Semantic Colour Tokens

#### Core

- `background`
- `foreground`
- `card`
- `card-foreground`
- `popover`
- `popover-foreground`

#### Brand

- `primary`
- `primary-foreground`
- `secondary`
- `secondary-foreground`

#### Neutral UI

- `muted`
- `muted-foreground`
- `accent`
- `accent-foreground`
- `border`
- `input`
- `ring`

#### Status

- `success`
- `success-foreground`
- `success-muted`
- `warning`
- `warning-foreground`
- `warning-muted`
- `error`
- `error-foreground`
- `error-muted`
- `info`
- `info-foreground`
- `info-muted`

#### Dangerous Actions

- `destructive`
- `destructive-foreground`

Not every project requires every token. Introduce tokens when there is a clear design requirement.

---

## 5. Semantic Colour Usage

Colours must communicate purpose rather than serve as arbitrary decoration.

### Primary

Use for:
- Main call-to-action buttons.
- Primary interactive elements.
- Important brand-related interactions.
- Active states when appropriate.

Avoid:
- Applying the primary colour to every component.
- Excessively highlighting unrelated elements.
- Using primary backgrounds throughout large sections without a design reason.

### Secondary

Use for:
- Secondary actions.
- Lower-emphasis interactive components.
- Supporting controls.

Avoid competing visually with primary actions.

### Accent

Use for:
- Hover highlights.
- Selected surfaces.
- Subtle decorative emphasis.
- Supporting interaction feedback.

Accent should not automatically replace primary.

### Muted

Use for:
- Secondary surfaces.
- Disabled-looking decorative surfaces.
- Supporting information.
- Subtle background differentiation.

Do not rely on muted colours alone to communicate disabled states.

### Success

Use only when communicating:
- Successful operations.
- Completed actions.
- Approved statuses.
- Healthy system states.
- Positive confirmation.

Do not use success colours for ordinary decorative elements.

### Warning

Use only when communicating:
- Potential problems.
- Pending attention.
- Cautionary conditions.
- Non-critical operational risks.

Do not use warning colours for general highlighting.

### Error

Use only when communicating:
- Failed operations.
- Validation errors.
- Invalid states.
- System failures.

### Destructive

Use for:
- Delete actions.
- Account removal.
- Irreversible operations.
- Dangerous user actions.

Distinguish destructive actions from ordinary error messages.

### Info

Use for:
- Informational notices.
- Neutral system messages.
- Additional guidance.
- Explanatory alerts.

---

## 6. Prevent Excessive Colour Usage

Do not apply semantic colours excessively or unnecessarily.

### Rules

- Prefer neutral surfaces for most application interfaces.
- Reserve strong colours for meaningful actions and important states.
- Avoid using multiple saturated semantic colours in the same visual region without a clear purpose.
- Do not alternate colours between adjacent components merely to create visual variety.
- Do not automatically colour every icon, heading, border, or background.
- Avoid applying status colours to entire sections when a small indicator communicates the same meaning.
- Prefer muted status backgrounds for alerts, badges, and notifications.
- Avoid combining unrelated status colours within a single component.
- Maintain a clear visual hierarchy through spacing, typography, and contrast before introducing additional colours.
- Use colour consistently for the same semantic meaning throughout the application.

### Preferred Visual Hierarchy

1. Neutral backgrounds and surfaces.
2. Clear typography and spacing.
3. Primary colour for important actions.
4. Secondary and accent colours for supporting interactions.
5. Status colours only when conveying semantic meaning.

Do not use colour as the default solution for visual hierarchy.

---

## 7. Status Component Styling

Use semantic status tokens consistently.

### Status Alerts

Prefer:
- Muted semantic background.
- Readable foreground text.
- A status icon when useful.
- A subtle semantic border or indicator.

Avoid:
- Excessively saturated backgrounds.
- Multiple competing status colours.
- Unnecessary gradients.
- Decorative animations for normal status messages.

### Status Badges

Prefer compact and visually restrained badges.

Use strong semantic colours only when the status requires additional emphasis.

### Status Icons

Use semantic status colours when the icon represents a meaningful state.

Do not colour ordinary icons with success, warning, or error tokens without semantic justification.

### Accessibility

- Never communicate status through colour alone.
- Provide descriptive labels or supporting icons.
- Maintain WCAG-compliant contrast.
- Target at least WCAG AA contrast requirements:
  - 4.5:1 for normal text.
  - 3:1 for large text.
  - 3:1 for relevant non-text UI indicators.
- Verify contrast separately for light and dark themes.

---

## 8. Component Styling Architecture

Keep component styling predictable and maintainable.

### Rules

- Components should consume semantic design tokens.
- Components must not define their own duplicate brand colour systems.
- Prefer reusable UI primitives for buttons, inputs, cards, badges, and alerts.
- Use component variants for meaningful differences such as size, intent, or appearance.
- Avoid creating multiple components that differ only through minor styling changes.
- Keep component styling close to the component unless shared CSS is clearly beneficial.
- Avoid excessive prop-based styling configurations.
- Prefer composition over complicated styling inheritance.

### Recommended Component Variants

Buttons may support:
- `primary`
- `secondary`
- `outline`
- `ghost`
- `destructive`

Alerts may support:
- `default`
- `success`
- `warning`
- `error`
- `info`

Do not introduce additional variants without a genuine use case.

---

## 9. CSS Architecture

Keep global CSS minimal and purposeful.

### Global CSS Should Contain

- CSS resets and foundational styles.
- Font definitions.
- Theme variables.
- Tailwind theme integration.
- Global accessibility improvements.
- Shared complex animations.
- Necessary third-party overrides.

### Component CSS Should Contain

- Complex component-specific animations.
- Advanced selectors.
- Complex pseudo-elements.
- Styling that is substantially clearer in CSS than Tailwind.

### Rules

- Avoid unnecessary global selectors.
- Avoid excessive selector specificity.
- Avoid `!important` unless unavoidable.
- Avoid duplicating Tailwind utilities through custom CSS.
- Prefer scoped component styles where appropriate.
- Avoid excessive use of `@apply` as a replacement for ordinary Tailwind utilities.
- Use CSS custom properties for dynamic values when appropriate.

---

## 10. Responsive Design

Follow a mobile-first approach.

### Rules

- Build layouts that work at small viewport sizes before adding larger breakpoint adjustments.
- Use Tailwind responsive utilities for standard responsive behaviour.
- Avoid excessive breakpoint overrides.
- Prefer flexible layouts over hardcoded widths.
- Use CSS Grid and Flexbox appropriately.
- Avoid fixed heights when content may expand.
- Ensure components support text wrapping and content overflow.
- Consider container queries when component responsiveness depends on available container space.

Do not add responsive utilities unnecessarily when the default layout already works across screen sizes.

---

## 11. Dark Mode

Dark mode must use the same semantic token system.

### Rules

- Define light and dark theme values centrally.
- Prefer semantic tokens over individual `dark:` overrides for theme colours.
- Use `dark:` utilities when an element requires genuinely different structural or visual treatment.
- Avoid manually specifying separate light/dark colours in every component.
- Ensure both themes maintain readable contrast.
- Avoid unnecessary decorative differences between themes.
- Do not assume shadows, borders, or muted colours work equally well in both themes.

A component should ideally adapt to theme changes without requiring modifications to its implementation.

---

## 12. Accessibility and Interaction States

All interactive components must provide accessible visual feedback.

### Requirements

- Visible keyboard focus indicators.
- Clear hover and active feedback where relevant.
- Distinguishable disabled states.
- Sufficient colour contrast.
- Consistent interaction patterns.
- Support for reduced-motion preferences where appropriate.
- Accessible error and validation messages.

### Rules

- Do not remove focus outlines without providing an accessible replacement.
- Avoid relying exclusively on hover states.
- Do not use colour alone to communicate interaction states.
- Avoid unnecessary transitions and animations.
- Respect `prefers-reduced-motion`.
- Prefer native HTML semantics over styling-based accessibility workarounds.

---

## 13. Avoid Overengineering

Do not introduce unnecessary complexity into the styling architecture.

### Avoid

- Creating custom CSS utilities already provided by Tailwind.
- Creating multiple semantic tokens for the same purpose.
- Introducing unnecessary component variants.
- Building large styling abstraction layers for simple UI.
- Creating CSS files for components that only need a few Tailwind utilities.
- Introducing design tokens for values used only once without a clear reuse or consistency requirement.
- Creating elaborate animations for ordinary interactions.
- Adding gradients, shadows, borders, or colours without a clear visual purpose.

### Prefer

- Simple solutions.
- Existing design tokens.
- Consistent spacing scales.
- Reusable component primitives.
- Semantic styling.
- Minimal duplication.
- Readable implementation.
- Established project conventions.

---

## 14. Existing Project Compatibility

When modifying an existing project:
1. Inspect the current styling architecture.
2. Identify the installed Tailwind version.
3. Review existing design tokens.
4. Review established component patterns.
5. Reuse existing utilities and components.
6. Preserve current visual consistency.
7. Avoid introducing a competing design system.
8. Avoid unnecessary refactoring unrelated to the requested task.

Do not replace existing CSS or Tailwind implementations merely because another approach is preferred.

Changes should improve maintainability without creating unnecessary code churn.

---

## 15. Styling Decision Checklist

Before implementing styling, evaluate:
1. Can existing design tokens satisfy the requirement?
2. Can existing components or variants be reused?
3. Is Tailwind the clearest implementation?
4. Would standard CSS provide better readability?
5. Are arbitrary values genuinely necessary?
6. Are any styles duplicated or conflicting?
7. Are semantic colours being used correctly?
8. Are strong colours applied only where necessary?
9. Does the design work in light and dark themes?
10. Is the implementation responsive and accessible?
11. Does the solution introduce unnecessary abstractions?
12. Is the result consistent with the existing project?

If the implementation becomes unnecessarily complicated, simplify it before considering the task complete.

---

## 16. Final Implementation Principles

Follow these priorities in order:
1. Correctness and accessibility.
2. Consistency with the existing design system.
3. Maintainability and readability.
4. Appropriate reuse and component composition.
5. Responsive behaviour.
6. Performance.
7. Visual polish.

### Golden Rules

- Tailwind first, CSS when appropriate.
- Semantic tokens before hardcoded colours.
- Neutral colours by default, semantic colours with purpose.
- Reusable components before duplicated styling.
- Clear code before clever abstractions.
- Consistency before unnecessary visual variety.
- Simplicity before overengineering.

**The objective is not to maximize Tailwind usage, minimize CSS usage, or introduce more colours. The objective is to build a consistent, accessible, professional UI using the simplest maintainable solution.**

---

## 17. shadcn Components

Reusable UI primitives come from the shadcn registry (`src/components/ui/`,
`base-nova` style, neutral base, lucide icons) — this is the concrete
implementation of §8's "prefer reusable UI primitives" rule.

### Rules

- Use a registry component before hand-rolling buttons, inputs, cards, badges,
  alerts, dialogs, toasts, or their variants. Add missing ones with
  `bunx shadcn add <name>` so style, tokens, and `data-slot` attributes stay
  consistent — do not copy-paste from the docs site.
- Components are owned source after `add`, not generated files: edit freely,
  but keep the `base-nova` look, the `cn()` conditional-class pattern, and the
  existing variant names. Do not fork the visual language per component.
- Components consume the §4 semantic tokens (`bg-primary`, `text-muted-foreground`,
  status `*-muted` backgrounds) — never hardcode colours into a component.
  `components.json` pins the shared choices (style, base colour, icon library);
  keep them aligned when adding.
- Conditional classes go through `cn()` (`@/lib/utils`); complex variant
  matrices use CVA, matching the existing `buttonVariants` pattern.
- Global providers required by a component (e.g. `<Toaster />`) mount once in
  the root shell (`src/routes/__root.tsx`), never per route.

`components.json`, `src/components/ui/*`, `src/hooks/*`, and `@/lib/utils` are
shared foundation: keep them, extend them, and keep this document's rules
applied to every addition.
