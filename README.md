# Grok Hotkeys

> **Keyboard shortcuts for Grok Imagine** — quickly download, upscale, delete, toggle sound, and access your saved generations without touching the mouse.

A lightweight Tampermonkey / Violentmonkey userscript that adds convenient hotkeys to [grok.com](https://grok.com), especially on the Imagine section.

![Version](https://img.shields.io/badge/version-1.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Auto-update](https://img.shields.io/badge/auto--update-enabled-success)

## ✨ Features

- **PageDown** — Download current image or video
- **PageUp** — Upscale / Enhance quality
- **Right Ctrl + Delete** — Delete current video (safe combination)
- **End** — Toggle sound (mute / unmute)
- **Home** — Open saved generations history (current tab)
- **Ctrl + Home** — Open saved generations history (new tab)

Works on both **Russian** and **English** Grok interfaces.

## 📦 Installation (with auto-updates)

### Recommended way

1. Install [Tampermonkey](https://www.tampermonkey.net/) (recommended) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click the link below — Tampermonkey will open and offer to install the script:

   **[➡️ Install Grok Hotkeys](https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok-hotkeys.user.js)**

3. Confirm installation.  
   **Auto-updates are enabled** — whenever a new version is pushed to this repository, your script will update automatically.

### Manual installation

1. Open Tampermonkey dashboard → **Create a new script**.
2. Delete the default template.
3. Paste the entire content of `grok-hotkeys.user.js`.
4. Save (`Ctrl + S`).

## ⌨️ Hotkeys Reference

| Shortcut                    | Action                              | Notes                                      |
|----------------------------|-------------------------------------|--------------------------------------------|
| `PageDown`                 | Download                            | Prevents page scroll                       |
| `PageUp`                   | Upscale / Enhance quality           | Prevents page scroll                       |
| `Right Ctrl` + `Delete`    | Delete video                        | Uses Right Ctrl to avoid browser conflicts |
| `End`                      | Toggle sound (mute/unmute)          | Works for both states                      |
| `Home`                     | Saved generations (current tab)     | -                                          |
| `Ctrl` + `Home`            | Saved generations (new tab)         | Opens in background tab                    |

## 🛠 How it works

The script uses a single global `keydown` listener (with `capture: true`) and searches for buttons using `aria-label` attributes and visible text content. It supports multiple languages out of the box.

A subtle scale animation provides visual feedback when a hotkey successfully triggers an action.

## 📝 Notes & Limitations

- Best experience on `https://grok.com/imagine*` pages.
- Some hotkeys call `preventDefault()` to block default browser behavior (scrolling on PageUp/PageDown).
- Right Ctrl + Delete was chosen because Left Ctrl is already heavily used by browsers and OS.
- If Grok changes button labels significantly, the script may need a small update (easy to maintain).

## 🔄 Updating the script

1. Edit `grok-hotkeys.user.js`
2. Bump the `@version` number
3. Commit and push to the repository

All users who installed via the raw GitHub link will receive the update automatically within a few hours (Tampermonkey checks periodically).

## 🤝 Contributing

Pull requests are welcome!

Repository: [https://github.com/eldmans/tm-scripts](https://github.com/eldmans/tm-scripts)

Suggested folder structure inside the repo:

```
tm-scripts/
└── grok/
    ├── grok-hotkeys.user.js
    └── README.md
```

## 📄 License

MIT — feel free to use, modify and share.

---

Made with ❤️ for Grok power users.  
If you have ideas for new hotkeys or improvements — open an issue or PR!