# NCAA Logos

This directory is populated at build time by extracting the bundled
`public/FBS-Logo-Library-main.zip` archive. Use

```
pnpm run prepare:logos
```

or any command that imports `scripts/lib/ncaa-logos.mjs` to rehydrate the PNGs
locally. The generated assets are ignored by Git so the repository remains
binary-free.
