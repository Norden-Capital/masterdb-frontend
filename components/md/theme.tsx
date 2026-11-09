/**
 * Runs in <head> before the first paint (app/layout.tsx). Light only for now
 * (design direction): the dark tokens stay in md.css for later, but nothing
 * switches to them, whatever the computer's own setting is.
 */
export const THEME_SCRIPT = `document.documentElement.dataset.theme='light'`
