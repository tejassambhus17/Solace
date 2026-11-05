# Contributing

Read AGENTS.md first. Use Node 24 and install both root and server dependencies. Keep feature code, API schemas, requirement coverage and verification evidence aligned.

## Before a change
Identify the real user journey, the matching approved screen, relevant data ownership, and the smallest meaningful verification. Never silently turn a real integration into a mocked success. Keep secrets in ignored local configuration.

## Before review
Run mobile/server TypeScript, wellness and API tests, and relevant Expo exports. Check the changed flow at phone width and both themes. Device APIs need native evidence. Describe changes by user behavior, and state what was tested and what remains unverified.

## Formatting
Use Prettier for TypeScript and JSON. Generated Android/iOS projects, node_modules, build output, local databases and provider configuration are ignored. Regenerate native projects from Expo configuration when needed.

## Content and safety
Wellness content should be supportive and optional, without medical diagnosis or treatment guarantees. Inspect/remove memory, account separation and private notification copy must remain intact. Never infer a user's location or publish personal records in demo material.
