# Metronome Loader and Page Loader, Nov 8

Built in PRs #200, #201, #202, #203, #205, #206. Checked in Chromium, desktop and iPhone viewports, with a slowed network:

- Dial: 45 degrees each way about (20, 27) of the 40-unit box, 1s per swing pair (120 BPM), ease 0.364 0 0.636 1, from Figma motion.
- Dots: three, staggered in, out at 80%, 1s loop; animation durations measured 1s each.
- One metronome at a time: frame-by-frame logs show the page loader's metronome hidden whenever the busy pointer has it, and the pointer on the mouse point at 0.3s.
- Reduced motion: dial still, dots on, no busy pointer.
