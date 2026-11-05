# Solace

Solace is an AI wellness companion that connects a short check-in, a relevant conversation, a useful activity, and an optional reflection. Returning users can benefit from preferences they explicitly approve.

## Audience and purpose
People who feel overwhelmed and want an approachable daily wellness practice. The app helps with everyday reflection and self-care; it does not diagnose or replace professional support.

## User-approved scope
Build the full discussed experience: accounts and onboarding; personal home; contextual conversations and retained history; consent-controlled preferences; check-ins and three reflective assessments; breathing and reflections; five resource categories; wellness plans, affirmations and small challenges; factual progress, participation XP and streaks; configurable local reminders; profile and data controls. Light and dark themes are required.

## Product principles
- The primary journey is check in → talk or choose an activity → act → reflect → return.
- Keep one primary action prominent. Additional features remain easy to discover.
- Make consent and control visible. Use approved context sparingly.
- Treat participation gently. XP describes app activity, never emotional worth.
- Preserve natural mobile behavior: safe areas, scrolling, keyboard avoidance, back navigation, and readable touch targets.

## Success evidence
An account can save and reopen private records; conversations retain context; suggestions launch working activities; feedback appears in Journey; preferences are inspectable and removable; reminders schedule and route to the right screen; the final APK works without a development server.


## Platform

adaptive

React Native with Expo serves iOS and Android. The web preview shares the same source. Verify installation, permissions, and OS materials on native devices.

## Connected Moments experience

Four main tabs are Today, Solace, Journey and Profile. Explore is a labeled shortcut in the bottom bar and brings Moments and the full practice library together. Today also offers the daily pause and a Moments entry. Solace can carry the current message into a Moment, and its activity result can lead back to the saved conversation.

A Moment contains validated activity data, a user-chosen environment and optional ambient sound. Completion uses actual foreground activity time, explicit saving and optional self-reported feedback. Memories require explicit approval and separate global personalization consent. Correcting/removing memories or disabling personalization resets future AI context while keeping saved history visible. Journey shows recorded calendar history, minutes, helpfulness, editable goals and gentle milestones; streaks start off and remain optional.

Voice is turn based: explicit recording permission, stop, server transcription, transcript review, manual send and optional device speech playback. Built-in guidance remains available without a provider key and is visibly labeled. Voice transcription requires a configured provider and otherwise offers text fallback. External setup and device acceptance are deferred at the user's request; implementation work proceeds without those checks being misreported as passed.
