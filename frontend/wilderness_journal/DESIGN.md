# Design System Document: The Premium Field Journal

## 1. Overview & Creative North Star: "The Digital Cartographer"
This design system moves away from the sterile, plastic feel of modern utility apps. Our Creative North Star is **"The Digital Cartographer"**—a philosophy that treats the mobile interface as a high-end, tactile field instrument. We balance the rugged, unpredictable nature of the outdoors with the precision of a technical guide. 

To break the "template" look, we utilize **intentional asymmetry** and **tonal layering**. Elements should feel like they are laid out on a physical desk; some notes are tucked under others, while critical data floats on top. We replace rigid 1px borders with "Soft Scoping"—using color shifts and depth to define areas, creating an editorial experience that feels more like a curated journal and less like a database.

---

## 2. Colors & Surface Architecture
The palette is rooted in the "Forest & Stone" spectrum, utilizing high-contrast pairings to ensure legibility in high-glare, outdoor environments.

### The "No-Line" Rule
**Strict Mandate:** 1px solid borders are prohibited for sectioning. We define boundaries through background shifts.
*   **Surface:** `#fdf9ee` (The "Paper" base)
*   **Sectioning:** Use `surface-container-low` (`#f7f4e8`) to define a secondary content area against the main background.
*   **Nesting:** A card (`surface-container-lowest` / `#ffffff`) should sit inside a `surface-container` (`#f1eee3`) area. This creates a "sheet-on-sheet" effect that mimics physical paper layering.

### Glass & Gradient Soul
To prevent the UI from feeling flat or "muddy," we apply a **Signature Grain Gradient**. 
*   **Primary CTAs:** Use a subtle linear gradient from `primary` (#17341c) to `primary_container` (#2d4b31) at a 145° angle.
*   **Floating Navigation:** Utilize "Glassmorphism." Apply `surface` at 85% opacity with a `24px` backdrop-blur. This allows the earthy background textures to bleed through, grounding the UI in the environment.

---

## 3. Typography: The Editorial Scale
We pair the technical, geometric precision of **Space Grotesk** with the humanist, approachable clarity of **Work Sans**.

*   **Display & Headlines (Space Grotesk):** Use these for high-impact data (e.g., GPS coordinates, Altitude, Chapter Titles). The exaggerated ink traps in Space Grotesk provide a "technical equipment" feel.
    *   *Display-LG (3.5rem):* Reserved for hero stats or section headers.
*   **Body & Titles (Work Sans):** Chosen for its extreme readability in long-form survival instructions. 
    *   *Body-MD (0.875rem):* The workhorse for all guide content. Ensure a line-height of 1.5 for maximum legibility under stress.
*   **Labels (Space Grotesk):** Used for metadata, uppercase with 5% letter-spacing to mimic stamped equipment tags.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "software-centric." We use **Ambient Depth**.

*   **The Layering Principle:** Instead of elevation `z-index`, we use the **Surface-Container Scale**. 
    *   *Level 0:* `surface` (The Earth)
    *   *Level 1:* `surface-container-low` (The Journal Page)
    *   *Level 2:* `surface-container-highest` (The Focused Card)
*   **Ambient Shadows:** For floating action buttons or critical alerts, use a shadow with a `32px` blur, `0%` spread, and `6%` opacity, tinted with `on-surface` (#1c1c15). It should look like a soft shadow cast by a leaf, not a glowing neon light.
*   **The Ghost Border Fallback:** Only when accessibility demands a container (e.g., input fields), use `outline-variant` (#c2c8bf) at **15% opacity**.

---

## 5. Components

### Buttons & Interaction
*   **Primary Button:** Deep Forest (`primary`) with a `md` (0.375rem) corner radius. Avoid "pill" shapes; they feel too much like a social media app. A subtle grain overlay texture is encouraged.
*   **Secondary/Tertiary:** Use `secondary_container` with `on_secondary_container` text. These should feel like "taped-on" notes.

### Survival Cards & Lists
*   **The "No-Divider" Rule:** Never use horizontal lines to separate list items. Use `16px` of vertical white space or alternate backgrounds between `surface-container-low` and `surface-container-lowest`.
*   **Imagery:** All photos should have a `sm` (0.125rem) radius to feel like printed polaroids or field clippings.

### Field Inputs
*   **Text Fields:** Use a "minimalist bracket" style—only an underline using `outline` (#737971) or a subtle background fill of `surface-variant`. Avoid the "heavy box" look.

### Unique App Components
*   **The Compass Header:** A persistent, semi-transparent top bar using the Glassmorphism rule, housing critical orientation data in `label-sm` Space Grotesk.
*   **Tactile Progress Steppers:** For survival checklists, use "filled-in" shapes that look like hand-drawn markers rather than digital checkmarks.

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Offset your headlines. Let a map image bleed off the edge of the screen to create a sense of scale.
*   **Prioritize Contrast:** Ensure `on_surface` text always sits on a high-contrast `surface` or `surface_container_low`.
*   **Embrace "Visual Soul":** Add a 2% grain texture overlay to the entire background to mimic high-grade paper.

### Don't:
*   **Don't use pure black (#000):** It kills the organic feel. Use `on_background` (#1c1c15) for the darkest elements.
*   **Don't use generic iconography:** Use thin-stroke, technical icons that look like they were etched into a metal compass.
*   **Don't use standard shadows:** If it looks like a "Material Design" shadow, it's too heavy. Soften and tint it.