# Commune onboarding — image generation prompts

Replace the synthetic SVG/floating-card heroes with real photographic or illustrated images. Below are AI image-gen prompts (Midjourney / DALL·E / Imagen / SDXL) for each of the four sell screens. The fifth section is the celebration moment.

**Style direction across all images:**
- Warm, editorial, magazine-quality. Not corporate, not crypto-bro.
- Soft natural light, mid-tone palette anchored in our app colours: cream `#FAF9F7`, peach `#F8C9A8`, mint `#9ED9BD`, plum `#C4ACE9`, sage `#A6CDB1`.
- Real people / real interiors when shooting humans. Diverse cast — UK + US flat-share demographics, ages 22–35.
- 4:3 aspect ratio (will render at 50% screen height in app).
- No text in the image. No logos, no product UI overlays.
- Avoid: clichéd stock-photo "smiling at laptop", piggy banks, paper money raining down, handshakes.

---

## Screen 1 — Welcome (peach)

**Vibe:** approachable, settled, "you're home" feeling.

**Prompt:**
> Cozy modern flat-share kitchen at golden hour, soft warm peach light streaming through a window, two flatmates in their late twenties sitting at a wooden countertop with mugs of tea, casual conversation, lived-in but tidy, plants on the windowsill, warm wood tones and cream walls, shallow depth of field, editorial photography style, magazine quality, soft warm peach colour grade, 4:3 aspect ratio, photorealistic, no text, no logos.

**Mood reference:** Kinfolk magazine, Apartamento, early Splitwise marketing.

---

## Screen 2 — Split anything fairly (mint)

**Vibe:** the moment of paying, the gentle "no awkward bit" feeling.

**Prompt:**
> Top-down flat-lay of a wooden table after a casual home dinner, four small empty plates arranged around a single receipt at the centre, a phone resting beside the receipt, soft mint and sage colour palette with cream accents, hands of three people reaching toward the receipt simultaneously to suggest sharing the cost, warm overhead lighting, editorial flat-lay photography style, 4:3 aspect ratio, photorealistic, no text on the receipt, no logos.

**Alt prompt (illustration, less literal):**
> Minimalist flat illustration in mint and cream, a single receipt being gently torn into four equal pieces by four pairs of hands, soft geometric shapes, sage green accents, generous whitespace, editorial illustration style, 4:3 aspect ratio.

---

## Screen 3 — Settle in one tap (plum)

**Vibe:** money in motion, contactless, frictionless.

**Prompt:**
> Two phones held by different people gently touching screen-to-screen in a contactless payment gesture, soft purple-plum gradient background, hands and phones in soft focus, warm rim light, editorial product photography style, lavender and dusty rose colour palette, 4:3 aspect ratio, photorealistic, no app UI shown on the phone screens, no logos.

**Alt prompt (illustration):**
> Flat illustration in dusty plum and cream, two abstract phones with a small glowing circle traveling between them representing a payment, soft geometric shapes, lavender and rose accents, editorial illustration style, 4:3 aspect ratio.

---

## Screen 4 — See everything in one place (sage)

**Vibe:** calm overview, "I have a handle on this", quiet confidence.

**Prompt:**
> Person in their late twenties sitting on a sage-green velvet couch in a cozy modern living room, holding a phone in their lap, looking down at it with a calm relaxed expression, soft natural light from a window to the left, plants in the background, warm green and cream colour palette, shallow depth of field, editorial portrait photography style, 4:3 aspect ratio, photorealistic, no app UI visible on the phone, no logos.

**Alt prompt (lifestyle):**
> Detail shot of a cup of coffee, an open notebook, and a phone on a sage-green linen tablecloth, soft morning light, plants softly out of focus in the background, editorial flat-lay photography style, sage and cream colour palette, 4:3 aspect ratio, photorealistic.

---

## Screen 10 — Celebration (gold)

**Vibe:** subtle delight, party-popper without being obnoxious.

**Prompt:**
> A small handful of soft confetti pieces in sage green, peach, plum, and gold gently falling against a warm cream background, soft motion blur on the falling pieces, golden hour lighting, minimalist editorial photography style, 4:3 aspect ratio, photorealistic, no text, no people, no logos.

**Alt prompt (illustration):**
> Flat geometric illustration of confetti pieces in sage, peach, plum, and gold cascading from the top of the frame against a warm cream background, soft shadows, generous whitespace, editorial illustration style, 4:3 aspect ratio.

---

## Where to host the rendered images

Once generated, store them at:

```
apps/mobile/assets/onboarding/
  welcome.jpg
  split.jpg
  settle.jpg
  see.jpg
  celebration.jpg
```

Reference them in `apps/mobile/app/onboarding.tsx` via `require('@/assets/onboarding/welcome.jpg')`. Image dimensions: **export at 1200×900 (4:3) at 80% JPEG quality** — under 200KB each. Put a 2× version (2400×1800) for higher-DPI devices if file size allows.

For first-cut development, the live code uses Unsplash hot-linked photo URLs as placeholders:

| Screen | Placeholder URL |
|---|---|
| Welcome | `https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&fit=crop` |
| Split | `https://images.unsplash.com/photo-1567521464027-f127ff144326?w=900&fit=crop` |
| Settle | `https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=900&fit=crop` |
| See | `https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&fit=crop` |
| Celebration | `https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&fit=crop` |

Replace these with the AI-generated assets before public launch.
