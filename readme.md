# Tarui RL Overlay

> **🚀 Say goodbye to IPC overhead!**
>
> RL **[v2.72 update](https://www.rocketleague.com/news/rocket-league-patch-notes-v2-72#:~:text=Added%20WebSocket%20support)** introduced the new `WebSocket` support, we shifted from our ~~legacy TCP~~ pipeline to native `WebSocket`. By connecting directly from JS, we are able to completely eliminate cross-process IPC overhead

--------

Whenever `pre-` and `post-`**compilation** behaviors differ, your **first step** should be running the `debug build` action to verify the resource tree.

`pnpm tsc --noEmit` to check errors before upload.

`find . -maxdepth 3 -not -path '*/.*' -not -path './node_modules*'` to output files tree.

## Credits & Open Source Licenses

This project is made possible by the following amazing open-source resources:

### Typography
- **Typeface**: [Mona Sans Mono](https://github.com)
- **Creator**: GitHub in collaboration with Degarism Studio
- **License**: [SIL Open Font License 1.1 (OFL)](https://github.com/blob/main/OFL.txt)
- **Usage**: Embedded in this application to provide a high-quality, legible monospace experience.

---

###### I should have [GPG signed](https://gist.github.com/noxone/2627135564d905d6a849c6854647bab1) now.
###### Hello from Antigravity!