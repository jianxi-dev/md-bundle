## ADDED Requirements

### Requirement: Theme toggle button displays state-aware icon
The theme toggle button SHALL display a different icon based on the current theme preference: sun icon for light mode, moon icon for dark mode, and the existing half-moon icon for system mode.

#### Scenario: Light mode shows sun icon
- **WHEN** the current theme preference is `light`
- **THEN** the theme toggle button renders a sun icon

#### Scenario: Dark mode shows moon icon
- **WHEN** the current theme preference is `dark`
- **THEN** the theme toggle button renders a moon icon

#### Scenario: System mode shows half-moon icon
- **WHEN** the current theme preference is `system`
- **THEN** the theme toggle button renders the existing half-moon icon

#### Scenario: Icon updates immediately on toggle
- **WHEN** the user clicks the theme toggle button
- **THEN** the icon changes to reflect the new state without page reload

#### Scenario: Icon persists across page reload
- **WHEN** the user reloads the page
- **THEN** the icon reflects the persisted theme preference from localStorage

### Requirement: Theme toggle button has accessible state label
The theme toggle button SHALL have a dynamic `title` and `aria-label` that communicates the current theme state and the next action.

#### Scenario: Accessible label reflects current state
- **WHEN** the current theme preference is `light`
- **THEN** the button's aria-label indicates "current: light theme" and title indicates the next switch target (dark)
