// Slugs for the 8 outputs of the 1_click_multiple_angles / _scene workflows.
// Order mirrors the saveNodes map in comfyui.js#modifyMultipleAnglesWorkflow
// so the angle can be recovered from the filename prefix returned by ComfyUI.
export const MULTI_ANGLE_SLUGS = Object.freeze([
  'close_up',
  'wide_shot',
  '45_right',
  '90_right',
  '90_left',
  '45_left',
  'aerial_view',
  'low_angle',
])

export const MULTI_ANGLE_SLUG_SET = new Set(MULTI_ANGLE_SLUGS)

export function isMultiAngleSlug(value) {
  return MULTI_ANGLE_SLUG_SET.has(String(value || '').toLowerCase())
}

// Pulls the angle slug out of a ComfyUI image filename like
// "ComfyStudio-close_up_00001_.png" → "close_up". Returns null if the
// filename doesn't match one of the known multi-angle slugs.
export function extractMultiAngleSlugFromFilename(filename) {
  const basename = String(filename || '').split(/[\\/]/).pop() || ''
  if (!basename) return null
  // Slug may start with a digit (e.g. "45_right", "90_left"), so the
  // first char class allows letters or digits. The lazy quantifier
  // stops at the next "_<counter>_" boundary ComfyUI always emits.
  const match = basename.match(/-([a-z0-9][a-z0-9_]+?)_\d+_/i)
  if (!match) return null
  const slug = match[1].toLowerCase()
  return isMultiAngleSlug(slug) ? slug : null
}

// Default angle used as a single-asset fallback for cast entries that
// have no per-angle map (legacy data, or a user that never generated a
// multi-angle sheet).
export const MULTI_ANGLE_DEFAULT_SLUG = 'close_up'
