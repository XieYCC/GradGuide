# UI Design Specification

> Source: Health App UI Templates (3 variants)
> Date: 2026-06-27
> Platform: Mobile
> Device: iOS

---

## 1. Design Principles (从截图推断的核心理念)

- **Clarity First** - High contrast typography, clear visual hierarchy, generous white space
- **Soft & Approachable** - Rounded corners throughout, friendly illustrations, calm color palette
- **Data Visualization Focus** - Clean charts, progress indicators, metric cards with subtle depth
- **Card-Based Modularity** - Content organized into distinct, independent card components
- **Consistent Elevation** - Subtle shadow system creating gentle depth without harshness

---

## 2. Color Palette (配色系统)

### Primary Colors
| Role | Hex | Usage |
|------|-----|-------|
| Primary Brand (Teal) | #0D9488 | Main CTAs, active states, progress rings, brand accents |
| Primary Brand (Light Teal) | #14B8A6 | Secondary accents, gradient stops, icons |

### Accent Colors
| Role | Hex | Usage |
|------|-----|-------|
| Orange Accent | #F97316 | "Start walk" CTA, streak indicator, action badges |
| Purple Accent | #8B5CF6 | Sleep tracking, secondary metrics |
| Blue Accent | #3B82F6 | Hydration tracking, primary metrics |
| Green Accent | #10B981 | Success states, good indicators, checkmarks |
| Red Accent | #EF4444 | Warning indicators, alert badges |
| Yellow Accent | #FBBF24 | Neutral/middle states, "Okay" mood |

### Neutral Colors
| Role | Hex | Alpha | Usage |
|------|-----|-------|-------|
| Background | #F8FAFC | 1.0 | Page background |
| Card Background | #FFFFFF | 1.0 | All card containers |
| Inactive Tab BG | #F1F5F9 | 1.0 | Inactive tabs, subtle dividers |
| Border / Divider | #E2E8F0 | 1.0 | Card borders, horizontal rules |
| Text Primary | #0F172A | 1.0 | Headings, primary metrics |
| Text Secondary | #475569 | 1.0 | Body text, secondary labels |
| Text Tertiary | #94A3B8 | 1.0 | Captions, timestamps, placeholders |
| Text Muted | #CBD5E1 | 1.0 | Inactive states, disabled text |

### Gradients
| Name | Values | Usage |
|------|--------|-------|
| Health Score Ring | #06B6D4 → #10B981 → #22C55E | Circular progress indicator (Template 1) |
| AI Readiness Ring | #3B82F6 → #06B6D4 → #10B981 → #22C55E → #84CC16 → #EAB308 | Multi-color circular progress (Template 3) |
| Orange Button | #F97316 solid [Inferred] | Primary action button |

---

## 3. Typography System (字体系统)

| Style | Size (px) | Font Weight | Line Height | Color | Usage |
|-------|-----------|-------------|-------------|-------|-------|
| Large Metric Number | 48px | 700 (Bold) | 1.1 | #0F172A | Health score (86), AI readiness (78) |
| Page Title | 24px | 700 (Bold) | 1.2 | #0F172A | Main page heading |
| Section Title | 20px | 600 (Semibold) | 1.3 | #0F172A | "Today", "Quick actions", "Vitals" |
| Card Title | 18px | 600 (Semibold) | 1.3 | #0F172A | Card headers, metric names |
| Metric Value | 24px | 600 (Semibold) | 1.2 | #0F172A | Heart rate (72), Glucose (94) |
| Button Text | 16px | 600 (Semibold) | 1.4 | #FFFFFF | Primary button labels |
| Body Text | 15px | 400 (Regular) | 1.5 | #475569 | Primary content, descriptions |
| Caption | 13px | 400 | 1.4 | #64748B | Secondary info, timestamps |
| Small Caption | 12px | 400 | 1.4 | #94A3B8 | Tiny labels, status text |
| Tab Bar Label | 11px | 500 | 1.2 | #64748B | Bottom navigation labels |
| Badge Text | 12px | 600 | 1.2 | #FFFFFF | Status badges, streak indicator |

---

## 4. Spacing System (间距系统)

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon internal padding, tight gaps |
| sm | 8px | Small element spacing, badge padding |
| md | 12px | Card internal padding, small gaps |
| lg | 16px | Standard card padding, section gaps |
| xl | 20px | Page horizontal padding |
| xxl | 24px | Section vertical spacing |
| xxxl | 32px | Major section breaks |

### Layout Grid
- Page horizontal margin: 20px
- Column gutters: 16px
- Card internal padding: 20px
- Line item vertical padding: 16px
- Bottom bar top padding: 12px

---

## 5. Shadow System (阴影系统)

| Elevation | Shadow Spec | Usage |
|-----------|------------|-------|
| Card (Resting) | 0 1px 3px rgba(0, 0, 0, 0.04) [Inferred] | Standard cards at rest |
| Card (Subtle) | 0 2px 8px rgba(0, 0, 0, 0.06) [Inferred] | Feature cards, metric cards |
| Floating Button | 0 4px 12px rgba(0, 0, 0, 0.12) [Inferred] | FAB, floating action button |
| Bottom Bar | 0 -2px 8px rgba(0, 0, 0, 0.04) [Inferred] | Bottom navigation shadow |

---

## 6. Border Radius (圆角系统)

| Token | Value | Usage |
|-------|-------|-------|
| none | 0px | Sharp corners |
| sm | 6px | Small badges, tags |
| md | 10px | Buttons, small cards |
| lg | 16px | Standard cards, main containers |
| xl | 20px | Large metric cards |
| full | 9999px | Pills, avatars, circle buttons, FAB |

---

## 7. Icon System (图标系统)

| Property | Value |
|----------|-------|
| Style | Outline / Linear (2px stroke) |
| Stroke Width | 2px [Inferred] |
| Corner Style | Round caps, rounded joins |
| Standard Size | 24px (buttons), 20px (inline), 16px (small) |
| Color | Inherit text color / #64748B (default) |
| Library | Phosphor / Heroicons style [Inferred] |

### Specific Icon Observations
- Avatar style: Circular, 48px diameter, with border
- Arrow indicators: Chevron right (>) for navigation
- Status icons: Checkmark circles, info circles
- Mood icons: Emoji-style faces with different expressions
- Action icons: Minimal line icons with consistent weight

---

## 8. Component Library (组件库)

### 8.1 Cards

#### Standard Card
```css
.card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: none;
}
```

#### Metric Card (2-column grid)
```css
.card-metric {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.card-metric-icon {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

#### Quick Action Card
```css
.card-action {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  gap: 12px;
}
```

### 8.2 Buttons

#### Button Types
| Variant | Background | Text | Border | Radius |
|---------|-----------|------|--------|--------|
| Primary (Teal) | #0D9488 | White #FFFFFF | None | 12px |
| Primary (Orange) | #F97316 | White #FFFFFF | None | 12px |
| Secondary | #F1F5F9 | #334155 | None | 12px |
| Ghost | Transparent | #0D9488 | None | 12px |
| Icon Circle | #F1F5F9 | #0D9488 | None | 9999px |

#### Button States
**Primary (Teal)**
- Normal: `background: #0D9488; color: #FFFFFF;`
- Hover: `background: #0F766E;` [Inferred]
- Pressed: `background: #115E59; transform: scale(0.98);` [Inferred]
- Disabled: `background: #94A3B8; color: #FFFFFF; opacity: 0.6;` [Inferred]

**Primary (Orange)**
- Normal: `background: #F97316; color: #FFFFFF;`
- Hover: `background: #EA580C;` [Inferred]
- Pressed: `background: #C2410C; transform: scale(0.98);` [Inferred]
- Disabled: `background: #FDBA74; color: #FFFFFF; opacity: 0.6;` [Inferred]

**Icon Circle**
- Normal: `background: #F1F5F9; color: #0D9488;`
- Hover: `background: #E2E8F0;` [Inferred]
- Pressed: `background: #CBD5E1; transform: scale(0.95);` [Inferred]

### 8.3 Progress Indicators

#### Circular Progress Ring
```css
.progress-ring {
  width: 120px;
  height: 120px;
  position: relative;
}

.progress-ring-circle {
  stroke-width: 8px;
  stroke-linecap: round;
  fill: none;
}

.progress-ring-bg {
  stroke: #E2E8F0;
}

.progress-ring-value {
  stroke: url(#gradient);
  stroke-dasharray: 339.292;
  stroke-dashoffset: calc(339.292 - (339.292 * percentage / 100));
}
```

#### Linear Progress Bar
```css
.progress-bar {
  height: 8px;
  background: #E2E8F0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}
```

### 8.4 Data Visualization

#### Mini Line Chart
- Line thickness: 2px
- Line color: #10B981 (green), #EF4444 (red) [Inferred]
- Background grid: None (clean look)
- Height: ~40px
- Curve style: Smooth bezier

#### Bar Chart
- Bar width: 8px [Inferred]
- Bar spacing: 4px [Inferred]
- Bar color: #64748B
- Bar radius: 4px top corners
- Height: ~60px

#### 2x2 Metric Grid
- Grid gap: 16px
- Each cell: Card with icon, metric value, mini chart
- Icon background: Brand-colored circle

### 8.5 Badges & Tags

| Type | Style |
|------|-------|
| Streak Badge | Orange (#F97316) background, white text, pill shape, 20px height |
| Status Badge | Teal background, white text, 18px height |
| Percentage Badge | Gray background, dark text, inline |

### 8.6 Calendar Date Selector
```css
.calendar-day {
  width: 36px;
  height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  gap: 4px;
}

.calendar-day-active {
  background: #0D9488;
  color: #FFFFFF;
}

.calendar-day-inactive {
  background: transparent;
  color: #64748B;
}

.calendar-date {
  font-size: 16px;
  font-weight: 600;
}

.calendar-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #F97316;
}
```

### 8.7 Avatar
```css
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  border: 2px solid #E2E8F0;
  object-fit: cover;
}
```

### 8.8 Mood Selector
```css
.mood-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  background: #F8FAFC;
  transition: all 0.2s ease;
}

.mood-option-selected {
  background: #ECFDF5;
  border: 2px solid #10B981;
}

.mood-emoji {
  font-size: 28px;
}

.mood-label {
  font-size: 14px;
  color: #475569;
}
```

### 8.9 Floating Action Button (FAB)
```css
.fab {
  width: 56px;
  height: 56px;
  border-radius: 9999px;
  background: #0D9488;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  position: fixed;
  right: 20px;
  bottom: 80px;
  border: none;
}
```

---

## 9. Layout Grid (布局网格)

### Breakpoints [Inferred - Mobile First]
| Breakpoint | Width | Columns |
|------------|-------|---------|
| Mobile | < 768px | Single column, 2-column cards |

### Grid System
- **Full width cards:** 1 column, margin 20px left/right
- **Metric grid:** 2 columns, 16px gutter
- **Quick actions:** 4 columns (equal width)
- **Calendar:** 7 columns (equal width)

### Content Width
- Max content width: ~375px (iPhone standard)
- Safe area insets respected for notch devices [Inferred]

---

## 10. Bottom Navigation / Tabs (底部导航/Tabs)

### Properties:
- Height: 56px [Inferred]
- Background: #FFFFFF
- Active color: #0D9488 (Teal)
- Inactive color: #94A3B8
- Indicator style: Color shift only (no underline/dot)
- Icon size: 24px
- Label font: 11px, 500 weight
- Top padding: 8px
- Bottom padding: Safe area + 8px

### Tab Items (Template 1)
- Home (House icon)
- Insights (Chart bars)
- Care (Heart / Plus?)
- Profile (User icon)

### Tab Items (Template 2)
- Today (House icon)
- Coach (Target icon)
- Trends (Chart bars)
- Care (Heart icon)

### Tab Items (Template 3)
- Home (House icon)
- Vitals (Heart icon)
- Chat (Chat bubble)
- Reports (Document icon)

---

## 11. Illustration Style (插画风格)

### Style Properties
- **Overall Style:** Flat vector illustration with soft rounded shapes
- **Color palette:** Limited palette using brand colors + soft pastels
- **Line weight:** No outlines, solid color fills only
- **Character style:**
  - Simplified human figures
  - Rounded head shapes
  - Minimal facial features (eyes only as dots/lines)
  - Friendly, approachable proportions
- **Background elements:** Soft organic shapes (clouds, plants)
- **Shadow usage:** Subtle solid color shadows, no gradients
- **Composition:** Centered, balanced, ample negative space

### Specific Observations (Template 2)
- Main character: Friendly blob-like figure with arms, mint green color
- Secondary character: Walking woman with black hair, exercise outfit
- Plant elements: Simple leaf shapes in muted green
- Heart accent: Small pink heart floating near character

---

## 12. Interaction & Motion (交互与动效)

### Hover / Tap
- Cursor: Pointer [For web]
- Visual feedback: Subtle scale (97-98%), background lighten
- Card press: Slight shadow increase + scale

### Press / Active
- Scale: 97% for buttons, 98% for cards [Inferred]
- Transition duration: 150ms
- Easing: ease-out

### Transitions
- Standard: 150ms ease-out for all interactive elements
- Progress animation: 300ms ease-out for bar/ring fills
- Page transition: Slide in from right, 300ms [Inferred]

### Micro-interactions
- Checkmark animation: Scale + fade in
- Progress ring: Circular stroke-dashoffset animation
- Calendar dot: Pop animation on appearance
- Mood selection: Bounce + scale on select

---

## 13. Implementation Notes (实现注意事项)

### Accessibility
- Color contrast: Ensure text meets WCAG AA (4.5:1) against backgrounds
- Touch targets: Minimum 44x44px for all interactive elements
- Screen reader labels: All icons need descriptive labels
- Progress indicators: Include text values for screen readers

### Responsive Behavior
- Mobile-first design optimized for ~375px width
- Cards should maintain aspect ratio on larger screens
- 2-column metric grid can transition to 4-column on tablet

### Edge Cases
- Empty states: Use consistent illustration style
- Loading states: Skeleton screens matching card shapes
- Error states: Clear messaging with appropriate semantic colors
- Long text: Ensure proper text truncation with ellipsis

### Performance Considerations
- SVG for icons and illustrations (avoid PNG where possible)
- CSS animations over JS where possible
- Lazy load charts below the fold

### WeChat Mini Program Specific Notes [For GradGuide integration]
- Use `wx:for` for rendering card lists
- Use canvas for radar/line charts if needed
- Follow existing token system in `design-token.wxss`
- Maintain `reducedMotion` toggle compatibility

---

## Variant Comparison

| Aspect | Template 1 (Health Brief) | Template 2 (Daily Coach) | Template 3 (Data Dashboard) |
|--------|---------------------------|--------------------------|-----------------------------|
| **Primary Layout** | List-based cards + horizontal sections | Calendar + mood + action cards | Data Grid (2x2 metrics) + AI insights |
| **Main Metric** | Health score ring (86) | Calendar + streak indicator | AI readiness ring (78) |
| **Key Feature** | Today's checklist (meds, hydration, sleep) | Mood check-in + plan progress | Vitals dashboard + AI patterns |
| **CTA Style** | Icon + text action cards | Orange gradient "Start walk" | Blue FAB + card CTAs |
| **Data Viz** | Linear progress bars only | Progress bar for plan | Mini line charts + bar charts |
| **Illustration** | None - text/icon only | Character illustrations (2) | None - data focused |
| **Navigation Tabs** | 4 tabs (Home/Insights/Care/Profile) | 4 tabs (Today/Coach/Trends/Care) | 4 tabs (Home/Vitals/Chat/Reports) |
| **Color Emphasis** | Teal primary + multi-color badges | Teal primary + orange accent | Teal primary + spectrum ring |

### Recommended Primary Variant
**Template 1 (Health Brief)** serves as the strongest foundation for the GradGuide project due to:
1. Clear information hierarchy
2. Flexible card-based system adaptable to program matching
3. Action-oriented layout suitable for gap diagnosis items
4. Clean typography scale that scales well

Templates 2 and 3 offer valuable patterns to borrow from:
- Calendar date selector (Template 2) → Adaptable for application deadlines
- Mood selector (Template 2) → Adaptable for program preference rating
- 2x2 metric grid (Template 3) → Adaptable for profile dimension scores
- AI insights pattern (Template 3) → Adaptable for match insights and recommendations
