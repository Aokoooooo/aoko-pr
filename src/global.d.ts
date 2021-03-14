declare module 'htmltidy2' {
  function tidy(
    html: string,
    config: { indent: boolean; 'show-body-only': 'yes' },
    cb: (e: Error, r: string) => void
  ): void
}
