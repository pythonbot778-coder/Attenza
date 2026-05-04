# ATTENZA Project Status

## Current Goal
Resolve the schema cache error by aligning profile sync with the `users` table schema.

## Already Correct
- `App.tsx` resilient boot sequence (ready state finally block).
- `src/navigation/RootNavigator.tsx` clean auth events.
- `src/store/authStore.ts` non-blocking hydration flow.
- `src/api/profile.ts` correctly inserts/updates only valid columns (`id`, `name`, `email`).

## Broken Right Now
- No outstanding startup errors.

## Files Changed This Step
- `src/api/profile.ts`
- `ATTENZA_PROJECT_STATUS.md`

## Do Not Touch
- `App.tsx`
- `src/navigation/RootNavigator.tsx`
- `src/store/authStore.ts`
- `src/api/profile.ts`

## Next Action
- Wait for user instruction to build the next screens.

## Schema Notes
- `users` table only accepts `id`, `name`, and `email`.
- `role`, `branch`, `year`, `semester`, and `section` are managed in `class_members` and `class_groups`.

## Last Verified Working
- App runs and bootstraps without infinite loops. `PGRST204` schema cache errors are eliminated.
