// Standalone smoke test for the Qwen negative-prompt wiring fix.
// Run with: node scripts/test-qwen-negative-prompt.mjs
//
// Verifies that modifyQwenImageEdit2509Workflow (comfyui.js) writes
// the positive prompt ONLY to the positive encoder node, and the
// negative prompt ONLY to the negative encoder node — instead of
// the pre-existing bug where every node with `inputs.prompt` got
// overwritten with the positive text.
//
// Uses a minimal synthetic workflow that mirrors the shape of the
// real image_qwen_image_edit_2509.json, with two
// TextEncodeQwenImageEditPlus nodes wired into KSampler.positive /
// .negative.

import {
  modifyQwenImageEdit2509Workflow,
} from '../src/services/comfyui.js'

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

// Minimal Qwen Image Edit 2509-shaped workflow
const SAMPLE_WORKFLOW = {
  '78': {
    inputs: { image: 'placeholder.png' },
    class_type: 'LoadImage',
    _meta: { title: 'Load Image' },
  },
  '433:111': {
    inputs: {
      prompt: 'OLD_POSITIVE',
      clip: ['433:38', 0],
      vae: ['433:39', 0],
      image1: ['433:117', 0],
    },
    class_type: 'TextEncodeQwenImageEditPlus',
    _meta: { title: 'Positive Prompt' },
  },
  '433:110': {
    inputs: {
      prompt: 'OLD_NEGATIVE',
      clip: ['433:38', 0],
      vae: ['433:39', 0],
      image1: ['433:117', 0],
    },
    class_type: 'TextEncodeQwenImageEditPlus',
    _meta: { title: 'Negative Prompt' },
  },
  '433:3': {
    inputs: {
      seed: 0,
      steps: 4,
      cfg: 1,
      sampler_name: 'euler',
      scheduler: 'simple',
      denoise: 1,
      model: ['433:75', 0],
      positive: ['433:111', 0],   // ← positive encoder
      negative: ['433:110', 0],   // ← negative encoder
      latent_image: ['433:88', 0],
    },
    class_type: 'KSampler',
    _meta: { title: 'KSampler' },
  },
  '342': {
    inputs: {
      filename_prefix: 'ComfyUI',
      images: ['433:8', 0],
    },
    class_type: 'SaveImage',
    _meta: { title: 'Save Image' },
  },
}

console.log('1. Qwen modifier: positive and negative prompts land on the right nodes')

const modified = modifyQwenImageEdit2509Workflow(SAMPLE_WORKFLOW, {
  prompt: 'NEW_POSITIVE',
  negativePrompt: 'NEW_NEGATIVE',
  inputImage: 'foo.png',
  seed: 42,
  filenamePrefix: 'image/test',
})

const positiveNode = modified['433:111']
const negativeNode = modified['433:110']

check('positive encoder.prompt', positiveNode?.inputs?.prompt, 'NEW_POSITIVE')
check('negative encoder.prompt', negativeNode?.inputs?.prompt, 'NEW_NEGATIVE')

console.log('\n2. Without negativePrompt, the negative node keeps its existing value')

const modified2 = modifyQwenImageEdit2509Workflow(SAMPLE_WORKFLOW, {
  prompt: 'NEW_POSITIVE',
  negativePrompt: '',
  inputImage: 'foo.png',
  seed: 42,
})
check('positive (no neg) gets prompt', modified2['433:111']?.inputs?.prompt, 'NEW_POSITIVE')
check('negative (no neg) keeps OLD', modified2['433:110']?.inputs?.prompt, 'OLD_NEGATIVE')

console.log('\n3. Without KSampler, modifier falls back to the old (buggy) behavior')

// Workflow with no KSampler — negativePromptNodeId stays null, so
// the positive loop treats every prompt node as positive. This is
// the pre-existing fallback. The Qwen 2509 workflow in the repo
// always has a KSampler, so this path is only a defensive fallback.
const NO_SAMPLER_WORKFLOW = {
  '433:111': {
    inputs: { prompt: 'OLD_POS' },
    class_type: 'TextEncodeQwenImageEditPlus',
    _meta: { title: 'Positive' },
  },
  '433:110': {
    inputs: { prompt: 'OLD_NEG' },
    class_type: 'TextEncodeQwenImageEditPlus',
    _meta: { title: 'Negative' },
  },
}
const modified3 = modifyQwenImageEdit2509Workflow(NO_SAMPLER_WORKFLOW, {
  prompt: 'NEW',
  negativePrompt: 'NEW_NEG',
  inputImage: '',
})
// Both nodes get overwritten with the positive prompt (legacy bug).
// This documents the fallback behavior; a real workflow always has
// a KSampler so this path is unreachable in practice.
check('no-sampler: pos gets NEW', modified3['433:111']?.inputs?.prompt, 'NEW')
check('no-sampler: neg gets NEW (legacy fallback)', modified3['433:110']?.inputs?.prompt, 'NEW')

console.log('')
if (failures === 0) {
  console.log('All checks passed.')
  process.exit(0)
} else {
  console.log(`${failures} check(s) failed.`)
  process.exit(1)
}
