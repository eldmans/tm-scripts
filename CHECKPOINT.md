# Grok / Noodle / Pinterest Media Enhancers

## MOSSAD (Media Objects Slideshow and Download)
- The main script for all media enhancements (`mossad.user.js`).
- Replaces `grok_hotkeys_plus_slideshow.user.js` and `universal_media_enhancer.user.js`.
- Features:
  - Universal Settings engine (`[rootDomain]_config`) using `localStorage`.
  - Unified UI: Glassmorphism top bar with `[Timer] [↺] [🚀 Start] [⚙▼ Settings] [💾 Download]`.
  - Settings panel drops down, configuring loops, delays, download triggers, and post-download actions.
  - Video tracking via `requestAnimationFrame` for accurate loops counting.
  - Pinterest `expMp4` JSON extractor and Blob downloader to circumvent CORS and audio limitations.
  - NoodleMagazine "Join Now" blocker and 100% video expander.
  - Grok-specific "Delete" and "Home" actions isolated to `grok.com`.

## To Do / Next Steps
- Verify Pinterest download works properly with the new `triggerDownload` button.
- Verify NoodleMagazine video player stretches to 100% correctly.
- Ensure the `updateWidgetUI` correctly mirrors the DOM states.
