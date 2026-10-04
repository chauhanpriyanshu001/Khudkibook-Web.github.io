# DSA reader UI — theme-oriented redesign

Shared styles and interaction code are committed at `public/books/4330704/reader.css` and `reader.js`. Scope all reader markup with `body.kb-dsa`. These files do not change the main homepage or the existing textbook links.

The redesigned Unit IV HTML is currently available as a reviewed local preview, not as a published chapter in this repository. Committing these assets alone does not publish a chapter route. The remaining units are not complete.

## Layout contract

Use `.dsa-shell`, `.crumb`, `.cover`, `.hero-actions`, `.toolbar`, `.reader-grid`, `.toc`, and `article.paper#reading`. The cover has a two-column desktop layout and stacked mobile layout. Chapter selection uses `.chapter-list`; add `.index-grid` to the reader grid for the chapter-list route.

Load Inter and Outfit as on the main site, with system-font fallbacks. Use the original `/assets/brand/khudkibook-logo.svg`. Theme references: site background #f6f8fc, terracotta #CD5D33, accessible action background #A64B27, peach #f4e2d3, and cream reading surface #fffdf9.

## Student-friendly controls

- `.toc details` contains `input#topic-search`, topic links, and `#toc-empty[hidden]` for the no-results state.
- `#reading-percent` and `progress#reading-meter` show reading progress.
- `button#font-smaller`, `button#font-larger`, and `#font-size-label` control reading text size, saved locally only.
- `button#toggle-answers` toggles `#exam details`; individual questions also work without JavaScript.
- `button#prev-topic` and `button#next-topic` navigate article sections.
- Quick-study links should point to the actual `#reading`, `#lab`, `#exam`, and `#revision` anchors.

## PDF control

The visible button label must be **Download PDF**, not "Save watermarked PDF" or "Download with watermark". Use `button#save-pdf.action.primary` and `#pdf-status[role=status]`. Include a short note: Opens the print dialog. Choose "Save as PDF".

This is native browser print-to-PDF, not a silent one-click binary download. The previously requested original-logo and khudkibook.in branding remains inside the printed PDF; only the user-facing watermark wording has been removed. Include `.print-watermark` with the original logo image and hostname when integrating the chapter HTML.

Print opens all model answers temporarily and restores their state after printing or cancellation. Reading controls are hidden in print using `.no-print`. No student name or email is collected.

## Validation scope

The redesigned local Unit IV preview was tested in Chromium at desktop and 390px phone widths, with no duplicate IDs, missing internal anchors, or document-level horizontal overflow. Native print preparation/restoration passed. Branding was detected on all 21 pages of the internal print test. Live-site deployment, site-shell interaction, Android WebView and other-browser testing are not completed.
