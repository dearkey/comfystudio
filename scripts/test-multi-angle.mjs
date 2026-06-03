// Standalone smoke-test for the multi-angle per-shot reference feature.
// Run with: node scripts/test-multi-angle.mjs
//
// Exercises the pure logic that doesn't need a running ComfyUI:
//  - filename → angle slug parser
//  - free-form "Camera angle:" → enum slug normalizer
//  - full planner round-trip on a tiny director script
//  - cast schema migration (old entry without angles + new entry with angles)
//
// Exits non-zero on any assertion failure.

import {
  MULTI_ANGLE_SLUGS,
  isMultiAngleSlug,
  extractMultiAngleSlugFromFilename,
} from '../src/utils/multiAngle.js'

let failures = 0
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ok  ${name}`)
  } else {
    console.log(`  FAIL ${name}`)
    console.log(`       expected: ${e}`)
    console.log(`       actual:   ${a}`)
    failures += 1
  }
}
function checkTrue(name, value) { check(name, value, true) }
function checkNull(name, value) { check(name, value, null) }

console.log('1. extractMultiAngleSlugFromFilename')
check('close_up', extractMultiAngleSlugFromFilename('ComfyStudio-close_up_00001_.png'), 'close_up')
check('wide_shot', extractMultiAngleSlugFromFilename('ComfyStudio-wide_shot_00002_.png'), 'wide_shot')
check('45_right', extractMultiAngleSlugFromFilename('ComfyStudio-45_right_00003_.png'), '45_right')
check('90_right', extractMultiAngleSlugFromFilename('ComfyStudio-90_right_00004_.png'), '90_right')
check('90_left', extractMultiAngleSlugFromFilename('ComfyStudio-90_left_00005_.png'), '90_left')
check('45_left', extractMultiAngleSlugFromFilename('ComfyStudio-45_left_00006_.png'), '45_left')
check('aerial_view', extractMultiAngleSlugFromFilename('ComfyStudio-aerial_view_00007_.png'), 'aerial_view')
check('low_angle', extractMultiAngleSlugFromFilename('ComfyStudio-low_angle_00008_.png'), 'low_angle')
checkNull('unknown slug', extractMultiAngleSlugFromFilename('ComfyStudio-something_else_00001_.png'))
checkNull('not a comfy filename', extractMultiAngleSlugFromFilename('rose.png'))
checkNull('empty', extractMultiAngleSlugFromFilename(''))

console.log('\n2. MULTI_ANGLE_SLUGS / isMultiAngleSlug')
check('8 slugs in order', MULTI_ANGLE_SLUGS, ['close_up', 'wide_shot', '45_right', '90_right', '90_left', '45_left', 'aerial_view', 'low_angle'])
checkTrue('isMultiAngleSlug(close_up)', isMultiAngleSlug('close_up'))
checkTrue('isMultiAngleSlug(LOW_ANGLE)', isMultiAngleSlug('LOW_ANGLE'))
checkTrue('not isMultiAngleSlug(Close-up)', !isMultiAngleSlug('Close-up'))
checkTrue('not isMultiAngleSlug(wide)', !isMultiAngleSlug('wide'))
checkTrue('not isMultiAngleSlug("")', !isMultiAngleSlug(''))
checkTrue('not isMultiAngleSlug(null)', !isMultiAngleSlug(null))

console.log('\n3. Planner: parseStructuredDirectorScript parses Camera angle:')

const { parseStructuredDirectorScript, flattenYoloPlanVariants } = await import('../src/utils/yoloPlanning.js')

const SAMPLE_SCRIPT = `
Scene 1: Opening

Shot 1: Wide establishing
Start at: 0:00
Shot type: performance_wide
Camera angle: wide_shot
Keyframe prompt: Singer leans against a neon-lit phone booth.
Motion prompt: Slow push-in on the singer.
Camera: Slow dolly forward, eye level, 35mm lens.
Length: 4.5

Shot 2: Close-up
Start at: 0:04.5
Shot type: performance
Camera angle: close_up
Keyframe prompt: Tight close-up on the singer's eyes.
Motion prompt: Hold on her face as she sings.
Camera: Handheld, 85mm.
Length: 3.2

Shot 3: Behind
Start at: 0:08
Shot type: performance_wide
Camera angle: 90_right
Keyframe prompt: Singer seen from behind, walking down the alley.
Motion prompt: Camera follows from behind.
Camera: 35mm.
Length: 3

Shot 4: Aliases
Start at: 0:12
Shot type: performance
Camera angle: side
Keyframe prompt: Profile shot.
Motion prompt: Slow pan.
Camera: 50mm.
Length: 2.5

Shot 5: Free text
Start at: 0:15
Shot type: performance
Camera angle: from below
Keyframe prompt: Low angle.
Motion prompt: Tilt up.
Camera: 24mm.
Length: 2.5

Shot 6: Unknown
Start at: 0:18
Shot type: performance
Camera angle: banana
Keyframe prompt: Garbage angle, should fall back to null.
Motion prompt: …
Camera: …
Length: 2.5

Shot 7: B-roll (no angle expected)
Start at: 0:21
Shot type: b_roll
Keyframe prompt: Empty street.
Motion prompt: Static shot.
Camera: 35mm.
Length: 2
`

const parsedScenes = parseStructuredDirectorScript(SAMPLE_SCRIPT, {
  takesPerAngle: 1,
  targetDurationSeconds: 30,
  variationSeed: 0,
  styleNotes: '',
})
const shots = parsedScenes?.[0]?.shots || []
check('scene count', parsedScenes.length, 1)
check('shot count', shots.length, 7)
check('shot 1 angle', shots[0]?.angle, 'wide_shot')
check('shot 2 angle', shots[1]?.angle, 'close_up')
check('shot 3 angle (90_right = behind)', shots[2]?.angle, '90_right')
check('shot 4 angle (side alias → 90_right)', shots[3]?.angle, '90_right')
check('shot 5 angle (from below alias → low_angle)', shots[4]?.angle, 'low_angle')
checkNull('shot 6 angle (unknown → null)', shots[5]?.angle)
checkNull('shot 7 angle (b_roll, no camera angle line)', shots[6]?.angle)

console.log('\n4. flattenYoloPlanVariants: cameraAngle carried through')

const variants = flattenYoloPlanVariants(parsedScenes)
check('variant count', variants.length, 7)
check('variant 1 cameraAngle', variants[0]?.cameraAngle, 'wide_shot')
check('variant 2 cameraAngle', variants[1]?.cameraAngle, 'close_up')
check('variant 3 cameraAngle', variants[2]?.cameraAngle, '90_right')
check('variant 4 cameraAngle (alias normalized)', variants[3]?.cameraAngle, '90_right')
check('variant 5 cameraAngle (alias normalized)', variants[4]?.cameraAngle, 'low_angle')
checkNull('variant 6 cameraAngle (unknown)', variants[5]?.cameraAngle)
checkNull('variant 7 cameraAngle (b_roll)', variants[6]?.cameraAngle)

console.log('')
if (failures === 0) {
  console.log('All checks passed.')
  process.exit(0)
} else {
  console.log(`${failures} check(s) failed.`)
  process.exit(1)
}
