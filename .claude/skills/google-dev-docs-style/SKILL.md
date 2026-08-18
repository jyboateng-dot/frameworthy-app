---
name: google-dev-docs-style
description: Write and converse using the Google Developer Documentation Style Guide — second person, active voice, plain language, sentence-case headings. Use for docs, READMEs, comments, commit/PR prose, and (when the user asks) the conversation itself.
---

# Google Developer Documentation Style Guide

Source: developers.google.com/style. Apply this whenever writing documentation-like
prose (READMEs, comments, PR descriptions, error messages) or when the user asks for
replies in this voice.

## Voice and tone

- Conversational, friendly, respectful — like a knowledgeable friend explaining
  something, not a professor lecturing. Casual and approachable, never pedantic or
  pushy.
- Never flippant. Skip wackiness, zaniness, jokes-for-their-own-sake, current
  pop-culture references, and internet slang. Stay human and memorable, but the
  information comes first.
- No figurative language, metaphors, or ableist expressions. They translate badly
  and slow down non-native readers.
- Cut jargon and buzzwords. Write for a global audience with varying English
  fluency: simple, consistent, direct.
- Never call a task "simply," "easy," or "quick." What's easy for the writer may
  not be easy for the reader, and the claim adds nothing if it's true and feels
  patronizing if it's not.
- Drop placeholder filler: "please note," "at this time," "in order to." Say the
  thing directly.
- Vary sentence openers. Don't start every sentence in a paragraph with "You can."
- Omit "please" in instructions. "Click **Save**," not "Please click **Save**."

Calibration (too informal → right → too formal):
| Too informal | Right | Too formal |
|---|---|---|
| Dude! This API is totally awesome! | This API lets you collect data about what your users like. | The API may enable acquisition of information pertaining to user preferences. |

## Grammar and person

- Second person: "you," not "the user" or "we" (unless "we" means Anthropic/the
  team speaking, not the reader).
- Active voice: name who performs the action. "The build fails when X" not "X
  causes the build to be failed."
- Present tense for how things behave now; reserve future tense for things that
  will genuinely happen later.
- Conditions before instructions: "If the field is empty, enter a value" — not
  "Enter a value if the field is empty."
- Standard American spelling.
- Contractions are fine and preferred for negatives: "don't," "isn't," "can't" —
  a reader skimming is more likely to miss a bare "not" than misread "don't." Never
  invent nonstandard contractions ("guides're") or stack three words
  ("mightn't've").

## Formatting

- Titles and headings: sentence case ("Fix the build," not "Fix The Build").
- Numbered lists for sequential steps; bullets for non-sequential items;
  description lists for term/definition pairs.
- Serial (Oxford) commas, always.
- Code-related text (file names, functions, flags, commands) in code font.
- UI element names in bold.
- Unambiguous dates — spell out or use a format that can't be misread as
  day/month vs. month/day.
- Link text describes the destination ("see the pricing formula") — never "click
  here."
- Alt text on every image; prefer high-resolution or vector graphics.

## Applying this to conversation

When the user asks to be talked to in this style, hold the same bar in chat
replies: second person, active voice, no "please," no "simply/easy/quick," no
placeholder filler, contractions welcome, headings in sentence case if the reply
uses them, one idea per sentence, serial commas. The goal is a clear, respectful,
efficient explanation — not a lecture and not a sales pitch.
