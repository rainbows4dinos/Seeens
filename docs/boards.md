# Boards: north star

Status: idea, post-MVP. Needs prototyping and testing before any build. Tracked in #49.

## Why

A filterable list, a detail page, and an edit form make Seeens work. They don't make it fun, and if keeping the network feels like work, nobody keeps it. That's what killed the original spreadsheet. Seeens needs a place to play with the network, and that play should be how the network gets filled in.

The picture is a retro computer desktop crossed with a self-healing cutting mat. You move connection cards around, group and stack them, tape them down, draw string between them (murder mapping), and zoom in and out. A list tells you what's in the network. A board shows you its shape.

## What a board is

- **Its own destination.** Boards sit next to Connections and Scenes in the nav. They are not a mode of the list.
- **A saved view, not the source of truth.** Each board has its own card positions, stacks, and doodles. The directory stays shared and canonical. Taking a card off a board never deletes or archives anything.
- **About one question.** "Reno run, Feb," "Winter bill," "PDX DIY." It isn't a map of everyone you know.
- **Shared with the band** by default. Whether layouts are per member or per board is an open question.

## Play is data entry

Every board gesture maps to a real record, so arranging the board fills in the directory:

| Gesture | Saves |
|---|---|
| Draw string between two cards | An affiliation, or a "played together" fact, after you pick how they're linked |
| Leave string unlabeled | A doodle that only the board sees, not a record |
| Drop cards on a stack | A group on the board; later, maybe a scene or a tag |
| Tape a card down | Pins it on the board; possibly a quick Homie or status move |
| Drop a flyer | Cards for each band on the bill, plus suggested "same bill" strings to confirm |

Suggested links never save on their own. A member confirms each one.

## Keeping it from becoming work

A messy board is a messier spreadsheet. These guardrails are part of the idea, not polish:

- **Never start blank.** A board starts from something: a filter, a scene, a flyer, or one card with "show who they're linked to." Seeens lays out the first draft.
- **Small by default.** A soft ceiling of about 15 to 20 cards. Boards are cheap to make and to archive.
- **One-tap tidy.** Cards snap loosely to the mat, and Tidy groups them by scene or status. Mess is allowed, and cleanup costs nothing.
- **Quiet string.** Saved links stay faint until you hover or select a card. Suggestions show only when asked.
- **Zoom changes detail.** Zoomed out shows name chips. Zoomed in shows photos, tags, and the next step.
- **Nothing only happens on a board.** Every action has a list equivalent. Boards are optional and never a chore to maintain.

## Look and motion

Built from the existing design system: cards, tape, windows, and the dotted ground. Cards rest straight. A card tilts a few degrees while it's held and settles when dropped, and cards under a stack rest at a slight angle. Lean is seeded per record, like tape. Reduced motion keeps the tilt and drops the animation. The design rules need updating to allow this when boards are built.

## Desktop and phone

Arranging a board is a desktop activity. On a phone, a board shows a mini map, its cards as a list, and quick saves for suggested links. There is no pinch-zoom arranging.

## Prototype and test plan

Test one question at a time, ideally with a real band's messy data, not just fake records:

1. **First board in two minutes.** Starting from a flyer or a filter, does the auto-layout feel like a head start or like cleanup?
2. **String to saved link.** Do people label their strings, or do they just doodle?
3. **Return visit.** A week later, does the board still make sense, or is it noise?

First sketch: the "Seeens Board" design canvas in Claude (private to Larry), with a draggable desktop board and a phone pocket view.

## Build notes

- Pan, zoom, and connectors are a solved problem. Evaluate tldraw (check production licensing) and React Flow before building from scratch.
- Board layout data (positions, stacks, doodles) is workspace-private, like notes. It needs a workspace ownership path for RLS.
- Builds on affiliations (#17) and pairs with flyer capture from scene data discovery (#21).
